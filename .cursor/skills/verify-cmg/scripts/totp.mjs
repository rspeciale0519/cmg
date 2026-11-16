#!/usr/bin/env node
/**
 * RFC 6238 TOTP (SHA-1, 30s, 6 digits) from a base32 secret.
 * Usage: node totp.mjs <base32-secret>
 * Used by the staff-login journey to finish the real /mfa enrollment page.
 */
import { createHmac } from "node:crypto";

const secret = process.argv[2];
if (!secret) {
  console.error("usage: node totp.mjs <base32-secret>");
  process.exit(2);
}

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleaned = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const ch of cleaned) {
    const val = alphabet.indexOf(ch);
    if (val < 0) continue;
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(base32, step = 30, digits = 6) {
  const key = base32Decode(base32);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(code).padStart(digits, "0");
}

process.stdout.write(totp(secret));
