import { describe, expect, it } from 'vitest';
import { Decimal } from './index';

describe('domain scaffold', () => {
  it('RNF-001: usa Decimal com precisão 28 (ADR-0003)', () => {
    expect(Decimal.precision).toBe(28);
    expect(new Decimal('0.1').plus('0.2').toString()).toBe('0.3');
  });
});
