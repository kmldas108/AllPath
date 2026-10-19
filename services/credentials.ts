// Password hashing, on the device, with Web Crypto. PBKDF2-SHA256.
//
// Spec C7: passwords are never stored in the clear and never transmitted. There is no server
// side to this — the account list lives in localStorage and these hashes are all that is kept
// of a password. That is why the work factor matters even though the attacker would already
// need the device: a shared classroom tablet is exactly the threat model.

const ITERATIONS = 100_000;
const KEY_BITS = 256;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function newSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return toHex(salt.buffer);
}

async function derive(password: string, saltHex: string): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: fromHex(saltHex),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    KEY_BITS
  );
  return toHex(bits);
}

export async function hashPassword(
  password: string,
  salt: string = newSalt()
): Promise<{ salt: string; hash: string }> {
  return { salt, hash: await derive(password, salt) };
}

/** Constant-time-ish comparison. Both strings are fixed-length hex of our own making. */
export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string
): Promise<boolean> {
  const actual = await derive(password, salt);
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}
