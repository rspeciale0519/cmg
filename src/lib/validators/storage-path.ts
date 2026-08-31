const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Storage keys are generated names, never user-supplied file names or URLs. */
export function isDocumentStoragePath(storagePath: string, claimId: string): boolean {
  if (claimId.length !== 36 || !UUID.test(claimId)) return false;

  const segments = storagePath.split("/");
  // Reject empty and dot segments, URL delimiters, encoding, and control bytes.
  // Do not normalize a stored value into the name of a different object.
  if (segments.some((segment) =>
    !/^[A-Za-z0-9_-]/.test(segment) || /[^A-Za-z0-9._:-]/.test(segment),
  )) return false;

  if (segments[0] === "claims") {
    return segments.length >= 3 && segments[1] === claimId.toLowerCase();
  }
  return segments.length === 3 && segments[0] === "intake" &&
    segments[1].length === 36 && UUID.test(segments[1]);
}
