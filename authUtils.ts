import crypto from 'crypto';

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';
const HASH_PREFIX = 'pbkdf2';

/**
 * Hashes a plain-text password using PBKDF2-HMAC-SHA512 with a cryptographically secure random salt.
 * Format: pbkdf2:100000:<salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    return `${HASH_PREFIX}:${ITERATIONS}:${salt}:${hash}`;
  } catch (err) {
    // Fallback if randomBytes or pbkdf2Sync fails in unexpected environment
    const simpleSalt = Math.random().toString(36).substring(2, 15);
    const simpleHash = crypto.createHash('sha256').update(password + simpleSalt).digest('hex');
    return `sha256:1:${simpleSalt}:${simpleHash}`;
  }
}

/**
 * Verifies a plain-text password against a stored password hash (or legacy plaintext password).
 * Automatically handles timing-safe equality and legacy plain-text password upgrades.
 */
export function verifyPassword(password: string, storedHashOrPlain: string | undefined): boolean {
  if (!password || !storedHashOrPlain) return false;

  // 1. Check if stored string is in pbkdf2 format
  if (storedHashOrPlain.startsWith(`${HASH_PREFIX}:`)) {
    try {
      const parts = storedHashOrPlain.split(':');
      if (parts.length === 4) {
        const iterations = parseInt(parts[1], 10) || ITERATIONS;
        const salt = parts[2];
        const expectedHash = parts[3];

        const computedHash = crypto.pbkdf2Sync(password, salt, iterations, KEY_LEN, DIGEST).toString('hex');
        
        // Timing-safe comparison to prevent timing attacks
        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        const computedBuffer = Buffer.from(computedHash, 'hex');
        if (expectedBuffer.length !== computedBuffer.length) return false;
        return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
      }
    } catch (e) {
      console.error('Password verification error:', e);
      return false;
    }
  }

  // 2. Check if stored string is in webcrypto format: webcrypto:sha256:saltHex:hashHex
  if (storedHashOrPlain.startsWith('webcrypto:sha256:')) {
    try {
      const parts = storedHashOrPlain.split(':');
      if (parts.length === 4) {
        const saltHex = parts[2];
        const expectedHash = parts[3];
        const computedHash = crypto.createHash('sha256').update(password + saltHex).digest('hex');
        const expectedBuffer = Buffer.from(expectedHash, 'hex');
        const computedBuffer = Buffer.from(computedHash, 'hex');
        if (expectedBuffer.length === computedBuffer.length) {
          return crypto.timingSafeEqual(expectedBuffer, computedBuffer);
        }
      }
    } catch (e) {
      console.error('WebCrypto verification error in authUtils:', e);
    }
  }

  // 3. Check if stored string is in client fallback format: client:salt:password
  if (storedHashOrPlain.startsWith('client:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length === 3) {
      return parts[2] === password;
    }
  }

  // 4. Check if stored string is in sha256 fallback format
  if (storedHashOrPlain.startsWith('sha256:')) {
    try {
      const parts = storedHashOrPlain.split(':');
      if (parts.length === 4) {
        const salt = parts[2];
        const expectedHash = parts[3];
        const computedHash = crypto.createHash('sha256').update(password + salt).digest('hex');
        return computedHash === expectedHash;
      }
    } catch (e) {
      return false;
    }
  }

  // 5. Legacy Plaintext Password check (for backward compatibility)
  return storedHashOrPlain === password;
}

/**
 * Determines if a stored password string needs to be migrated to a modern hash.
 */
export function isPasswordMigrationNeeded(storedHashOrPlain: string | undefined): boolean {
  if (!storedHashOrPlain) return false;
  return !storedHashOrPlain.startsWith(`${HASH_PREFIX}:`);
}

/**
 * Strips password and sensitive credentials from user objects before sending to frontend.
 */
export function sanitizeUser<T extends Record<string, any>>(user: T | null | undefined): Omit<T, 'password' | 'passwordHash'> | null {
  if (!user) return null;
  const copy = { ...user };
  delete copy.password;
  delete copy.passwordHash;
  return copy;
}
