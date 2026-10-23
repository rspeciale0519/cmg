// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFRef,
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
};
type Variant = { data: Placement[]; signature: Placement[] };
type TextObject = {
  page: number;
  x: number;
  y: number;
  text: string;
  font: string | null;
  size: number | null;
  renderMode: number;
  fill: [number, number, number];
};

const variants = manifest.variants as Record<"single" | "dual", Variant>;
// Measured from the printed background, not from the tag coordinate table.
// Page 9's adjuster rule is the generator's replacement at y=480. Other rules
// come from the retained blank page. Reserve rule thickness and a visible gap,
// plus Helvetica's descent above a rule or the glyph height below one.
const printedRules = [
  { id: "ph", page: 1, y: 555, side: "above", clearance: 2.5 },
  { id: "carrier", page: 1, y: 523, side: "above", clearance: 2.5 },
  { id: "policy", page: 1, y: 523, side: "above", clearance: 2.5 },
  { id: "property", page: 1, y: 486.5, side: "above", clearance: 2.5 },
  { id: "lossdate", page: 1, y: 444, side: "above", clearance: 1.25 },
  { id: "cause", page: 1, y: 444, side: "above", clearance: 2.5 },
  { id: "fee", page: 1, y: 318, side: "above", clearance: 1.25 },
  { id: "d1", page: 1, y: 57.5, side: "above", clearance: 1.25 },
  { id: "d2", page: 2, y: 102.5, side: "above", clearance: 1.25 },
  { id: "d3", page: 3, y: 153.5, side: "below", clearance: 6.5 },
  { id: "d4", page: 4, y: 113, side: "below", clearance: 6.5 },
  { id: "d5", page: 5, y: 707.5, side: "below", clearance: 6.5 },
  { id: "d6", page: 6, y: 676, side: "above", clearance: 1.25 },
  { id: "d7", page: 7, y: 424.5, side: "below", clearance: 6.5 },
  { id: "d8", page: 8, y: 34, side: "above", clearance: 1.25 },
  { id: "claimno", page: 9, y: 525, side: "below", clearance: 8 },
  { id: "accepted", page: 9, y: 488, side: "below", clearance: 8 },
  { id: "adjuster", page: 9, y: 480, side: "above", clearance: 2.5 },
  { id: "phone", page: 9, y: 451, side: "below", clearance: 8 },
  { id: "d9a", page: 9, y: 451, side: "below", clearance: 6.5 },
  { id: "email", page: 9, y: 411, side: "below", clearance: 8 },
  { id: "d9b", page: 9, y: 377.5, side: "below", clearance: 6.5 },
] as const;
const streamOperators = /(?<!\S)q(?!\S)|(?<!\S)Q(?!\S)|(?<!\S)(-?(?:\d+(?:\.\d*)?|\.\d+))\s+g(?!\S)|(?<!\S)(-?(?:\d+(?:\.\d*)?|\.\d+))\s+(-?(?:\d+(?:\.\d*)?|\.\d+))\s+(-?(?:\d+(?:\.\d*)?|\.\d+))\s+rg(?!\S)|(?<!\S)BT\b[\s\S]*?\bET(?!\S)/g;

async function readTextObjects(bytes: Uint8Array): Promise<TextObject[]> {
  const pdf = await PDFDocument.load(bytes);
  const objects: TextObject[] = [];

  for (const [pageIndex, page] of pdf.getPages().entries()) {
    const entry = page.node.get(PDFName.of("Contents"));
    if (!entry) continue;
    const parts = entry instanceof PDFArray ? entry.asArray() : [entry];
    const stack: { fill: [number, number, number]; renderMode: number }[] = [];
    let fill: [number, number, number] = [0, 0, 0];
    let font: string | null = null;
    let size: number | null = null;
    let renderMode = 0;

    for (const part of parts) {
      const stream = part instanceof PDFRef ? pdf.context.lookup(part) : part;
      if (!(stream instanceof PDFRawStream)) continue;
      const content = Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");

      for (const match of content.matchAll(streamOperators)) {
        const token = match[0].trim();
        if (token === "q") {
          stack.push({ fill: [...fill], renderMode });
        } else if (token === "Q") {
          const restored = stack.pop();
          if (restored) {
            fill = restored.fill;
            renderMode = restored.renderMode;
          }
        } else if (token.endsWith(" rg")) {
          const values = token.slice(0, -3).trim().split(/\s+/).map(Number);
          fill = [values[0], values[1], values[2]];
        } else if (token.endsWith(" g")) {
          const gray = Number(token.slice(0, -2).trim());
          fill = [gray, gray, gray];
        } else {
          const body = token.slice(2, -2);
          const selectedFont = body.match(/\/([A-Za-z0-9]+)\s+([\d.]+)\s+Tf/);
          if (selectedFont) {
            font = selectedFont[1];
            size = Number(selectedFont[2]);
          }
          const selectedRenderMode = body.match(/([0-7])\s+Tr/);
          if (selectedRenderMode) renderMode = Number(selectedRenderMode[1]);
          const matrix = body.match(/1\s+0\s+0\s+1\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/);
          const shown = body.match(/\(((?:\\.|[^\\)])*)\)\s*Tj/);
          if (!matrix || !shown) continue;
          objects.push({
            page: pageIndex + 1,
            x: Number(matrix[1]),
            y: Number(matrix[2]),
            text: shown[1].replace(/\\([\\()])/g, "$1"),
            font,
            size,
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
  it(`keeps printed values clear of their background rules in the ${variant} asset`, async () => {
    const objects = await readTextObjects(await sourcePdf(signerCount));
    for (const rule of printedRules) {
      const placement = variants[variant].data.find((field) => field.id === rule.id);
      expect(placement).toBeDefined();
      const matches = objects.filter((object) => object.page === rule.page && object.text === placement!.tag);
      expect(matches, `printed field ${rule.id}`).toHaveLength(1);
      const baseline = matches[0].y;
      if (rule.side === "above") {
        expect.soft(baseline, `${rule.id} crosses its printed rule`).toBeGreaterThanOrEqual(rule.y + rule.clearance);
        expect.soft(baseline, `${rule.id} rises outside its line area`).toBeLessThanOrEqual(rule.y + 5);
      } else {
        expect.soft(baseline, `${rule.id} crosses its printed rule`).toBeLessThanOrEqual(rule.y - rule.clearance);
        expect.soft(baseline, `${rule.id} falls outside its line area`).toBeGreaterThanOrEqual(rule.y - 20);
      }
    }
  }, 60_000);

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

    expect(signature).toHaveLength(signerCount === 1 ? 9 : 18);
    expect(after).toHaveLength(before.length);

    for (const prior of before) {
      const matches = after.filter((object) =>
        object.page === prior.page && object.x === prior.x && object.y === prior.y,
      );
      expect(matches, `text object at ${prior.page}:${prior.x},${prior.y}`).toHaveLength(1);
      const current = matches[0];
      expect(current.font).toBe(prior.font);
      expect(current.size).toBe(prior.size);

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
});

it.each([
  ["remove", "missing"],
  ["duplicate", "duplicate"],
  ["extraText", "missing"],
  ["move", "missing"],
] as const)("fails closed when a signing marker is %s", async (change, label) => {
  const marker = variants.single.signature[0];
  const damaged = await alterSignatureMarker(1, marker, change);
  loadLorPdfMock.mockResolvedValue(damaged);

  const result = await buildPrefilledLorPdf(requestFor(1), new Date("2026-08-14T16:00:00Z"))
    .then(() => null, (error: unknown) => error);
  expect(result).toBeInstanceOf(Error);
  expect((result as Error).message).toMatch(new RegExp(`signing tag .* ${label}`));
});
