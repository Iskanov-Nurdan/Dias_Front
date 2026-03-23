import { formatMoney, isClientPaid, isClientSubscriptionExpired, MONTHS, STATS_YEARS } from './common';

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

  describe('isClientSubscriptionExpired', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-03-23T12:00:00'));
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it('returns true when dateEnd is before today', () => {
      expect(isClientSubscriptionExpired({ dateEnd: '2026-03-22' })).toBe(true);
    });

    it('returns false when dateEnd is today', () => {
      expect(isClientSubscriptionExpired({ dateEnd: '2026-03-23' })).toBe(false);
    });

    it('returns false when dateEnd is in the future', () => {
      expect(isClientSubscriptionExpired({ dateEnd: '2026-03-24' })).toBe(false);
    });

    it('returns true when subscriptionExpired flag is true', () => {
      expect(isClientSubscriptionExpired({ subscriptionExpired: true })).toBe(true);
    });

    it('returns false when subscriptionExpired is false even if date would be past', () => {
      expect(isClientSubscriptionExpired({ subscriptionExpired: false, dateEnd: '2026-01-01' })).toBe(false);
    });

    it('returns false when no end date and no flag', () => {
      expect(isClientSubscriptionExpired({ dateStart: '2026-01-01' })).toBe(false);
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
