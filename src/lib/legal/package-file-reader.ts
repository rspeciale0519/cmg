/** Bound memory to the reviewed file size, even if a remote response is wrong. */
export async function readPackageFile(response: Response, expectedSize: number, signal?: AbortSignal): Promise<Uint8Array> {
  if (!response.body) {
    throw new Error("A selected file is unavailable. No package was downloaded.");
  }
  const reader = response.body.getReader();
  let offset = 0; let complete = false;
  try {
    if (!response.ok || !Number.isSafeInteger(expectedSize) || expectedSize < 1) {
      throw new Error("A selected file is unavailable. No package was downloaded.");
    }
    const declared = response.headers.get("content-length");
    if (declared !== null && Number(declared) !== expectedSize) throw new Error("A selected file changed. Review the package again.");
    const bytes = new Uint8Array(expectedSize);
    while (true) {
      signal?.throwIfAborted();
      const chunk = await reader.read();
      signal?.throwIfAborted();
      if (chunk.done) break;
      if (offset + chunk.value.byteLength > expectedSize) throw new Error("A selected file changed. Review the package again.");
      bytes.set(chunk.value, offset); offset += chunk.value.byteLength;
    }
    if (offset !== expectedSize) throw new Error("A selected file was incomplete. Try this package part again.");
    complete = true;
    return bytes;
  } finally {
    if (!complete) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
