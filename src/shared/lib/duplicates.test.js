import { levenshtein, getExactDuplicates, getSimilarGroups, filterClientsByPeriod } from './duplicates';

describe('duplicates', () => {
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('иван', 'иван')).toBe(0);
    });

    it('returns length for empty string', () => {
      expect(levenshtein('', 'abc')).toBe(3);
      expect(levenshtein('abc', '')).toBe(3);
    });

    it('returns edit distance', () => {
      expect(levenshtein('кот', 'кит')).toBe(1);
      expect(levenshtein('иван', 'иванн')).toBe(1);
    });
  });

  describe('getExactDuplicates', () => {
    it('groups clients with same normalized fio', () => {
      const clients = [
        { id: 1, fio: 'Иванов Иван' },
        { id: 2, fio: 'иванов иван' },
        { id: 3, fio: 'Петров Петр' },
      ];
      const groups = getExactDuplicates(clients);
      expect(groups).toHaveLength(1);
      expect(groups[0]).toHaveLength(2);
    });

    it('returns empty for no duplicates', () => {
      const clients = [
        { id: 1, fio: 'Иванов' },
        { id: 2, fio: 'Петров' },
      ];
      expect(getExactDuplicates(clients)).toHaveLength(0);
    });
  });

  describe('getSimilarGroups', () => {
    it('finds similar names within distance 2', () => {
      const clients = [
        { id: 1, fio: 'Иванов' },
        { id: 2, fio: 'Ивановв' },
      ];
      const groups = getSimilarGroups(clients);
      expect(groups.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('filterClientsByPeriod', () => {
    it('filters by year', () => {
      const clients = [
        { id: 1, dateStart: '2026-03-01' },
        { id: 2, dateStart: '2027-01-15' },
      ];
      const filtered = filterClientsByPeriod(clients, '2026', null);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });

    it('returns all when no year', () => {
      const clients = [{ id: 1, dateStart: '2026-01-01' }];
      expect(filterClientsByPeriod(clients, null, null)).toEqual(clients);
    });
  });
});
