// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
  StandardFonts,
  decodePDFRawStream,
} from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { loadLorPdfMock } = vi.hoisted(() => ({ loadLorPdfMock: vi.fn() }));
vi.mock("./lor-pdf", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lor-pdf")>()),
  loadLorPdf: loadLorPdfMock,
}));

import manifest from "./lor-tag-manifest.json";

const { buildPrefilledLorPdf } = await import("./lor-prefill");
const { lorPdfName } = await import("./lor-pdf");
const { sendLorRequestFixture } = await import("./fixtures");

type Placement = {
  page: number;
  x: number;
  y: number;
  id: string;
  role: string;
  type: string;
  tag: string;
  optional?: true;
};
type Variant = { data: Placement[]; signature: Placement[] };
type TextObject = {
  page: number;
  x: number;
  y: number;
  text: string;
  font: string | null;
  size: number | null;
  horizontalScale: number;
  renderMode: number;
  fill: [number, number, number];
};

const variants = manifest.variants as Record<"single" | "dual", Variant>;
// Measured from the printed background, not from the tag coordinate table.
// Page 9's adjuster rule is the generator's replacement at y=480. Other rules
// come from the retained blank page. The y values describe the rule area,
// while top is its independently measured upper edge. These are not tag or
// PandaDoc field coordinates. A marker baseline cannot prove signature ink fit.
const printedRules = [
  { id: "ph", page: 1, y: 555, top: 555.07, clearance: 2.5 },
  { id: "carrier", page: 1, y: 523, top: 523.39, clearance: 2.5 },
  { id: "policy", page: 1, y: 523, top: 523.39, clearance: 2.5 },
  { id: "property", page: 1, y: 486.5, top: 486.07, clearance: 2.5 },
  { id: "lossdate", page: 1, y: 444, top: 444.19, clearance: 1.25 },
  { id: "cause", page: 1, y: 444, top: 444.19, clearance: 2.5 },
  { id: "fee", page: 1, y: 318, top: 318.65, clearance: 1.25 },
  { id: "d1", page: 1, y: 57.5, top: 57.84, clearance: 1.25 },
  { id: "d2", page: 2, y: 102.5, top: 102.84, clearance: 1.25 },
  { id: "d3", page: 3, y: 153.5, top: 153.62, clearance: 1.25 },
  { id: "d4", page: 4, y: 113, top: 113.28, clearance: 1.25 },
  { id: "d5", page: 5, y: 707.5, top: 707.86, clearance: 1.25 },
  { id: "d6", page: 6, y: 676, top: 676.30, clearance: 1.25 },
  { id: "d7", page: 7, y: 424.5, top: 424.73, clearance: 1.25 },
  { id: "d8", page: 8, y: 34, top: 34.32, clearance: 1.25 },
  { id: "claimno", page: 9, y: 525, top: 525.31, clearance: 2.5 },
  { id: "accepted", page: 9, y: 488, top: 488.47, clearance: 2.5 },
  { id: "adjuster", page: 9, y: 480, top: 480.5, clearance: 2.5 },
  { id: "phone", page: 9, y: 451, top: 451.51, clearance: 2.5 },
  { id: "d9a", page: 9, y: 451, top: 451.51, clearance: 1.25 },
  { id: "email", page: 9, y: 411, top: 411.17, clearance: 2.5 },
  { id: "d9b", page: 9, y: 377.5, top: 377.81, clearance: 1.25 },
] as const;

const requiredSigningSlots = [
  { page: 1, h1: "i1", h2: "j1", type: "i" },
  { page: 2, h1: "i2", h2: "j2", type: "i" },
  { page: 3, h1: "i3", h2: "j3", type: "i" },
  { page: 4, h1: "i4", h2: "j4", type: "i" },
  { page: 5, h1: "s5", h2: "t5", type: "s" },
  { page: 6, h1: "s6", h2: "t6", type: "s" },
  { page: 7, h1: "s7", h2: "t7", type: "s" },
  { page: 8, h1: "i8", h2: "j8", type: "i" },
  { page: 9, h1: "s9", h2: "t9", type: "s" },
] as const;
const streamOperators = /(?<!\S)[qQ](?!\S)|(?<!\S)[BE]T(?!\S)|(?<!\S)-?[\d.]+\s+g(?!\S)|(?<!\S)-?[\d.]+\s+-?[\d.]+\s+-?[\d.]+\s+rg(?!\S)|\/[A-Za-z0-9+_.-]+\s+[\d.]+\s+Tf\b|(?<!\S)[\d.]+\s+(?:Tr|Tz)\b|(?<!\S)1\s+0\s+0\s+1\s+-?[\d.]+\s+-?[\d.]+\s+Tm\b|\((?:\\.|[^\\()])*\)\s*Tj\b/g;

async function readTextObjects(bytes: Uint8Array): Promise<TextObject[]> {
  const pdf = await PDFDocument.load(bytes);
  const objects: TextObject[] = [];

  for (const [pageIndex, page] of pdf.getPages().entries()) {
    const entry = page.node.get(PDFName.of("Contents"));
    if (!entry) continue;
    const parts = entry instanceof PDFArray ? entry.asArray() : [entry];
    const stack: Pick<TextObject, "fill" | "font" | "size" | "horizontalScale" | "renderMode">[] = [];
    let fill: [number, number, number] = [0, 0, 0];
    let font: string | null = null;
    let size: number | null = null;
    let horizontalScale = 100;
    let renderMode = 0;
    let x: number | null = null;
    let y: number | null = null;

    for (const part of parts) {
      const stream = part instanceof PDFRef ? pdf.context.lookup(part) : part;
      if (!(stream instanceof PDFRawStream)) continue;
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");

      for (const match of content.matchAll(streamOperators)) {
        const token = match[0].trim();
        if (token === "q") {
          stack.push({ fill: [...fill], font, size, horizontalScale, renderMode });
        } else if (token === "Q") {
          const restored = stack.pop();
          if (restored) {
            fill = restored.fill;
            font = restored.font;
            size = restored.size;
            horizontalScale = restored.horizontalScale;
            renderMode = restored.renderMode;
          }
        } else if (token.endsWith(" rg")) {
          const values = token.slice(0, -3).trim().split(/\s+/).map(Number);
          fill = [values[0], values[1], values[2]];
        } else if (token.endsWith(" g")) {
          const gray = Number(token.slice(0, -2).trim());
          fill = [gray, gray, gray];
        } else if (token === "BT") {
          x = null;
          y = null;
        } else if (token.endsWith(" Tf")) {
          const values = token.split(/\s+/);
          font = values[0].slice(1);
          size = Number(values[1]);
        } else if (token.endsWith(" Tr")) {
          renderMode = Number(token.split(/\s+/)[0]);
        } else if (token.endsWith(" Tz")) {
          horizontalScale = Number(token.split(/\s+/)[0]);
        } else if (token.endsWith(" Tm")) {
          const values = token.split(/\s+/).map(Number);
          x = values[4];
          y = values[5];
        } else if (token.endsWith("Tj") && x !== null && y !== null) {
          const text = token.slice(1, token.lastIndexOf(")"));
          objects.push({
            page: pageIndex + 1,
            x,
            y,
            text: text.replace(/\\([\\()])/g, "$1"),
            font,
            size,
            horizontalScale,
            renderMode,
            fill: [...fill],
          });
        }
      }
    }
  }

  return objects;
}

function requestFor(signerCount: number) {
  const request = sendLorRequestFixture();
  return { ...request, signers: request.signers.slice(0, signerCount) };
}

async function sourcePdf(signerCount: number): Promise<Uint8Array> {
  return readFile(path.join(
    process.cwd(), "src", "lib", "esign", "templates", lorPdfName(signerCount),
  ));
}

async function alterSignatureMarker(
  signerCount: number,
  marker: Placement,
  change: "remove" | "duplicate" | "extraText" | "move",
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(await sourcePdf(signerCount));
  const page = pdf.getPages()[marker.page - 1];
  const entry = page.node.get(PDFName.of("Contents"));
  if (!entry) throw new Error("Template page has no content stream.");
  const parts = entry instanceof PDFArray ? entry.asArray() : [entry];
  const literal = `(${marker.tag}) Tj`;

  for (const part of parts) {
    if (!(part instanceof PDFRef)) continue;
    const stream = pdf.context.lookup(part);
    if (!(stream instanceof PDFRawStream)) continue;
    const content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
    const index = content.indexOf(literal);
    if (index < 0) continue;
    const start = content.lastIndexOf("BT", index);
    const end = content.indexOf("ET", index) + 2;
    if (start < 0 || end < 2) throw new Error("Template marker has no text object.");
    const textObject = content.slice(start, end);
    if (change === "duplicate") {
      const duplicate = pdf.context.register(
        pdf.context.flateStream(Buffer.from(textObject, "latin1")),
      );
      const contents = entry instanceof PDFArray ? entry : PDFArray.withContext(pdf.context);
      if (!(entry instanceof PDFArray)) {
        contents.push(entry);
        page.node.set(PDFName.of("Contents"), contents);
      }
      contents.push(duplicate);
      return pdf.save();
    }
    const changed = change === "remove"
      ? content.slice(0, start) + content.slice(end)
      : change === "extraText"
          ? content.replace(textObject, textObject.replace(" T* ET", " (unexpected) Tj T* ET"))
          : content.replace(textObject, textObject.replace(
              `${marker.x} ${marker.y} Tm`, `${marker.x + 1} ${marker.y} Tm`,
            ));
    pdf.context.assign(part, pdf.context.flateStream(Buffer.from(changed, "latin1")));
    return pdf.save();
  }

  throw new Error("Template signing marker was not found.");
}

beforeEach(() => {
  loadLorPdfMock.mockImplementation((signerCount: number) => sourcePdf(signerCount));
});

describe.each([
  [1, "single"],
  [2, "dual"],
] as const)("manual signing marker visibility (%s signer)", (signerCount, variant) => {
  it(`prints data above the original rules in the ${variant} output`, async () => {
    const request = requestFor(signerCount);
    request.tokens = [
      { name: "Policyholders.Name", value: "Peggy Young" },
      { name: "Claim.Carrier", value: "Progressive" },
      { name: "Claim.PolicyNumber", value: "policy-42" },
      { name: "Property.Address", value: "1 Cypress Way" },
      { name: "Claim.LossDate", value: "07/04/2026" },
      { name: "Claim.Cause", value: "Hurricane" },
      { name: "Fee.Percent", value: "12.5%" },
      { name: "Claim.ClaimNumber", value: "claim-42" },
      { name: "Adjuster.Name", value: "Greg Young" },
      { name: "Homeowner1.Phone", value: "(727) 555-0134" },
      { name: "Homeowner1.Email", value: "peggy@example.com" },
    ];
    const objects = await readTextObjects(await buildPrefilledLorPdf(
      request, new Date("2026-08-14T16:00:00Z"),
    ));
    const fontPdf = await PDFDocument.create();
    const font = await fontPdf.embedFont(StandardFonts.Helvetica);
    for (const rule of printedRules) {
      const placement = variants[variant].data.find((field) => field.id === rule.id);
      expect(placement).toBeDefined();
      const matches = objects.filter((object) => object.page === rule.page
        && object.x === placement!.x && object.y === placement!.y);
      expect(matches, `printed field ${rule.id}`).toHaveLength(1);
      const object = matches[0];
      expect(object.text, `filled value for ${rule.id}`).not.toBe(placement!.tag);
      expect(object.text).not.toBe("");
      expect(object.size, `filled text size for ${rule.id}`).toBe(9);
      const baseline = object.y;
      expect.soft(baseline, `${rule.id} crosses its printed rule`).toBeGreaterThanOrEqual(rule.y + rule.clearance);
      expect.soft(baseline, `${rule.id} rises outside its line area`).toBeLessThanOrEqual(rule.y + 5);
      const descent = /[gjpqy]/.test(object.text)
        ? font.heightAtSize(object.size!) - font.heightAtSize(object.size!, { descender: false })
        : 0;
      expect.soft(baseline - descent, `${rule.id} ink reaches its printed rule`)
        .toBeGreaterThanOrEqual(rule.top + 0.5);
    }

    for (const { id, left } of [
      { id: "d4", left: 444.79 },
      { id: "accepted", left: 168.5 },
      { id: "d9a", left: 392.47 },
    ]) {
      const field = variants[variant].data.find((placement) => placement.id === id)!;
      const object = objects.find((entry) => entry.page === field.page
        && entry.x === field.x && entry.y === field.y)!;
      expect.soft(Math.abs(object.x - left), `${id} starts away from its printed line`)
        .toBeLessThanOrEqual(2);
    }
  }, 60_000);

  it(`covers each required signing slot and preserves optional consent in the ${variant} asset`, () => {
    const signing = variants[variant].signature;
    const required = signing.filter((placement) => placement.optional !== true);
    const optional = signing.filter((placement) => placement.optional === true);
    const expectedRequired = requiredSigningSlots.flatMap((slot) => [
      { id: slot.h1, role: "H1", page: slot.page, type: slot.type },
      ...(signerCount === 2 ? [{ id: slot.h2, role: "H2", page: slot.page, type: slot.type }] : []),
    ]);
    const expectedOptional = [
      { id: "ia2", role: "H1", page: 2, type: "i" },
      { id: "da2", role: "H1", page: 2, type: "d" },
      ...(signerCount === 2 ? [{ id: "ja2", role: "H2", page: 2, type: "i" }] : []),
    ];
    const slots = (placements: Placement[]) => placements.map(({ id, role, page, type }) => ({
      id, role, page, type: type.replace(/\*$/, ""),
    })).sort((a, b) => a.id.localeCompare(b.id));

    expect(slots(required)).toEqual(expectedRequired.sort((a, b) => a.id.localeCompare(b.id)));
    expect(slots(optional)).toEqual(expectedOptional.sort((a, b) => a.id.localeCompare(b.id)));
    expect(signing).toHaveLength(signerCount === 1 ? 11 : 21);
    expect(new Set(signing.map((placement) => placement.id)).size).toBe(signing.length);
    for (const placement of required) {
      expect(placement).not.toHaveProperty("optional");
      expect(placement.tag).toMatch(/^\{\{[is]:H[12]:[a-z0-9_]+\}\}$/);
    }
    for (const placement of optional) {
      expect(placement.tag).toMatch(/^\{\{[id]\*:H[12]:[a-z0-9_]+\}\}$/);
    }
  });

  it(`matches every actual tag position to the ${variant} manifest`, async () => {
    const objects = await readTextObjects(await sourcePdf(signerCount));
    const placements = [...variants[variant].data, ...variants[variant].signature];
    expect(objects).toHaveLength(placements.length);
    for (const placement of placements) {
      const matches = objects.filter((object) => object.text === placement.tag);
      expect(matches, `tag ${placement.id}`).toHaveLength(1);
      expect(matches[0]).toMatchObject({ page: placement.page, x: placement.x, y: placement.y, size: 7, fill: [0, 0, 0] });
    }
  }, 60_000);

  it(`hides only signing marker glyphs in the ${variant} output`, async () => {
    const original = await sourcePdf(signerCount);
    const output = await buildPrefilledLorPdf(requestFor(signerCount), new Date("2026-08-14T16:00:00Z"));
    const before = await readTextObjects(original);
    const after = await readTextObjects(output);
    const signature = variants[variant].signature;
    const data = variants[variant].data;
    const signatureTags = new Set(signature.map((placement) => placement.tag));

    expect(signature).toHaveLength(signerCount === 1 ? 11 : 21);
    expect(after).toHaveLength(before.length);

    for (const prior of before) {
      const matches = after.filter((object) =>
        object.page === prior.page && object.x === prior.x && object.y === prior.y,
      );
      expect(matches, `text object at ${prior.page}:${prior.x},${prior.y}`).toHaveLength(1);
      const current = matches[0];
      expect(current.font).toBe(prior.font);
      const dataField = data.find((placement) => placement.tag === prior.text);
      const keepsTagSize = !dataField || ["em", "ne", "su"].includes(dataField.id);
      expect(current.size).toBe(keepsTagSize ? 7 : 9);

      if (signatureTags.has(prior.text)) {
        expect(current.text).toBe(prior.text);
        expect(current.renderMode).toBe(3);
        expect(current.fill).toEqual([1, 1, 1]);
      } else {
        expect(current.renderMode).toBe(prior.renderMode);
        expect(current.fill).toEqual(prior.fill);
      }
    }

    for (const placement of signature) {
      const marker = after.filter((object) => object.page === placement.page && object.text === placement.tag);
      expect(marker).toHaveLength(1);
      expect(marker[0]).toMatchObject({
        x: placement.x,
        y: placement.y,
        renderMode: 3,
        fill: [1, 1, 1],
        size: 7,
      });
    }

    for (const placement of data) {
      const field = after.filter((object) =>
        object.page === placement.page && object.x === placement.x && object.y === placement.y,
      );
      expect(field, `data field ${placement.id}`).toHaveLength(1);
      expect(field[0].fill).toEqual([0, 0, 0]);
      expect(field[0].text).not.toBe(placement.tag);
    }

    const carrier = data.find((placement) => placement.id === "carrier");
    expect(carrier).toBeDefined();
    expect(after).toContainEqual(expect.objectContaining({
      page: carrier!.page,
      x: carrier!.x,
      y: carrier!.y,
      text: "Citizens",
      fill: [0, 0, 0],
    }));
    expect(after.filter((object) => object.fill.join(",") === "1,1,1").map((object) => object.text).sort())
      .toEqual([...signatureTags].sort());
  }, 60_000);

  it(`prints short ${variant} values at nine points without condensing them`, async () => {
    const request = requestFor(signerCount);
    request.tokens = [
      { name: "Policyholders.Name", value: "Dana Roe" },
      { name: "Claim.Carrier", value: "Test" },
      { name: "Claim.PolicyNumber", value: "POL42" },
      { name: "Property.Address", value: "1 Test Way" },
      { name: "Claim.LossDate", value: "07/04/2026" },
      { name: "Claim.Cause", value: "Storm" },
      { name: "Fee.Percent", value: "20%" },
      { name: "Claim.ClaimNumber", value: "CLM42" },
      { name: "Adjuster.Name", value: "Sam Roe" },
      { name: "Homeowner1.Phone", value: "555-0100" },
      { name: "Homeowner1.Email", value: "a@b.test" },
      { name: "Claim.EmergencyMark", value: "X" },
    ];
    const objects = await readTextObjects(await buildPrefilledLorPdf(request, new Date("2026-08-14T16:00:00Z")));
    for (const placement of variants[variant].data) {
      const object = objects.find((entry) => entry.page === placement.page
        && entry.x === placement.x && entry.y === placement.y)!;
      expect(object).toBeDefined();
      expect(object.size, placement.id).toBe(["em", "ne", "su"].includes(placement.id) ? 7 : 9);
      expect(object.horizontalScale, placement.id).toBe(100);
    }
  }, 60_000);

  it(`fits long ${variant} values inside the independently measured printed lines`, async () => {
    const request = requestFor(signerCount);
    request.tokens = [
      { name: "Policyholders.Name", value: "Peggy Young ".repeat(30).trim() },
      { name: "Homeowner1.Email", value: `peggy.${"long".repeat(60)}@example.com` },
      // A malformed source value must stay inside the fee line too.
      { name: "Fee.Percent", value: "12345678901234567890%" },
    ];
    const objects = await readTextObjects(await buildPrefilledLorPdf(request, new Date("2026-08-14T16:00:00Z")));
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    // These are original rule endpoints, not production fit budgets.
    for (const { id, right } of [
      { id: "ph", right: 259.72 },
      { id: "accepted", right: 296.20 },
      { id: "email", right: 264.04 },
      { id: "fee", right: 501.334 },
      { id: "d1", right: 525.934 },
      { id: "d2", right: 483.094 },
      { id: "d3", right: 512.974 },
      { id: "d4", right: 506.854 },
      { id: "d8", right: 513.694 },
    ]) {
      const placement = variants[variant].data.find((field) => field.id === id)!;
      const object = objects.find((entry) => entry.page === placement.page
        && entry.x === placement.x && entry.y === placement.y)!;
      expect(object, id).toBeDefined();
      expect.soft(object.size, id).toBe(9);
      expect(object.horizontalScale, id).toBeGreaterThanOrEqual(60);
      expect(object.horizontalScale, id).toBeLessThanOrEqual(100);
      // A literal Tj does not apply the kerning in full-string font metrics.
      const advance = [...object.text].reduce((total, character) => total + font.widthOfTextAtSize(character, object.size!), 0);
      const visibleWidth = advance * object.horizontalScale / 100;
      expect.soft(object.x + visibleWidth, `${id} reaches the next printed area`).toBeLessThanOrEqual(right + 0.02);
      if (["ph", "accepted", "email", "fee"].includes(id)) {
        expect(object.text, `${id} must show its truncation`).toMatch(/\.\.\.$/);
        expect(object.horizontalScale, `${id} must preserve the scale floor`).toBe(60);
      } else {
        expect(object.text, id).toBe("08/14/2026");
        expect(object.horizontalScale, `${id} must not inherit a previous squeeze`).toBe(100);
      }
    }
  }, 60_000);

  it(`preserves complete ${variant} values that fit above the minimum scale`, async () => {
    const request = requestFor(signerCount);
    request.tokens = [
      { name: "Policyholders.Name", value: "SYNTHETIC Owner One and Owner Two" },
      { name: "Homeowner1.Email", value: "synthetic-owner@example.com" },
    ];
    const objects = await readTextObjects(await buildPrefilledLorPdf(request, new Date("2026-08-14T16:00:00Z")));
    for (const { id, value } of [
      { id: "accepted", value: "SYNTHETIC Owner One and Owner Two" },
      { id: "email", value: "synthetic-owner@example.com" },
    ]) {
      const placement = variants[variant].data.find((field) => field.id === id)!;
      const object = objects.find((entry) => entry.page === placement.page
        && entry.x === placement.x && entry.y === placement.y)!;
      expect(object.text, `${id} must remain complete`).toBe(value);
      expect(object.size, id).toBe(9);
      expect(object.horizontalScale, id).toBeGreaterThanOrEqual(60);
      expect(object.horizontalScale, id).toBeLessThan(100);
    }
  }, 60_000);

  it(`fits ${variant} raw text advances without relying on font kerning`, async () => {
    const name = "AV".repeat(15);
    const request = requestFor(signerCount);
    request.tokens = [{ name: "Policyholders.Name", value: name }];
    const objects = await readTextObjects(await buildPrefilledLorPdf(request, new Date("2026-08-14T16:00:00Z")));
    const accepted = variants[variant].data.find((field) => field.id === "accepted")!;
    const object = objects.find((entry) => entry.page === accepted.page
      && entry.x === accepted.x && entry.y === accepted.y)!;
    expect(object.text).toBe(name);
    expect(object.size).toBe(9);
    expect(object.horizontalScale).toBeGreaterThanOrEqual(60);
    expect(object.horizontalScale).toBeLessThan(100);
    // Independently measured Helvetica advances: 30 letters at 9 pt total 180.09 pt.
    expect(object.x + 180.09 * object.horizontalScale / 100).toBeLessThanOrEqual(296.20);
  }, 60_000);
});

describe.each([
  [1, "single", "i1"],
  [1, "single", "ia2"],
  [1, "single", "da2"],
  [2, "dual", "ja2"],
] as const)("signing marker integrity (%i signer, %s, %s)", (signerCount, variant, id) => {
  it.each([
    ["remove", "missing"],
    ["duplicate", "duplicate"],
    ["extraText", "missing"],
    ["move", "missing"],
  ] as const)("fails closed when the marker is %s", async (change, label) => {
    const marker = variants[variant].signature.find((placement) => placement.id === id);
    expect(marker, `signing slot ${id}`).toBeDefined();
    const damaged = await alterSignatureMarker(signerCount, marker!, change);
    loadLorPdfMock.mockResolvedValue(damaged);

    const result = await buildPrefilledLorPdf(requestFor(signerCount), new Date("2026-08-14T16:00:00Z"))
      .then(() => null, (error: unknown) => error);
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toMatch(new RegExp(`signing tag .* ${label}`));
  });
});
