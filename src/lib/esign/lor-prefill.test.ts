// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from "pdf-lib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { buildPrefilledLorPdf, lorDataPlacements, lorSignatureTags, prefilledLorFileName } =
  await import("./lor-prefill");
const { lorPdfName } = await import("./lor-pdf");
const { sendLorRequestFixture } = await import("./fixtures");

/**
 * What a prefilled letter has to be true of, for both bundled variants:
 *
 *   * every data tag is gone and its claim value is in the file;
 *   * every signature and initial tag survives character for character,
 *     because those strings are the only thing PandaDoc has to go on when
 *     staff upload the PDF by hand — a tag that lost an underscore is a
 *     signature field that never appears.
 *
 * The assertions read the page content streams rather than a rendering, since
 * that is where the drawn strings live. A tag is only "gone" when the string
 * is absent from the whole document, so white ink drawn over it is checked
 * separately, by the coordinate manifest test below.
 */
async function pageText(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  let text = "";

  for (const page of pdf.getPages()) {
    const contents = page.node.Contents();
    const parts = contents instanceof PDFArray ? contents.asArray() : [contents];
    for (const part of parts) {
      const stream = part instanceof PDFRef ? pdf.context.lookup(part) : part;
      if (stream instanceof PDFRawStream) {
        text += Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
      }
    }
  }

  return text;
}

/**
 * The strings the page actually shows, with PDF string escaping undone, so a
 * value carrying brackets — `(727) 555-0134` — is compared as staff will read
 * it rather than as `\(727\) 555-0134`.
 */
async function drawnStrings(bytes: Uint8Array): Promise<string[]> {
  const text = await pageText(bytes);
  const shown = text.match(/\((?:\\.|[^\\()])*\) Tj/g) ?? [];
  return shown.map((operator) =>
    operator.slice(1, -4).replace(/\\([\\()])/g, "$1"),
  );
}

const TOKENS = [
  { name: "Policyholders.Name", value: "Dana Roe and Robin Roe" },
  { name: "Claim.Carrier", value: "Citizens" },
  { name: "Claim.PolicyNumber", value: "POL-42" },
  { name: "Claim.ClaimNumber", value: "CLM-99887766" },
  { name: "Claim.LossDate", value: "07/04/2026" },
  { name: "Claim.Cause", value: "Hurricane" },
  { name: "Property.Address", value: "1 Test Way, Orlando, Florida 32801" },
  { name: "Fee.Percent", value: "12.5%" },
  { name: "Adjuster.Name", value: "Sam Vale" },
  { name: "Homeowner1.Phone", value: "(727) 555-0134" },
  { name: "Homeowner1.Email", value: "dana@example.com" },
  { name: "Claim.EmergencyMark", value: "X" },
];

function requestFor(signerCount: number) {
  const request = sendLorRequestFixture({ tokens: TOKENS });
  return { ...request, signers: request.signers.slice(0, signerCount) };
}

const DISPATCH_DATE = new Date("2026-08-14T16:00:00Z");

/** Values that are printed verbatim, keyed by the tag id that carries them. */
const EXPECTED_VALUES: Record<string, string> = {
  ph: "Dana Roe and Robin Roe",
  accepted: "Dana Roe and Robin Roe",
  carrier: "Citizens",
  policy: "POL-42",
  claimno: "CLM-99887766",
  property: "1 Test Way, Orlando, Florida 32801",
  lossdate: "07/04/2026",
  cause: "Hurricane",
  fee: "12.5%",
  adjuster: "Sam Vale",
  phone: "(727) 555-0134",
  email: "dana@example.com",
  em: "X",
  d1: "08/14/2026",
  d2: "08/14/2026",
  d3: "08/14/2026",
  d4: "08/14/2026",
  d5: "08/14/2026",
  d6: "08/14/2026",
  d7: "08/14/2026",
  d8: "08/14/2026",
  d9a: "08/14/2026",
  d9b: "08/14/2026",
};

describe.each([
  [1, "single"],
  [2, "dual"],
] as const)("prefilled LOR (%i signer)", (signerCount, variant) => {
  it(`replaces every data tag and keeps every signature tag in the ${variant} PDF`, async () => {
    const bytes = await buildPrefilledLorPdf(requestFor(signerCount), DISPATCH_DATE);
    const text = await pageText(bytes);
    const shown = await drawnStrings(bytes);

    const placements = lorDataPlacements(signerCount);
    expect(placements).toHaveLength(25);

    for (const placement of placements) {
      expect(
        text,
        `data tag ${placement.id} survived prefilling`,
      ).not.toContain(placement.tag);

      const expected = EXPECTED_VALUES[placement.id];
      if (expected !== undefined) {
        expect(shown, `value for ${placement.id} is missing`).toContain(expected);
      }
    }

    for (const tag of lorSignatureTags(signerCount)) {
      expect(shown, `signature tag ${tag} was damaged`).toContain(tag);
    }
  }, 60_000);

  it(`leaves the unselected agreement marks and absent values blank in the ${variant} PDF`, async () => {
    const bytes = await buildPrefilledLorPdf(requestFor(signerCount), DISPATCH_DATE);
    const text = await pageText(bytes);

    // `ne` and `su` carry no value on an emergency agreement, and no token in
    // the fixture supplies one. Their tags still have to be gone.
    for (const id of ["ne", "su"]) {
      const placement = lorDataPlacements(signerCount).find((row) => row.id === id);
      expect(placement).toBeDefined();
      expect(text).not.toContain(placement!.tag);
    }
  }, 60_000);

  it(`carries the ${variant} signature tag set and no other`, () => {
    const expected =
      signerCount > 1
        ? ["i1", "j1", "i2", "j2", "i3", "j3", "i4", "j4", "s5", "t5", "s6", "t6", "s7", "t7", "i8", "j8", "s9", "t9"]
        : ["i1", "i2", "i3", "i4", "s5", "s6", "s7", "i8", "s9"];

    const ids = lorSignatureTags(signerCount).map(
      (tag) => tag.replace(/^\{\{[a-z]:H[12]:/, "").replace(/_*\}\}$/, ""),
    );
    expect(ids).toEqual(expected);
  });
});

describe("tag coordinate manifest", () => {
  /**
   * The manifest is exported from `scripts/build-lor-tagged-pdfs.py`, which is
   * the thing that drew the tags. This checks the export still describes the
   * bundled assets: a regenerated PDF whose tags moved, or a manifest
   * regenerated from edited constants, has to fail here rather than produce a
   * letter with a tag left showing.
   */
  it.each([1, 2] as const)("matches every tag drawn in the %i-signer PDF", async (signerCount) => {
    const source = await readFile(
      path.join(process.cwd(), "src", "lib", "esign", "templates", lorPdfName(signerCount)),
    );
    const drawn = (await pageText(source)).match(/\{\{[a-z]:H[12]:[a-z0-9_]+\}\}/g) ?? [];

    const expected = [
      ...lorDataPlacements(signerCount).map((placement) => placement.tag),
      ...lorSignatureTags(signerCount),
    ];

    expect([...drawn].sort()).toEqual([...expected].sort());
  }, 60_000);
});

describe("prefilledLorFileName", () => {
  it("names the file after the claim and keeps it path-safe", () => {
    expect(prefilledLorFileName("CMG-2026-0042")).toBe("LOR-CMG-2026-0042-prefilled.pdf");
    expect(prefilledLorFileName("../etc/passwd")).toBe("LOR-.._etc_passwd-prefilled.pdf".replace(/_/g, "-"));
  });
});
