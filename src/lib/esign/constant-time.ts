import { timingSafeEqual } from "node:crypto";

/**
 * Node's constant-time buffer comparison, given a module of its own.
 *
 * The point is singularity: webhook verification has exactly one comparison
 * primitive, it lives here, and `signature.test.ts` can substitute this module
 * to demonstrate that the verdict for a well-formed candidate is *only* ever
 * this function's verdict — no `===`, no prefix check, no early exit hiding
 * beside it. `timingSafeEqual` throws on a length mismatch, so the length
 * guard belongs inside rather than at every call site.
 */
export function constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
