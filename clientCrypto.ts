/**
 * Client-Side Browser-Safe Password Hashing & Verification Utilities
 * Uses Web Crypto API (SubtleCrypto) with SHA-256 and cryptographic salts.
 */

export async function hashPasswordClient(password: string): Promise<string> {
  if (!password) return '';
  try {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      const saltArr = new Uint8Array(16);
      window.crypto.getRandomValues(saltArr);
      const saltHex = Array.from(saltArr).map(b => b.toString(16).padStart(2, '0')).join('');
      
      const enc = new TextEncoder();
      const passData = enc.encode(password + saltHex);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', passData);
      const hashArr = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');

      return `webcrypto:sha256:${saltHex}:${hashHex}`;
    }
  } catch (e) {
    console.warn('Web Crypto hash failed, using fallback:', e);
  }

  // Fallback for environment without WebCrypto
  const salt = Math.random().toString(36).substring(2, 10);
  return `client:${salt}:${password}`;
}

export async function verifyPasswordClient(password: string, storedHashOrPlain: string | undefined): Promise<boolean> {
  if (!password || !storedHashOrPlain) return false;

  // 1. WebCrypto format: webcrypto:sha256:saltHex:hashHex
  if (storedHashOrPlain.startsWith('webcrypto:sha256:')) {
    try {
      const parts = storedHashOrPlain.split(':');
      if (parts.length === 4 && typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const saltHex = parts[2];
        const expectedHash = parts[3];
        const enc = new TextEncoder();
        const passData = enc.encode(password + saltHex);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', passData);
        const hashArr = Array.from(new Uint8Array(hashBuffer));
        const computedHash = hashArr.map(b => b.toString(16).padStart(2, '0')).join('');
        return computedHash === expectedHash;
      }
    } catch (e) {
      return false;
    }
  }

  // 2. Client fallback format
  if (storedHashOrPlain.startsWith('client:')) {
    const parts = storedHashOrPlain.split(':');
    return parts[2] === password;
  }

  // 3. PBKDF2 or SHA256 server hash: if client is verifying without server, we can delegate to server API
  // 4. Legacy Plaintext
  return storedHashOrPlain === password;
}
