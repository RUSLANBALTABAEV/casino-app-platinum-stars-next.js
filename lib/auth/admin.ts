export const ADMIN_SESSION_COOKIE = 'admin_session';

export function getAdminSecret(): string {
  return process.env.ADMIN_SECRET ?? '';
}

async function hashWithWebCrypto(secret: string, cryptoObj: Crypto): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const digest = await cryptoObj.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export async function hashAdminSecret(secret: string): Promise<string> {
  const webCrypto = globalThis.crypto;
  return hashWithWebCrypto(secret, webCrypto);
}

export async function isValidAdminSession(
  cookieValue: string | undefined | null
): Promise<boolean> {
  const secret = getAdminSecret();
  if (!secret) return true;
  if (!cookieValue) return false;
  const expected = await hashAdminSecret(secret);
  return cookieValue === expected;
}

export async function verifyAdminSecret(input: string): Promise<boolean> {
  const adminSecret = getAdminSecret();
  if (input.length !== adminSecret.length) return false;
  const inputHash = await hashAdminSecret(input);
  const secretHash = await hashAdminSecret(adminSecret);
  return inputHash === secretHash;
}
