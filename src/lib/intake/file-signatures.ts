type RangeReader = (start: number, endInclusive: number) => Promise<Uint8Array>;
type ReadBytes = (start: number, length: number) => Promise<Uint8Array | null>;

const RANGE_BYTES = 65_536;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOCX_PARTS = ["[Content_Types].xml", "word/document.xml"];
const HEIC_BRANDS = new Set(["heic", "heix", "heim", "heis", "hevc", "hevx", "hevm", "hevs"]);
const HEIF_BRANDS = new Set([...HEIC_BRANDS, "mif1", "mif2", "msf1"]);
const view = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
const uint16 = (bytes: Uint8Array, offset: number) => view(bytes).getUint16(offset, true);
const uint32 = (bytes: Uint8Array, offset: number) => view(bytes).getUint32(offset, true);
const uint64 = (bytes: Uint8Array, offset: number, littleEndian = true) => {
  const value = view(bytes).getBigUint64(offset, littleEndian);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : -1;
};
const textAt = (bytes: Uint8Array, offset: number, length: number) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

// One cached window avoids one Storage request per central-directory entry.
// Bounds are checked before each read; short or oversized responses fail closed.
function bufferedReader(size: number, readRange: RangeReader): ReadBytes {
  let cacheStart = -1;
  let cache: Uint8Array<ArrayBufferLike> = new Uint8Array();
  return async (start, length) => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) ||
        start < 0 || length < 0 || length > RANGE_BYTES + 22 || start + length > size) return null;
    const result = new Uint8Array(length);
    let copied = 0;
    while (copied < length) {
      const position = start + copied;
      if (position < cacheStart || position >= cacheStart + cache.length) {
        cacheStart = Math.floor(position / RANGE_BYTES) * RANGE_BYTES;
        const end = Math.min(size, cacheStart + RANGE_BYTES) - 1;
        cache = await readRange(cacheStart, end);
        if (cache.length !== end - cacheStart + 1) return null;
      }
      const offset = position - cacheStart;
      const take = Math.min(length - copied, cache.length - offset);
      result.set(cache.subarray(offset, offset + take), copied);
      copied += take;
    }
    return result;
  };
}

type ZipEntry = {
  flags: number; method: number; crc: number;
  compressed: number; uncompressed: number; offset: number; disk: number;
  zip64: boolean;
};

// PKWARE APPNOTE 4.5.3: ZIP64 values appear in a fixed order, only for sentinel fields.
// Unknown extra fields are skipped after validating their lengths.
function zipExtra(extra: Uint8Array, entry: ZipEntry, local = false): ZipEntry | null {
  const result = { ...entry };
  const fields: readonly ("uncompressed" | "compressed" | "offset" | "disk")[] = local
    ? ["uncompressed", "compressed"] : ["uncompressed", "compressed", "offset", "disk"];
  const required = fields.filter((field) => entry[field] === (field === "disk" ? 0xffff : 0xffffffff));
  let found = false;
  for (let position = 0; position < extra.length;) {
    if (position + 4 > extra.length) return null;
    const id = uint16(extra, position);
    const length = uint16(extra, position + 2);
    position += 4;
    if (position + length > extra.length) return null;
    if (id === 1) {
      if (found) return null;
      found = true;
      const present = local ? fields : required;
      const expected = present.reduce((sum, field) => sum + (field === "disk" ? 4 : 8), 0);
      if (length !== expected) return null;
      let cursor = position;
      for (const field of present) {
        result[field] = field === "disk" ? uint32(extra, cursor) : uint64(extra, cursor);
        if (result[field] < 0) return null;
        cursor += field === "disk" ? 4 : 8;
      }
      result.zip64 = true;
    }
    position += length;
  }
  return required.length > 0 && !found ? null : result;
}

async function zipDirectory(read: ReadBytes, size: number) {
  const tailStart = Math.max(0, size - 65_557); // EOCD plus the maximum ZIP comment.
  const tail = await read(tailStart, size - tailStart);
  if (!tail) return null;
  let position = tail.length - 22;
  for (; position >= 0; position--) {
    if (uint32(tail, position) === 0x06054b50 &&
        position + 22 + uint16(tail, position + 20) === tail.length) break;
  }
  if (position < 0 || uint16(tail, position + 4) !== 0 || uint16(tail, position + 6) !== 0) return null;
  const eocd = tail.subarray(position, position + 22);
  let count = uint16(eocd, 10);
  let length = uint32(eocd, 12);
  let offset = uint32(eocd, 16);
  let end = tailStart + position;
  const locator = end >= 20 ? await read(end - 20, 20) : null;
  if (locator && uint32(locator, 0) === 0x07064b50) {
    if (uint32(locator, 4) !== 0 || uint32(locator, 16) !== 1) return null;
    const zip64Offset = uint64(locator, 8);
    const record = await read(zip64Offset, 56);
    // Only the ordinary, single-disk ZIP64 end record is supported.
    if (!record || uint32(record, 0) !== 0x06064b50 || uint64(record, 4) !== 44 ||
        zip64Offset + 56 !== end - 20 || uint16(record, 14) !== 45 ||
        uint32(record, 16) !== 0 || uint32(record, 20) !== 0) return null;
    const count64 = uint64(record, 32);
    const length64 = uint64(record, 40);
    const offset64 = uint64(record, 48);
    if (count64 < 0 || length64 < 0 || offset64 < 0 || uint64(record, 24) !== count64 ||
        (count !== 0xffff && count !== count64) ||
        (uint16(eocd, 8) !== 0xffff && uint16(eocd, 8) !== count64) ||
        (length !== 0xffffffff && length !== length64) ||
        (offset !== 0xffffffff && offset !== offset64)) return null;
    count = count64;
    length = length64;
    offset = offset64;
    end = zip64Offset;
  } else if (count === 0xffff || length === 0xffffffff || offset === 0xffffffff ||
             uint16(eocd, 8) !== count) return null;
  if (count < 2 || count * 46 > length || offset < 30 || offset + length !== end) return null;
  return { count, offset, end };
}

async function verifyZipPart(read: ReadBytes, entry: ZipEntry, name: string, directoryStart: number) {
  const header = await read(entry.offset, 30);
  if (!header || uint32(header, 0) !== 0x04034b50 || uint16(header, 4) > 45 ||
      uint16(header, 6) !== entry.flags || uint16(header, 8) !== entry.method ||
      uint16(header, 26) !== name.length) return false;
  const extraLength = uint16(header, 28);
  const dataStart = entry.offset + 30 + name.length + extraLength;
  const dataEnd = dataStart + entry.compressed;
  if (dataEnd > directoryStart) return false;
  const localName = await read(entry.offset + 30, name.length);
  const extra = await read(entry.offset + 30 + name.length, extraLength);
  if (!localName || textAt(localName, 0, name.length) !== name || !extra) return false;
  const local = zipExtra(extra, {
    ...entry, crc: uint32(header, 14), compressed: uint32(header, 18),
    uncompressed: uint32(header, 22), zip64: false,
  }, true);
  if (!local) return false;
  if ((entry.flags & 8) === 0) {
    return local.crc === entry.crc && local.compressed === entry.compressed &&
      local.uncompressed === entry.uncompressed;
  }
  if ((local.crc !== 0 && local.crc !== entry.crc) ||
      (local.compressed !== 0 && local.compressed !== entry.compressed) ||
      (local.uncompressed !== 0 && local.uncompressed !== entry.uncompressed)) return false;
  const signature = await read(dataEnd, 4);
  if (!signature) return false;
  const descriptorStart = dataEnd + (uint32(signature, 0) === 0x08074b50 ? 4 : 0);
  const use64 = local.zip64 || entry.zip64;
  const descriptorLength = use64 ? 20 : 12;
  if (descriptorStart + descriptorLength > directoryStart) return false;
  const descriptor = await read(descriptorStart, descriptorLength);
  if (!descriptor || uint32(descriptor, 0) !== entry.crc) return false;
  return (use64 ? uint64(descriptor, 4) : uint32(descriptor, 4)) === entry.compressed &&
    (use64 ? uint64(descriptor, 12) : uint32(descriptor, 8)) === entry.uncompressed;
}

async function verifyDocx(read: ReadBytes, size: number): Promise<boolean> {
  const first = await read(0, 4);
  if (!first || uint32(first, 0) !== 0x04034b50) return false;
  const directory = await zipDirectory(read, size);
  if (!directory) return false;
  const parts = new Map<string, ZipEntry>();
  let position = directory.offset;
  for (let index = 0; index < directory.count; index++) {
    if (position + 46 > directory.end) return false;
    const header = await read(position, 46);
    if (!header || uint32(header, 0) !== 0x02014b50 || uint16(header, 6) > 45) return false;
    const flags = uint16(header, 8);
    const method = uint16(header, 10);
    const nameLength = uint16(header, 28);
    const extraLength = uint16(header, 30);
    const end = position + 46 + nameLength + extraLength + uint16(header, 32);
    // OPC uses stored or deflated members. Encryption and other ZIP features are unsupported.
    if ((flags & ~0x080e) !== 0 || (method !== 0 && method !== 8) || nameLength === 0 || end > directory.end) return false;
    const extra = await read(position + 46 + nameLength, extraLength);
    if (!extra) return false;
    const entry = zipExtra(extra, {
      flags, method, crc: uint32(header, 16), compressed: uint32(header, 20),
      uncompressed: uint32(header, 24), offset: uint32(header, 42), disk: uint16(header, 34), zip64: false,
    });
    if (!entry || entry.disk !== 0 || entry.offset + 30 + nameLength + entry.compressed > directory.offset ||
        (method === 0 && entry.compressed !== entry.uncompressed)) return false;
    if (DOCX_PARTS.some((part) => part.length === nameLength)) {
      const nameBytes = await read(position + 46, nameLength);
      if (!nameBytes) return false;
      const name = textAt(nameBytes, 0, nameLength);
      if (DOCX_PARTS.includes(name)) {
        if (parts.has(name) || entry.compressed === 0 || entry.uncompressed === 0) return false;
        parts.set(name, entry);
      }
    }
    position = end;
  }
  if (position !== directory.end) {
    const signature = await read(position, 6);
    if (!signature || uint32(signature, 0) !== 0x05054b50 ||
        position + 6 + uint16(signature, 4) !== directory.end) return false;
  }
  if (parts.size !== DOCX_PARTS.length) return false;
  for (const [name, entry] of parts) {
    if (!await verifyZipPart(read, entry, name, directory.offset)) return false;
  }
  return true;
}

async function verifyHeif(read: ReadBytes, size: number, mime: string) {
  const header = await read(0, 16);
  if (!header || textAt(header, 4, 4) !== "ftyp") return false;
  const initialLength = view(header).getUint32(0);
  const extended = initialLength === 1;
  const length = extended ? uint64(header, 8, false) : initialLength;
  const payloadStart = extended ? 16 : 8;
  if (length < payloadStart + 8 || length >= size || (length - payloadStart) % 4 !== 0) return false;
  const brands = mime === "image/heic" ? HEIC_BRANDS : HEIF_BRANDS;
  let found = false;
  for (let position = payloadStart; position < length;) {
    const take = Math.min(RANGE_BYTES, length - position);
    const bytes = await read(position, take);
    if (!bytes) return false;
    for (let offset = 0; offset < take; offset += 4) {
      if (position + offset !== payloadStart + 4 && brands.has(textAt(bytes, offset, 4))) found = true;
    }
    position += take;
  }
  return found;
}

async function verifyWebp(read: ReadBytes, size: number) {
  const header = await read(0, 20);
  if (!header || textAt(header, 0, 4) !== "RIFF" || textAt(header, 8, 4) !== "WEBP" ||
      uint32(header, 4) !== size - 8 || size % 2 !== 0) return false;
  const type = textAt(header, 12, 4);
  const length = uint32(header, 16);
  const needed = type === "VP8L" ? 5 : 10;
  if (!["VP8 ", "VP8L", "VP8X"].includes(type) || length < needed ||
      20 + length + (length % 2) > size) return false;
  const payload = await read(20, needed);
  if (!payload) return false;
  if (type === "VP8L") return payload[0] === 0x2f && payload[4] >> 5 === 0;
  if (type === "VP8X") return length === 10 && (payload[0] & 0xc1) === 0 &&
    payload[1] === 0 && payload[2] === 0 && payload[3] === 0;
  return (payload[0] & 1) === 0 && payload[3] === 0x9d && payload[4] === 1 && payload[5] === 0x2a &&
    (uint16(payload, 6) & 0x3fff) > 0 && (uint16(payload, 8) & 0x3fff) > 0;
}

/**
 * Recognize supported headers and DOCX package metadata without decoding content.
 * This is not malware scanning, document validation, or an archive extraction API.
 * The caller must enforce MIME/size limits and provide one immutable object's bytes.
 * Storage read errors propagate; malformed data and incomplete range results return false.
 */
export async function verifyFileSignature(mime: string, size: number, readRange: RangeReader): Promise<boolean> {
  if (!Number.isSafeInteger(size) || size < 1) return false;
  const read = bufferedReader(size, readRange);
  if (mime === DOCX_MIME) return verifyDocx(read, size);
  if (mime === "image/heic" || mime === "image/heif") return verifyHeif(read, size, mime);
  if (mime === "image/webp") return verifyWebp(read, size);
  if (mime === "application/pdf") {
    const header = await read(0, 9);
    return !!header && textAt(header, 0, 5) === "%PDF-" && header[6] === 0x2e &&
      ((header[5] === 0x31 && header[7] >= 0x30 && header[7] <= 0x37) ||
       (header[5] === 0x32 && header[7] === 0x30)) && (header[8] === 0x0a || header[8] === 0x0d);
  }
  if (mime === "image/jpeg") {
    const header = await read(0, 4);
    return !!header && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff &&
      header[3] >= 0xc0 && header[3] <= 0xfe && header[3] !== 0xd8 && header[3] !== 0xd9;
  }
  if (mime === "image/png") {
    const header = await read(0, 33);
    return !!header && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => header[index] === byte) &&
      view(header).getUint32(8) === 13 && textAt(header, 12, 4) === "IHDR" &&
      view(header).getUint32(16) > 0 && view(header).getUint32(20) > 0;
  }
  return false;
}
