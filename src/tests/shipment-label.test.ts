import { describe, it, expect } from 'vitest';
import {
  generateLabelToken,
  hmacLabelToken,
  verifyLabelToken
} from '@/lib/shipment-label';

describe('shipment label token', () => {
  it('generates unique tokens and verifies hmac', () => {
    const t1 = generateLabelToken();
    const t2 = generateLabelToken();
    expect(t1).not.toEqual(t2);
    const h1 = hmacLabelToken(t1, 'secret');
    expect(verifyLabelToken(t1, h1, 'secret')).toBe(true);
    expect(verifyLabelToken(t2, h1, 'secret')).toBe(false);
  });
});
