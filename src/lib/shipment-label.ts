import crypto from 'crypto';

export function generateLabelToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

export function hmacLabelToken(
  token: string,
  secret = process.env.SHIPMENT_LABEL_HMAC_SECRET || ''
): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

export function verifyLabelToken(
  token: string,
  hmac: string,
  secret = process.env.SHIPMENT_LABEL_HMAC_SECRET || ''
): boolean {
  const calc = hmacLabelToken(token, secret);
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hmac));
}
