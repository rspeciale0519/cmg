import path from "node:path";
import { globSync as glob } from "tinyglobby";

// Next.js uses only globSync(pattern, { onlyDirectories: true }). Preserve
// fast-glob's static-directory and absolute-pattern behavior for that contract.
export function globSync(pattern, options) {
  if (typeof pattern !== "string" || !options || options.onlyDirectories !== true || Object.keys(options).length !== 1) {
    throw new TypeError("Review the Next.js root-directory glob contract before changing this adapter.");
  }
  return glob(pattern, {
    onlyDirectories: true,
    expandDirectories: false,
    absolute: path.isAbsolute(pattern),
  }).map((directory) => {
    // Keep filesystem roots intact; removing their slash changes their identity.
    return directory === path.parse(directory).root
      ? directory
      : directory.replace(/\/$/, "");
  });
}
