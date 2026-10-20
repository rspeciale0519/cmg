// @vitest-environment node
import { crc32, deflateRawSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { MAX_FILE_BYTES } from "@/lib/validators/files";
import { verifyFileSignature } from "./file-signatures";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ascii = (value: string) => Buffer.from(value, "ascii");
const requiredNames = ["[Content_Types].xml", "word/document.xml"];

function checkedReader(bytes: Uint8Array) {
  return vi.fn(async (start: number, end: number) => {
    expect(Number.isSafeInteger(start) && Number.isSafeInteger(end)).toBe(true);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThanOrEqual(start);
    expect(end).toBeLessThan(bytes.length);
    expect(end - start + 1).toBeLessThanOrEqual(65_536);
    return bytes.slice(start, end + 1);
  });
}

async function recognizes(mime: string, bytes: Uint8Array) {
  return verifyFileSignature(mime, bytes.length, checkedReader(bytes));
}

type ZipOptions = {
  names?: string[]; comment?: Buffer; deflated?: boolean; descriptor?: "signed" | "unsigned";
  zip64?: boolean; payloadBytes?: number; firstExtra?: Buffer;
};

// Build valid ZIP records and CRCs in memory. The verifier never imports a ZIP decoder.
function zip(options: ZipOptions = {}) {
  const names = options.names ?? requiredNames;
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  const localOffsets: number[] = [];
  const centralOffsets: number[] = [];
  let offset = 0;
  let centralLength = 0;
  for (const [index, name] of names.entries()) {
    const nameBytes = ascii(name);
    const payload = index === 0 && options.payloadBytes
      ? Buffer.alloc(options.payloadBytes, 0x78) : ascii(index === 0 ? "<Types/>" : "<document/>");
    const compressed = options.deflated ? deflateRawSync(payload) : payload;
    const crc = crc32(payload);
    const flags = 0x800 | (options.descriptor ? 8 : 0);
    const extra = options.zip64 ? Buffer.alloc(20) : (index === 0 ? options.firstExtra : undefined) ?? Buffer.alloc(0);
    if (options.zip64) {
      extra.writeUInt16LE(1);
      extra.writeUInt16LE(16, 2);
      extra.writeBigUInt64LE(BigInt(payload.length), 4);
      extra.writeBigUInt64LE(BigInt(compressed.length), 12);
    }
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(options.zip64 ? 45 : 20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(options.deflated ? 8 : 0, 8);
    local.writeUInt32LE(options.descriptor ? 0 : crc, 14);
    local.writeUInt32LE(options.zip64 ? 0xffffffff : options.descriptor ? 0 : compressed.length, 18);
    local.writeUInt32LE(options.zip64 ? 0xffffffff : options.descriptor ? 0 : payload.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(extra.length, 28);
    localOffsets.push(offset);
    localChunks.push(local, nameBytes, extra, compressed);
    const descriptorBytes = options.descriptor ? (options.zip64 ? 20 : 12) + (options.descriptor === "signed" ? 4 : 0) : 0;
    if (options.descriptor) {
      const descriptor = Buffer.alloc(descriptorBytes);
      const start = options.descriptor === "signed" ? 4 : 0;
      if (start) descriptor.writeUInt32LE(0x08074b50);
      descriptor.writeUInt32LE(crc, start);
      if (options.zip64) {
        descriptor.writeBigUInt64LE(BigInt(compressed.length), start + 4);
        descriptor.writeBigUInt64LE(BigInt(payload.length), start + 12);
      } else {
        descriptor.writeUInt32LE(compressed.length, start + 4);
        descriptor.writeUInt32LE(payload.length, start + 8);
      }
      localChunks.push(descriptor);
    }
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(options.zip64 ? 45 : 20, 4);
    central.writeUInt16LE(options.zip64 ? 45 : 20, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(options.deflated ? 8 : 0, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(options.zip64 ? 0xffffffff : compressed.length, 20);
    central.writeUInt32LE(options.zip64 ? 0xffffffff : payload.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt16LE(extra.length, 30);
    central.writeUInt32LE(offset, 42);
    centralOffsets.push(centralLength);
    centralChunks.push(central, nameBytes, extra);
    centralLength += central.length + nameBytes.length + extra.length;
    offset += local.length + nameBytes.length + extra.length + compressed.length + descriptorBytes;
  }
  const endRecords: Buffer[] = [];
  if (options.zip64) {
    const record = Buffer.alloc(56);
    record.writeUInt32LE(0x06064b50);
    record.writeBigUInt64LE(44n, 4);
    record.writeUInt16LE(45, 12);
    record.writeUInt16LE(45, 14);
    record.writeBigUInt64LE(BigInt(names.length), 24);
    record.writeBigUInt64LE(BigInt(names.length), 32);
    record.writeBigUInt64LE(BigInt(centralLength), 40);
    record.writeBigUInt64LE(BigInt(offset), 48);
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50);
    locator.writeBigUInt64LE(BigInt(offset + centralLength), 8);
    locator.writeUInt32LE(1, 16);
    endRecords.push(record, locator);
  }
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50);
  eocd.writeUInt16LE(options.zip64 ? 0xffff : names.length, 8);
  eocd.writeUInt16LE(options.zip64 ? 0xffff : names.length, 10);
  eocd.writeUInt32LE(options.zip64 ? 0xffffffff : centralLength, 12);
  eocd.writeUInt32LE(options.zip64 ? 0xffffffff : offset, 16);
  eocd.writeUInt16LE(options.comment?.length ?? 0, 20);
  const bytes = Buffer.concat([...localChunks, ...centralChunks, ...endRecords, eocd, options.comment ?? Buffer.alloc(0)]);
  return { bytes, localOffsets, centralOffsets: centralOffsets.map((value) => value + offset), directoryStart: offset,
    eocdOffset: bytes.length - 22 - (options.comment?.length ?? 0) };
}

function heif(major: string, compatible: string[] = [], extended = false) {
  const start = extended ? 16 : 8;
  const length = start + 8 + compatible.length * 4;
  const bytes = Buffer.alloc(length + 9);
  bytes.writeUInt32BE(extended ? 1 : length);
  bytes.write("ftyp", 4);
  if (extended) bytes.writeBigUInt64BE(BigInt(length), 8);
  bytes.write(major, start);
  compatible.forEach((brand, index) => bytes.write(brand, start + 8 + 4 * index));
  bytes.writeUInt32BE(9, length);
  bytes.write("mdat", length + 4);
  return bytes;
}

function webp(type: "VP8 " | "VP8L" | "VP8X") {
  const length = type === "VP8L" ? 5 : 10;
  const bytes = Buffer.alloc(20 + length + (length % 2));
  bytes.write("RIFF");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8);
  bytes.write(type, 12);
  bytes.writeUInt32LE(length, 16);
  if (type === "VP8L") bytes[20] = 0x2f;
  if (type === "VP8 ") {
    bytes.set([0x9d, 1, 0x2a], 23);
    bytes.writeUInt16LE(1, 26);
    bytes.writeUInt16LE(1, 28);
  }
  return bytes;
}

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRxkAAAAASUVORK5CYII=", "base64");

describe("verifyFileSignature", () => {
  it.each([
    ["application/pdf", ascii("%PDF-1.0\n")], ["application/pdf", ascii("%PDF-1.7\r\n")],
    ["application/pdf", ascii("%PDF-2.0\n")], ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0, 2, 0xff, 0xd9])],
    ["image/png", png], ...(["VP8 ", "VP8L", "VP8X"] as const).map((type) => ["image/webp", webp(type)]),
    ["image/heic", heif("heic")], ["image/heic", heif("mif1", ["heix"])],
    ["image/heif", heif("mif1")], ["image/heif", heif("mif2", [], true)],
  ] as [string, Buffer][])("recognizes %s headers", async (mime, bytes) => {
    expect(await recognizes(mime, bytes)).toBe(true);
  });

  it.each(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", DOCX])(
    "rejects other content declared as %s", async (mime) => {
      expect(await recognizes(mime, ascii("<html>not an accepted document</html>"))).toBe(false);
    },
  );

  it("rejects unsupported MIME types without reading content", async () => {
    const read = vi.fn();
    expect(await verifyFileSignature("application/zip", 100, read)).toBe(false);
    expect(read).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid sizes before a range read: %s", async (size) => {
      const read = vi.fn();
      expect(await verifyFileSignature("image/png", size, read)).toBe(false);
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["application/pdf", ascii("%PDF-1.7")], ["application/pdf", ascii("%PDF-9.9\n")],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])], ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
    ["image/png", png.subarray(0, 8)], ["image/webp", webp("VP8L").subarray(0, 20)],
    ["image/heic", heif("mif1")], ["image/heif", heif("isom", ["mp42"])],
  ] as [string, Buffer][])("rejects incomplete or mismatched %s signatures", async (mime, bytes) => {
    expect(await recognizes(mime, bytes)).toBe(false);
  });

  it("rejects invalid PNG header dimensions", async () => {
    const bytes = Buffer.from(png);
    bytes.writeUInt32BE(0, 16);
    expect(await recognizes("image/png", bytes)).toBe(false);
  });

  it("checks WEBP RIFF and chunk lengths", async () => {
    const bytes = webp("VP8L");
    bytes.writeUInt32LE(bytes.length, 4);
    expect(await recognizes("image/webp", bytes)).toBe(false);
    bytes.writeUInt32LE(bytes.length - 8, 4);
    bytes.writeUInt32LE(50, 16);
    expect(await recognizes("image/webp", bytes)).toBe(false);
  });

  it("rejects invalid HEIF box bounds and unsafe extended sizes", async () => {
    const bytes = heif("heic");
    bytes.writeUInt32BE(bytes.length + 4);
    expect(await recognizes("image/heic", bytes)).toBe(false);
    const extended = heif("heic", [], true);
    extended.writeBigUInt64BE(1n << 60n, 8);
    expect(await recognizes("image/heic", extended)).toBe(false);
  });

  it.each(["short", "oversized"])("rejects %s range results", async (kind) => {
    const bytes = ascii("%PDF-1.7\n");
    const read = vi.fn(async () => kind === "short" ? bytes.subarray(0, -1) : Buffer.concat([bytes, ascii("x")]));
    expect(await verifyFileSignature("application/pdf", bytes.length, read)).toBe(false);
  });

  it("preserves Storage read failures", async () => {
    const failure = new Error("Storage range request failed");
    await expect(verifyFileSignature("image/png", 100, async () => { throw failure; })).rejects.toBe(failure);
  });
});

describe("DOCX package signatures", () => {
  it.each([{}, { deflated: true }, { deflated: true, descriptor: "signed" },
    { descriptor: "unsigned" }, { zip64: true }, { zip64: true, deflated: true, descriptor: "signed" },
    { zip64: true, descriptor: "unsigned" }] satisfies ZipOptions[])("accepts supported ZIP records: %j", async (options) => {
    expect(await recognizes(DOCX, zip(options).bytes)).toBe(true);
  });

  it.each([["notes.txt", "word/document.xml"], ["[Content_Types].xml", "xl/workbook.xml"],
    ["[Content_Types].xml", "word/document.xml", "word/document.xml"]])(
    "requires each exact package member once: %j", async (...names) => {
      expect(await recognizes(DOCX, zip({ names }).bytes)).toBe(false);
    },
  );

  it("does not find required names inside a comment", async () => {
    const bytes = zip({ names: ["one.txt", "two.txt"], comment: ascii(requiredNames.join(" ")) }).bytes;
    expect(await recognizes(DOCX, bytes)).toBe(false);
  });

  it("accepts the maximum ZIP comment across range boundaries", async () => {
    const { bytes } = zip({ comment: Buffer.alloc(65_535, 0x7a), deflated: true });
    const read = checkedReader(bytes);
    expect(await verifyFileSignature(DOCX, bytes.length, read)).toBe(true);
    expect(read.mock.calls.some(([start, end]) => start <= 65_535 && end >= 65_535)).toBe(true);
  });

  it("accepts bounded unknown extra fields at the ZIP length limit", async () => {
    const extra = Buffer.alloc(65_535);
    extra.writeUInt16LE(0xbeef);
    extra.writeUInt16LE(extra.length - 4, 2);
    expect(await recognizes(DOCX, zip({ firstExtra: extra }).bytes)).toBe(true);
  });

  it("accepts files at the full 25 MiB allowance without reading their payloads", async () => {
    const overhead = zip({ payloadBytes: 1 }).bytes.length - 1;
    const { bytes } = zip({ payloadBytes: MAX_FILE_BYTES - overhead });
    const read = checkedReader(bytes);
    expect(bytes.length).toBe(MAX_FILE_BYTES);
    expect(await verifyFileSignature(DOCX, bytes.length, read)).toBe(true);
    expect(read.mock.calls.reduce((sum, [start, end]) => sum + end - start + 1, 0)).toBeLessThan(6 * 65_536);
  });

  it("streams a large directory without a small archive-entry limit", async () => {
    const names = [...requiredNames, ...Array.from({ length: 5_000 }, (_, index) => `word/media/image${index}.png`)];
    const { bytes } = zip({ names });
    const read = checkedReader(bytes);
    expect(await verifyFileSignature(DOCX, bytes.length, read)).toBe(true);
    expect(read.mock.calls.length).toBeLessThan(30);
  });

  it.each(["directory offset", "directory length", "entry count", "entry name length", "local offset", "compressed size",
    "local name", "local signature", "extra length", "CRC", "method", "encrypted", "disk"])(
    "rejects malformed ZIP %s", async (field) => {
      const archive = zip();
      const { bytes, eocdOffset, centralOffsets, directoryStart } = archive;
      const central = centralOffsets[0];
      if (field === "directory offset") bytes.writeUInt32LE(bytes.length + 1, eocdOffset + 16);
      if (field === "directory length") bytes.writeUInt32LE(1, eocdOffset + 12);
      if (field === "entry count") { bytes.writeUInt16LE(3, eocdOffset + 8); bytes.writeUInt16LE(3, eocdOffset + 10); }
      if (field === "entry name length") bytes.writeUInt16LE(65_535, central + 28);
      if (field === "local offset") bytes.writeUInt32LE(directoryStart - 1, central + 42);
      if (field === "compressed size") bytes.writeUInt32LE(bytes.length, central + 20);
      if (field === "local name") bytes[30] = 0x78;
      if (field === "local signature") bytes[0] = 0;
      if (field === "extra length") bytes.writeUInt16LE(65_535, 28);
      if (field === "CRC") bytes.writeUInt32LE(0, 14);
      if (field === "method") bytes.writeUInt16LE(12, central + 10);
      if (field === "encrypted") bytes.writeUInt16LE(1, central + 8);
      if (field === "disk") bytes.writeUInt16LE(1, central + 34);
      expect(await recognizes(DOCX, bytes)).toBe(false);
    },
  );

  it("rejects truncated extra fields and descriptor values", async () => {
    expect(await recognizes(DOCX, zip({ firstExtra: Buffer.from([2, 0, 4, 0, 1]) }).bytes)).toBe(false);
    const { bytes, localOffsets } = zip({ descriptor: "signed" });
    bytes.writeUInt32LE(0, localOffsets[1] - 4);
    expect(await recognizes(DOCX, bytes)).toBe(false);
  });

  it.each([1, 10, 22])("rejects a ZIP truncated by %i bytes", async (count) => {
    const bytes = zip().bytes;
    expect(await recognizes(DOCX, bytes.subarray(0, bytes.length - count))).toBe(false);
  });

  it("rejects trailing data after the declared ZIP comment", async () => {
    expect(await recognizes(DOCX, Buffer.concat([zip().bytes, ascii("trailer")]))).toBe(false);
  });

  it.each(["missing locator", "unsafe offset", "multiple disks", "wrong count", "unsupported record"])(
    "rejects malformed or unsupported ZIP64 %s", async (field) => {
      const { bytes, eocdOffset, directoryStart } = zip({ zip64: true });
      const locator = eocdOffset - 20;
      const record = locator - 56;
      if (field === "missing locator") bytes.writeUInt32LE(0, locator);
      if (field === "unsafe offset") bytes.writeBigUInt64LE(1n << 60n, locator + 8);
      if (field === "multiple disks") bytes.writeUInt32LE(2, locator + 16);
      if (field === "wrong count") bytes.writeBigUInt64LE(3n, record + 32);
      if (field === "unsupported record") bytes.writeBigUInt64LE(BigInt(directoryStart), record + 4);
      expect(await recognizes(DOCX, bytes)).toBe(false);
    },
  );
});
