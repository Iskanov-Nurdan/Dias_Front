/**
 * Расстояние Левенштейна между двумя строками
 */
export const levenshtein = (a, b) => {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const curr = [i + 1];
    for (let j = 0; j < b.length; j++) {
      curr[j + 1] = a[i] === b[j] ? prev[j] : 1 + Math.min(prev[j + 1], curr[j], prev[j]);
    }
    prev = curr;
  }
  return prev[b.length];
};

const normName = (fio) => (fio || '').trim().toLowerCase();

/** Точные дубликаты — одинаковое ФИО */
export const getExactDuplicates = (clients) => {
  const map = {};
  clients.forEach((c) => {
    const key = normName(c.fio);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(c);
  });
  return Object.values(map).filter((g) => g.length > 1).sort((a, b) => b.length - a.length);
};

/** Похожие имена — расстояние 1–2 символа, исключая точные совпадения */
export const getSimilarGroups = (clients) => {
  const items = clients.map((c, idx) => ({ ...c, _idx: idx, _norm: normName(c.fio) })).filter((c) => c._norm);
  const visited = new Set();
  const groups = [];

  for (let i = 0; i < items.length; i++) {
    if (visited.has(i)) continue;
    const a = items[i]._norm;
    const group = [items[i]];

    for (let j = i + 1; j < items.length; j++) {
      if (visited.has(j)) continue;
      const b = items[j]._norm;
      if (a === b) continue;
      const dist = levenshtein(a, b);
      if (dist >= 1 && dist <= 2) {
        group.push(items[j]);
        visited.add(j);
      }
    }

    if (group.length > 1) {
      visited.add(i);
      groups.push(group);
    }
  }

  return groups.sort((a, b) => b.length - a.length);
};

/** Фильтрация клиентов по году/месяцу/дню (по dateStart) */
export const filterClientsByPeriod = (clients, year, month, day) => {
  if (!year) return clients;
  const y = Number(year);
  const m = month ? Number(month) : null;
  const d0 = day ? Number(day) : null;
  return clients.filter((c) => {
    const ds = c.dateStart ?? c.date_start;
    if (!ds) return false;
    const d = new Date(ds);
    if (isNaN(d.getTime())) return false;
    if (d.getFullYear() !== y) return false;
    if (m != null && d.getMonth() + 1 !== m) return false;
    if (d0 != null && d.getDate() !== d0) return false;
    return true;
  });
};
