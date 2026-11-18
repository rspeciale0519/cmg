import { PDFDocument, StandardFonts } from "pdf-lib";

/** Break long words by Unicode code point, without silently dropping text. */
export function wrapSummaryLine(text: string, width: number, measure: (value: string) => number): string[] {
  if (!text) return [""];
  const lines: string[] = [];
  let current = "";
  for (const character of Array.from(text)) {
    if (current && measure(current + character) > width) {
      const space = current.lastIndexOf(" ");
      if (space > current.length / 2) {
        lines.push(current.slice(0, space));
        current = current.slice(space + 1) + character;
      } else {
        lines.push(current); current = character;
      }
    } else current += character;
  }
  if (current) lines.push(current);
  return lines;
}

/** Normal text remains searchable. Non-WinAnsi pages use the browser's Unicode
 * renderer; the package also contains the exact accessible UTF-8 summary. */
export async function createPackageSummaryPdf(text: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("CMG claim handoff summary");
  pdf.setCreator("CMG Property Solutions");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let standardFont = true;
  try { font.encodeText(text.replace(/[\r\n\t]/g, " ")); } catch { standardFont = false; }
  const width = 612; const height = 792; const margin = 44; const size = 11; const step = 16;
  if (standardFont) {
    const lines = text.replace(/\r\n/g, "\n").split("\n").flatMap(line =>
      wrapSummaryLine(line.replace(/\t/g, "    "), width - margin * 2, value => font.widthOfTextAtSize(value, size)));
    const perPage = Math.floor((height - margin * 2) / step);
    for (let offset = 0; offset < lines.length; offset += perPage) {
      const page = pdf.addPage([width, height]);
      lines.slice(offset, offset + perPage).forEach((line, index) =>
        page.drawText(line, { x: margin, y: height - margin - size - index * step, size, font }));
    }
  } else {
    if (typeof document === "undefined") throw new Error("Prepare this summary in your browser.");
    const canvas = document.createElement("canvas");
    const scale = 2; canvas.width = width * scale; canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot render the summary. Try another supported browser.");
    const setFont = () => { context.font = `${size * scale}px Arial, sans-serif`; context.textBaseline = "top"; };
    setFont();
    const lines = text.replace(/\r\n/g, "\n").split("\n").flatMap(line =>
      wrapSummaryLine(line.replace(/\t/g, "    "), (width - margin * 2) * scale, value => context.measureText(value).width));
    const perPage = Math.floor((height - margin * 2) / step);
    for (let offset = 0; offset < lines.length; offset += perPage) {
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      setFont(); context.fillStyle = "black";
      lines.slice(offset, offset + perPage).forEach((line, index) =>
        context.fillText(line, margin * scale, (margin + index * step) * scale));
      const image = await pdf.embedPng(canvas.toDataURL("image/png"));
      pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
    }
    canvas.width = 0; canvas.height = 0;
  }
  return pdf.save();
}
