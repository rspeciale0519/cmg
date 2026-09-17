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
 * claim's value, and every signature and initial tag is left exactly as drawn.
 * Staff upload the result to PandaDoc's web app, where those surviving tags are
 * what PandaDoc detects and turns into signature fields.
 *
 * Which tag is which is not guessed here. `scripts/build-lor-tagged-pdfs.py`
 * drew every tag and therefore knows every one of them; `--manifest` exports
 * its own tables to `lor-tag-manifest.json`, which is what this module reads,
 * and `lor-prefill.test.ts` checks that export against the bundled PDFs so a
 * regenerated asset cannot drift away from it silently.
 *
 * The substitution replaces the drawn string rather than painting over it.
 * Covering a tag with ink would leave the characters `{{t:H1:ph___}}` in the
 * page's text — invisible, and still exactly what PandaDoc scans for on
 * upload, so every filled field would come back as an empty field laid over
 * the value. A tag is only gone when the string is gone.
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

/**
 * The floor for shrink-to-fit, as a percentage of normal glyph width. Below
 * about 60% Helvetica at 7 pt stops being readable in print, and an unreadable
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
  if (widthOf(text) > fitted) {
    while (text.length > 1 && widthOf(`${text}${ELLIPSIS}`) > fitted) {
      text = text.slice(0, -1);
    }
    text = `${text}${ELLIPSIS}`;
  }

  /* `Tz` is text state and survives `ET`, so it is put back to 100 straight
     after the value; the tags that follow on the page are drawn by the same
     content stream and must not inherit this one's squeeze. */
  return `${scale.toFixed(2)} Tz (${escapePdfString(text)}) Tj 100 Tz`;
}

/**
 * Build the staff-downloadable Letter of Representation.
 *
 * Each data tag's `(tag) Tj` becomes `(value) Tj` in place, so the value
 * inherits the tag's position, font and size exactly as PandaDoc's own fill
 * would. A value wider than the tag it replaces is first **shrunk to fit**
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
  const widthOf = (text: string) => metrics.widthOfTextAtSize(text, LOR_TAG_FONT_SIZE);

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
        if (!content.includes(target)) continue;

        content = content.replace(
          target,
          showText(fields[placement.id]?.value ?? "", widthOf(placement.tag), widthOf),
        );
        changed = true;
      }

      if (changed) {
        pdf.context.assign(ref, pdf.context.flateStream(Buffer.from(content, "latin1")));
      }
    }
  }

  return pdf.save();
}

/** Attachment filename. `claim_ref` is already safe for a header and a disk. */
export function prefilledLorFileName(claimRef: string): string {
  return `LOR-${claimRef.replace(/[^A-Za-z0-9._-]/g, "-")}-prefilled.pdf`;
}
