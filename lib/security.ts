import { timingSafeEqual } from 'node:crypto';

export function verifyAccessCode(value: unknown): boolean {
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected || typeof value !== 'string') return false;
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export function accessCodeFromRequest(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7);
  return request.headers.get('x-meowgent-access-code');
}
