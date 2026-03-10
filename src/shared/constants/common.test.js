import { formatMoney, isClientPaid, MONTHS, STATS_YEARS } from './common';

describe('common', () => {
  describe('formatMoney', () => {
    it('formats number with locale and "сом"', () => {
      expect(formatMoney(1000)).toMatch(/\d[\s\u00a0]*000\s*сом/);
      expect(formatMoney(150000)).toContain('сом');
    });

    it('returns "—" for null/undefined/NaN', () => {
      expect(formatMoney(null)).toBe('—');
      expect(formatMoney(undefined)).toBe('—');
      expect(formatMoney(NaN)).toBe('—');
    });

    it('rounds to integer', () => {
      expect(formatMoney(99.9)).toBe('100 сом');
    });
  });

  describe('isClientPaid', () => {
    it('returns true for paid client', () => {
      expect(isClientPaid({ paid: true })).toBe(true);
      expect(isClientPaid({ is_paid: true })).toBe(true);
      expect(isClientPaid({ paid_status: 'paid' })).toBe(true);
    });

    it('returns false for unpaid client', () => {
      expect(isClientPaid({ paid: false })).toBe(false);
      expect(isClientPaid({ is_paid: false })).toBe(false);
      expect(isClientPaid(null)).toBe(false);
    });
  });

  describe('MONTHS', () => {
    it('has 13 elements (empty + 12 months)', () => {
      expect(MONTHS).toHaveLength(13);
      expect(MONTHS[0]).toBe('');
      expect(MONTHS[1]).toBe('Январь');
    });
  });

  describe('STATS_YEARS', () => {
    it('contains 2026 and 2027', () => {
      expect(STATS_YEARS).toContain('2026');
      expect(STATS_YEARS).toContain('2027');
    });
  });
});
