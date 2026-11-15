import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
function keyBytes(encoded: string): Buffer {
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error("AIRTABLE_KEY_INVALID");
  return key;
}
export function sealSecret(value: string, context: string, encodedKey: string): string {
  const nonce = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", keyBytes(encodedKey), nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function openSecret(value: string, context: string, encodedKey: string): string {
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("AIRTABLE_CIPHERTEXT_INVALID");
  const nonce = Buffer.from(parts[1], "base64url"), tag = Buffer.from(parts[2], "base64url");
  if (nonce.length !== 12 || tag.length !== 16) throw new Error("AIRTABLE_CIPHERTEXT_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(encodedKey), nonce);
  decipher.setAAD(Buffer.from(context)); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8");
}
