import path from "node:path";
import { globSync as glob, isDynamicPattern } from "tinyglobby";

// Next.js uses only globSync(pattern, { onlyDirectories: true }). Preserve
// fast-glob's static-directory and absolute-pattern behavior for that contract.
export function globSync(pattern, options) {
  if (typeof pattern !== "string" || !options || options.onlyDirectories !== true || Object.keys(options).length !== 1) {
    throw new TypeError("Review the Next.js root-directory glob contract before changing this adapter.");
  }
  // A single exclusion has no positive matches. Avoid walking its ancestors.
  if (pattern.startsWith("!") && !pattern.startsWith("!(")) return [];

  const originalCwd = process.cwd();
  const absolute = path.isAbsolute(pattern);
  let cwd = originalCwd;
  let searchPattern = pattern;
  if (absolute) {
    // Starting at the volume root lets tinyglobby select the static prefix,
    // instead of walking a common ancestor when the pattern is outside cwd.
    cwd = path.parse(pattern).root;
    if (pattern === cwd) searchPattern = ".";
  } else if (/^(?:\.\/+)*\.\.(?:\/|$)/.test(pattern)) {
    // Move only literal leading dot segments. Resolving the whole pattern
    // would also rewrite parent segments after wildcards and escaped literals.
    let leading;
    while ((leading = /^(\.\.?)(?:\/+|$)/.exec(searchPattern))) {
      cwd = path.resolve(cwd, leading[1]);
      searchPattern = searchPattern.slice(leading[0].length);
    }
    // Without a literal prefix, rebasing changes tinyglobby's negation and
    // zero-segment matching. Preserve its original behavior for those calls.
    const firstComponent = searchPattern.split("/")[0];
    if (!firstComponent || isDynamicPattern(firstComponent) || path.dirname(cwd) === cwd) {
      cwd = originalCwd;
      searchPattern = pattern;
    }
  }

  return glob(searchPattern, {
    cwd,
    onlyDirectories: true,
    expandDirectories: false,
    absolute,
  }).map((directory) => {
    if (!absolute && cwd !== originalCwd) {
      directory = path.relative(originalCwd, path.resolve(cwd, directory)).replace(/\\/g, "/") || ".";
    }
    // Keep filesystem roots intact; removing their slash changes their identity.
    return directory === path.parse(directory).root
      ? directory
      : directory.replace(/\/$/, "");
  });
}
