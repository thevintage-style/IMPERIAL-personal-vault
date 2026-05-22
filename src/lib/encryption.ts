// Web Crypto API AES-256 GCM Client Encryption Utilities

const PBKDF2_SALT = "UPSC_PERSONAL_VAULT_SALT_2026";

async function getCryptoKey(passphrase: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );
  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(PBKDF2_SALT),
      iterations: 50000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts cleartext with a PBKDF2derived AES key unique to user-phrase (e.g. UID)
 */
export async function encryptText(text: string, passphrase: string): Promise<string> {
  if (!text || text.trim() === "") return "";
  try {
    const key = await getCryptoKey(passphrase);
    const encoder = new TextEncoder();
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit standard IV
    const encryptedRaw = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encoder.encode(text)
    );
    
    // Combine standard IV and ciphertext
    const combined = new Uint8Array(iv.byteLength + encryptedRaw.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encryptedRaw), iv.byteLength);
    
    const base64Str = arrayBufferToBase64(combined.buffer);
    return `ENC:${base64Str}`;
  } catch (error) {
    console.error("Client Encryption failed. Storing plaintext fallback safely:", error);
    return text;
  }
}

/**
 * Decrypts a secure base64 standard string with the user key.
 */
export async function decryptText(encryptedText: string, passphrase: string): Promise<string> {
  if (!encryptedText) return "";
  if (!encryptedText.startsWith("ENC:")) {
    return encryptedText; // Legacy or seed plaintexts bypass
  }
  try {
    const cipherText = encryptedText.substring(4);
    const combined = base64ToArrayBuffer(cipherText);
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    const key = await getCryptoKey(passphrase);
    const decoder = new TextDecoder();
    const decryptedRaw = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      encryptedData
    );
    return decoder.decode(decryptedRaw);
  } catch (error) {
    console.warn("Client Decryption failed. Key mismatch or data compromised.", error);
    return "🔐 [Encrypted Content - Decryption Key Unavailable]";
  }
}
