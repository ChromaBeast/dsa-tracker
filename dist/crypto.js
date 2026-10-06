export function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}
export async function deriveKey(password, saltBytes) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({
        name: "PBKDF2",
        salt: saltBytes,
        iterations: 100000,
        hash: "SHA-256",
    }, baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
export function isEncrypted(data) {
    return "encrypted" in data && data.encrypted === true;
}
export async function decryptProgress(data, password) {
    if (!isEncrypted(data)) {
        return data;
    }
    const salt = base64ToUint8Array(data.salt);
    const iv = base64ToUint8Array(data.iv);
    const ciphertextWithTag = base64ToUint8Array(data.ciphertext);
    const key = await deriveKey(password, salt);
    const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertextWithTag);
    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decryptedBuffer));
}
