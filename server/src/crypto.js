import crypto from "crypto";

const ENC_ALGO = "aes-256-gcm";

function getKey(purpose) {
  const secret = process.env.JWT_SECRET || "dev-secret-change-me";
  return crypto.scryptSync(secret, purpose, 32);
}

export function encryptSecret(plain, purpose) {
  if (!plain) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENC_ALGO, getKey(purpose), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(blob, purpose) {
  if (!blob) return null;
  const buf = Buffer.from(blob, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ENC_ALGO, getKey(purpose), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}
