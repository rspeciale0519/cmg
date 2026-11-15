import "server-only";

import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  StandardFonts,
  decodePDFRawStream,
} from "pdf-lib";
import { buildLorPdfFields, loadLorPdf, type LorFieldSource } from "./lor-pdf";
import manifest from "./lor-tag-manifest.json";

/**
 * The no-API-key half of the PandaDoc integration.
 *
 * `pandadoc.ts` uploads the bundled tagged PDF and lets PandaDoc fill the text
 * tags from the field map. Without an API key nobody is there to do that, so
 * this module does the same substitution locally: every *data* tag becomes the
 * claim's value. Signer-entered tags keep their exact text and position,
 * but use invisible text rendering so their glyphs do not cover printed lines.
 * Staff upload the result to PandaDoc's web app for field recognition.
 * Both variants need a provider check when the PDF preparation changes.
 *
 * Which tag is which is not guessed here. `scripts/build-lor-tagged-pdfs.py`
 * drew every tag and therefore knows every one of them; `--manifest` exports
 * its own tables to `lor-tag-manifest.json`, which is what this module reads,
 * and `lor-prefill.test.ts` checks that export against the bundled PDFs so a
 * regenerated asset cannot drift away from it silently.
 *
 * The optional authorization date stays blank for the primary signer.
 * Data tags are replaced in the page text. Signing tags remain searchable
 * text for PandaDoc, but their text rendering mode prevents glyph paint. White
 * paint would hide the tags but could also cover parts of printed lines.
 */

type Placement = {
  page: number;
  x: number;
  y: number;
  id: string;
  role: string;
  type: string;
  tag: string;
};

type Variant = { data: Placement[]; signature: Placement[] };

const VARIANTS = manifest.variants as Record<"single" | "dual", Variant>;

export const LOR_TAG_FONT_SIZE = manifest.fontSize;
const LOR_DATA_FONT_SIZE = 9;
const CHECKBOX_FIELDS = new Set(["em", "ne", "su"]);

// Measured from the retained form's rule ends and the current text anchors.
// Accepted-by can use more of its line; narrow dates and the fee need a cap.
const PRINTED_TEXT_WIDTHS: Partial<Record<string, number>> = {
  fee: 51.334,
  d1: 61.934,
  d2: 58.094,
  d3: 57.974,
  d4: 61.854,
  d8: 58.694,
  accepted: 125,
};

/**
 * The floor for shrink-to-fit, as a percentage of normal glyph width. Below
 * about 60% Helvetica stops being readable in print, and an unreadable
 * agreement term is worse than a visibly shortened one.
 */
const MIN_HORIZONTAL_SCALE = 60;

/** ASCII, so the truncation marker survives the same folding the values get. */
const ELLIPSIS = "...";

export function lorVariantKey(signerCount: number): "single" | "dual" {
  return signerCount > 1 ? "dual" : "single";
}

/** The tags that must survive prefilling verbatim, for the test and for readers. */
export function lorSignatureTags(signerCount: number): string[] {
  return VARIANTS[lorVariantKey(signerCount)].signature.map(
    (placement) => placement.tag,
  );
}

export function lorDataPlacements(signerCount: number): Placement[] {
  return VARIANTS[lorVariantKey(signerCount)].data;
}

const PUNCTUATION: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  " ": " ",
};

/**
 * The tags are drawn in a WinAnsi standard font. A homeowner's name with a
 * curly apostrophe pasted out of a mail client is ordinary input, not an
 * error, so the common typographic characters are folded to ASCII and anything
 * still outside the encodable range is dropped rather than written as a byte
 * the font cannot render.
 */
function toWinAnsi(value: string): string {
  let out = "";
  for (const character of value.replace(/\r?\n/g, " ")) {
    const folded = PUNCTUATION[character] ?? character;
    for (const glyph of folded) {
      const code = glyph.codePointAt(0) ?? 0;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff)) {
        out += glyph;
      }
    }
  }
  return out;
}

/** `(`, `)` and `\` end or escape a PDF literal string; everything else is data. */
function escapePdfString(value: string): string {
  return value.replace(/([\\()])/g, "\\$1");
}

/**
 * The page's content streams as *references*, so the rewritten stream can be
 * assigned back over the original object. `PDFPageLeaf.Contents()` resolves the
 * entry and hands back the stream itself, which has nowhere to be written to.
 */
function contentRefs(pdf: PDFDocument, pageIndex: number): PDFRef[] {
  const entry = pdf.getPages()[pageIndex]?.node.get(PDFName.of("Contents"));
  if (!entry) return [];
  const parts = entry instanceof PDFArray ? entry.asArray() : [entry];
  return parts.filter((part): part is PDFRef => part instanceof PDFRef);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pdfNumber(value: number): string {
  return String(value).replace(".", "\\.");
}

/** Hide only the tagged glyphs that the manual uploader needs to detect. */
function hideSignatureTags(pdf: PDFDocument, signerCount: number): void {
  const pages = pdf.getPages().map((_, pageIndex) =>
    contentRefs(pdf, pageIndex).flatMap((ref) => {
      const stream = pdf.context.lookup(ref);
      return stream instanceof PDFRawStream
        ? [{ ref, content: Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1"), changed: false }]
        : [];
    }),
  );
  const placements = VARIANTS[lorVariantKey(signerCount)].signature;

  for (const placement of placements) {
    const showTag = new RegExp(`\\(${escapeRegExp(escapePdfString(placement.tag))}\\)\\s+Tj`, "g");
    const matches = pages.flat().reduce(
      (total, stream) => total + [...stream.content.matchAll(showTag)].length,
      0,
    );
    if (matches !== 1) {
      const reason = matches === 0 ? "missing" : "duplicate";
      throw new Error(`Expected one signing tag ${placement.tag} on page ${placement.page}; found ${reason}.`);
    }

    const standaloneObject = new RegExp(
      `(?<!\\S)BT\\s+1\\s+0\\s+0\\s+1\\s+${pdfNumber(placement.x)}\\s+${pdfNumber(placement.y)}\\s+Tm\\s+\\(${escapeRegExp(escapePdfString(placement.tag))}\\)\\s+Tj\\s+T\\*\\s+ET(?!\\S)`,
      "g",
    );
    const pageStreams = pages[placement.page - 1] ?? [];
    const positioned = pageStreams.flatMap((stream) =>
      [...stream.content.matchAll(standaloneObject)]
        .map((match) => match[0])
        .map((object) => ({ stream, object })),
    );
    if (positioned.length !== 1) {
      const reason = positioned.length === 0 ? "missing" : "duplicate";
      throw new Error(`Expected one positioned signing tag ${placement.tag} on page ${placement.page}; found ${reason}.`);
    }

    const { stream, object } = positioned[0];
    stream.content = stream.content.replace(object, `q 1 g ${object.replace(/^BT\b/, "BT 3 Tr")} Q`);
    stream.changed = true;
  }

  for (const stream of pages.flat()) {
    if (stream.changed) {
      const ref = stream.ref;
      pdf.context.assign(ref, pdf.context.flateStream(Buffer.from(stream.content, "latin1")));
    }
  }
}

/** The operators that draw one value inside the box its tag occupied. */
function showText(
  raw: string,
  boxWidth: number,
  widthOf: (text: string) => number,
): string {
  const value = toWinAnsi(raw);
  if (value.length === 0) return "() Tj";

  const natural = widthOf(value);
  if (natural <= boxWidth) return `(${escapePdfString(value)}) Tj`;

  const scale = Math.max(MIN_HORIZONTAL_SCALE, (boxWidth / natural) * 100);
  const fitted = boxWidth / (scale / 100);

  let text = value;
  // Floating division can put an otherwise fitted value just above its budget.
  // Truncation is needed only when the minimum scale still cannot fit it.
  if (scale === MIN_HORIZONTAL_SCALE && natural > fitted + 0.001) {
    while (text.length > 1 && widthOf(`${text}${ELLIPSIS}`) > fitted) {
      text = text.slice(0, -1);
    }
    text = `${text}${ELLIPSIS}`;
  }

  /* `Tz` is text state and survives `ET`, so it is put back to 100 straight
     after the value; the tags that follow on the page are drawn by the same
     content stream and must not inherit this one's squeeze. */
  const paintedScale = Math.floor(scale * 100) / 100;
  return `${paintedScale.toFixed(2)} Tz (${escapePdfString(text)}) Tj 100 Tz`;
}

/**
 * Build the staff-downloadable Letter of Representation.
 *
 * Each data tag's `(tag) Tj` becomes `(value) Tj` at the same baseline.
 * Manual-download values use 9 pt; detection markers and checkbox marks keep
 * their original 7 pt size. The separate API upload still uses its source PDF.
 * A value wider than its available printed line is first **shrunk to fit**
 * horizontally, down to `MIN_HORIZONTAL_SCALE`; only if it still does not fit
 * at that width is it **truncated** with a trailing "...", so a long property
 * address loses its tail rather than running across the next printed field.
 */
export async function buildPrefilledLorPdf(
  request: LorFieldSource,
  dispatchDate: Date = new Date(),
): Promise<Uint8Array> {
  const signerCount = request.signers.length;
  const fields = buildLorPdfFields(request, dispatchDate);
  const pdf = await PDFDocument.load(await loadLorPdf(signerCount));

  /* Metrics only, from a scratch document: the bundled PDF already carries the
     font the tags were drawn in, and embedding a second copy into the file
     staff are about to upload would add an object nothing references. */
  const metrics = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const tagWidthOf = (text: string) => metrics.widthOfTextAtSize(text, LOR_TAG_FONT_SIZE);

  const byPage = new Map<number, Placement[]>();
  for (const placement of lorDataPlacements(signerCount)) {
    byPage.set(placement.page, [...(byPage.get(placement.page) ?? []), placement]);
  }

  for (const [pageNumber, placements] of byPage) {
    for (const ref of contentRefs(pdf, pageNumber - 1)) {
      const stream = pdf.context.lookup(ref);
      if (!(stream instanceof PDFRawStream)) continue;

      let content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      let changed = false;

      for (const placement of placements) {
        const target = `(${placement.tag}) Tj`;
        const targetIndex = content.indexOf(target);
        if (targetIndex < 0) continue;

        const checkbox = CHECKBOX_FIELDS.has(placement.id);
        const size = checkbox ? LOR_TAG_FONT_SIZE : LOR_DATA_FONT_SIZE;
        // Raw Tj does not apply kerning pairs. Measure its actual glyph advance.
        const valueWidthOf = (text: string) => [...text].reduce(
          (width, character) => width + metrics.widthOfTextAtSize(character, size), 0,
        );
        const width = PRINTED_TEXT_WIDTHS[placement.id] ?? tagWidthOf(placement.tag);
        let replacement = showText(fields[placement.id]?.value ?? "", width, valueWidthOf);

        if (!checkbox) {
          const selections = [...content.slice(0, targetIndex).matchAll(/\/([A-Za-z0-9]+)\s+([\d.]+)\s+Tf/g)];
          const selected = selections.at(-1);
          if (!selected) throw new Error(`Missing text font for LOR field ${placement.id}.`);
          // Restore text state before subsequent detection markers are read.
          replacement = `/${selected[1]} ${size} Tf ${replacement} /${selected[1]} ${selected[2]} Tf`;
        }

        content = content.replace(
          target,
          replacement,
        );
        changed = true;
      }

      if (changed) {
        pdf.context.assign(ref, pdf.context.flateStream(Buffer.from(content, "latin1")));
      }
    }
  }

  hideSignatureTags(pdf, signerCount);

  return pdf.save();
}

/** Attachment filename. `claim_ref` is already safe for a header and a disk. */
export function prefilledLorFileName(claimRef: string): string {
  return `LOR-${claimRef.replace(/[^A-Za-z0-9._-]/g, "-")}-prefilled.pdf`;
}
