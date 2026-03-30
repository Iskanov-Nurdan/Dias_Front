/** Дни недели: 1 = понедельник … 7 = воскресенье (ISO 8601). */

export const WEEKDAYS = [
  { weekday: 1, short: 'Пн', label: 'Понедельник' },
  { weekday: 2, short: 'Вт', label: 'Вторник' },
  { weekday: 3, short: 'Ср', label: 'Среда' },
  { weekday: 4, short: 'Чт', label: 'Четверг' },
  { weekday: 5, short: 'Пт', label: 'Пятница' },
  { weekday: 6, short: 'Сб', label: 'Суббота' },
  { weekday: 7, short: 'Вс', label: 'Воскресенье' },
];

const emptyRow = () => ({ start: '', end: '' });

export const createEmptyScheduleState = () =>
  WEEKDAYS.map(({ weekday }) => ({
    weekday,
    enabled: false,
    intervals: [emptyRow()],
  }));

const normalizeInterval = (raw) => {
  const start = raw?.start ?? raw?.time_from ?? raw?.timeFrom ?? '';
  const end = raw?.end ?? raw?.time_to ?? raw?.timeTo ?? '';
  return { start: String(start).slice(0, 5), end: String(end).slice(0, 5) };
};

/** Собрать состояние модалки из ответа API (weekdays / weekdays snake). */
export function scheduleFromApiResponse(data) {
  const list = data?.weekdays ?? data?.week_days ?? [];
  const rows = Array.isArray(list) ? list : [];

  return WEEKDAYS.map(({ weekday }) => {
    const row = rows.find((r) => Number(r.weekday ?? r.week_day) === weekday);
    const intervalsRaw = row?.intervals ?? row?.time_slots ?? row?.timeSlots ?? [];
    const intervals = (Array.isArray(intervalsRaw) ? intervalsRaw : []).map(normalizeInterval);
    const validInts = intervals.filter((i) => i.start && i.end);
    if (row?.enabled === false) {
      return { weekday, enabled: false, intervals: [emptyRow()] };
    }
    const enabled = validInts.length > 0;
    return {
      weekday,
      enabled,
      intervals: validInts.length ? validInts : [emptyRow()],
    };
  });
}

/** Тело PUT для бэкенда. */
export function scheduleToApiPayload(rows) {
  return {
    weekdays: rows.map((row) => ({
      weekday: row.weekday,
      enabled: Boolean(row.enabled),
      intervals: row.enabled
        ? (row.intervals || [])
            .filter((i) => i.start && i.end)
            .map((i) => ({ start: i.start, end: i.end }))
        : [],
    })),
  };
}

/**
 * Слоты для формы клиента: label «Пн 12:00–14:00», value «weekday|start|end» (1–7, HH:mm).
 * data — ответ GET /trainers/{id}/schedule/
 */
export function flattenScheduleToSlotOptions(data) {
  const rows = scheduleFromApiResponse(data || {});
  const options = [];
  for (const row of rows) {
    if (!row.enabled) continue;
    for (const int of row.intervals || []) {
      if (!int.start || !int.end) continue;
      const meta = WEEKDAYS.find((w) => w.weekday === row.weekday);
      const label = `${meta?.short ?? row.weekday} ${int.start}–${int.end}`;
      options.push({
        value: `${row.weekday}|${int.start}|${int.end}`,
        label,
      });
    }
  }
  return options;
}

export function parseTrainingSlotKey(key) {
  if (key == null || key === '') {
    return { trainingWeekday: undefined, trainingTimeFrom: undefined, trainingTimeTo: undefined };
  }
  const parts = String(key).split('|');
  if (parts.length < 3) {
    return { trainingWeekday: undefined, trainingTimeFrom: undefined, trainingTimeTo: undefined };
  }
  const wd = Number(parts[0]);
  const start = parts[1] || '';
  const end = parts[2] || '';
  return {
    trainingWeekday: Number.isFinite(wd) && wd >= 1 && wd <= 7 ? wd : undefined,
    trainingTimeFrom: start || undefined,
    trainingTimeTo: end || undefined,
  };
}

/** Подобрать value слота по сохранённым у клиента полям (после загрузки списка слотов). */
export function matchClientToSlotKey(options, weekday, timeFrom, timeTo) {
  if (!options?.length) return '';
  const tf = String(timeFrom || '').slice(0, 5);
  const tt = String(timeTo || '').slice(0, 5);
  if (weekday != null && weekday !== '' && tf && tt) {
    const key = `${Number(weekday)}|${tf}|${tt}`;
    if (options.some((o) => String(o.value) === key)) return key;
  }
  if (tf && tt) {
    const hit = options.find((o) => {
      const segs = String(o.value).split('|');
      const st = segs[1] || '';
      const en = segs[2] || '';
      return st === tf && en === tt;
    });
    if (hit) return String(hit.value);
  }
  return '';
}

const timeToMinutes = (t) => {
  const [h, m] = String(t).split(':').map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/** Пересекается ли [aStart,aEnd] с [bStart,bEnd] (полуинтервалы [start,end)). */
export function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  const as = timeToMinutes(aStart);
  const ae = timeToMinutes(aEnd);
  const bs = timeToMinutes(bStart);
  const be = timeToMinutes(bEnd);
  if (as == null || ae == null || bs == null || be == null) return true;
  if (ae <= as || be <= bs) return false;
  return as < be && bs < ae;
}

/**
 * Проверка: у тренера в schedule есть хотя бы один интервал в указанный день,
 * пересекающийся с [timeFrom, timeTo] (если время не задано — достаточно дня).
 * schedule — объект как в API (weekdays) или вложенный в элемент списка тренеров.
 */
export function trainerMatchesScheduleFilter(trainer, weekday, timeFrom, timeTo) {
  if (weekday == null || weekday === '') return true;
  const wd = Number(weekday);
  const data = trainer?.schedule ?? trainer?.work_schedule ?? trainer?.workSchedule;
  const list = data?.weekdays ?? data?.week_days ?? [];
  const row = (Array.isArray(list) ? list : []).find(
    (r) => Number(r.weekday ?? r.week_day) === wd
  );
  if (!row) return false;
  const intervals = row.intervals ?? row.time_slots ?? row.timeSlots ?? [];
  if (!Array.isArray(intervals) || !intervals.length) return false;
  const tf = timeFrom || '';
  const tt = timeTo || '';
  if (!tf && !tt) return true;
  if (tf && !tt) {
    const m = timeToMinutes(tf);
    return intervals.some((int) => {
      const s = int?.start ?? int?.time_from;
      const e = int?.end ?? int?.time_to;
      if (m == null || timeToMinutes(s) == null || timeToMinutes(e) == null) return true;
      return m >= timeToMinutes(s) && m < timeToMinutes(e);
    });
  }
  if (!tf || !tt) return true;
  return intervals.some((int) => {
    const s = int?.start ?? int?.time_from;
    const e = int?.end ?? int?.time_to;
    return intervalsOverlap(s, e, tf, tt);
  });
}

/** Есть ли у тренера хотя бы один день недели, подходящий под заданное время (без привязки к конкретному дню). */
export function trainerMatchesTimeAcrossWeek(trainer, timeFrom, timeTo) {
  if (!timeFrom && !timeTo) return true;
  for (let wd = 1; wd <= 7; wd += 1) {
    if (trainerMatchesScheduleFilter(trainer, wd, timeFrom, timeTo)) return true;
  }
  return false;
}
