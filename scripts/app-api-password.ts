import { createHash, createHmac, pbkdf2Sync, randomBytes } from 'node:crypto';

const ITERATIONS = 4096;

const hmac = (key: Buffer, data: string): Buffer => createHmac('sha256', key).update(data).digest();

/**
 * The SCRAM-SHA-256 verifier PostgreSQL stores for a password (RFC 5802; the format of `pg_authid.rolpassword`).
 * Giving the server this instead of the plain text keeps the password out of the statement, and so out of the
 * database log. The server accepts a verifier as a ready-made password.
 */
export function scramVerifier(password: string, salt: Buffer = randomBytes(16)): string {
  const salted = pbkdf2Sync(password.normalize('NFKC'), salt, ITERATIONS, 32, 'sha256');
  const storedKey = createHash('sha256').update(hmac(salted, 'Client Key')).digest();
  const serverKey = hmac(salted, 'Server Key');
  return `SCRAM-SHA-256$${ITERATIONS}:${salt.toString('base64')}$${storedKey.toString('base64')}:${serverKey.toString('base64')}`;
}

/** The statement that gives the app's database login its password. Base64 has no quote, so nothing needs escaping. */
export function appApiPasswordStatement(password: string): string {
  return `ALTER ROLE app_api LOGIN PASSWORD '${scramVerifier(password)}'`;
}
