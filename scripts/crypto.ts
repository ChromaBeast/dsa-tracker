import crypto from "node:crypto";
import { EncryptedPayload, ProgressData } from "../src/types.js";

export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

export function encryptPayload(dataObj: ProgressData, password: string): EncryptedPayload {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const jsonStr = JSON.stringify(dataObj);
  const ciphertextWithTag = Buffer.concat([
    cipher.update(jsonStr, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    encrypted: true,
    version: 1,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: ciphertextWithTag.toString("base64"),
  };
}

export function decryptPayload(encryptedObj: EncryptedPayload, password: string): ProgressData {
  const salt = Buffer.from(encryptedObj.salt, "base64");
  const iv = Buffer.from(encryptedObj.iv, "base64");
  const combined = Buffer.from(encryptedObj.ciphertext, "base64");
  if (combined.length < 16) throw new Error("Invalid ciphertext");

  const authTag = combined.subarray(combined.length - 16);
  const data = combined.subarray(0, combined.length - 16);

  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as ProgressData;
}
