import "server-only";

/** Read only the requested bytes. A server that ignores Range cannot turn a
 * signature check into an unbounded download or a cached private response. */
export function storageRangeReader(url: string, size: number, deadline = Date.now() + 210_000) {
  return async (start: number, end: number): Promise<Uint8Array> => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end >= size) {
      throw new Error("Invalid file range.");
    }
    const expected = end - start + 1;
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("File verification deadline exceeded.");
    const response = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(Math.min(15_000, remaining)),
    });
    const exactRange = response.status === 206 &&
      response.headers.get("content-range") === `bytes ${start}-${end}/${size}`;
    const wholeSmallFile = response.status === 200 && start === 0 && end === size - 1;
    if ((!exactRange && !wholeSmallFile) || !response.body) {
      await response.body?.cancel();
      throw new Error("File verification response unavailable.");
    }

    const bytes = new Uint8Array(expected);
    const reader = response.body.getReader();
    let written = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        if (written + chunk.value.byteLength > expected) {
          throw new Error("File verification range exceeded.");
        }
        bytes.set(chunk.value, written);
        written += chunk.value.byteLength;
      }
      if (written !== expected) throw new Error("File verification range incomplete.");
      return bytes;
    } finally {
      await reader.cancel();
      reader.releaseLock();
    }
  };
}
