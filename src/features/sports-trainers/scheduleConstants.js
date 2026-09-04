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

/** Категории занятия — общий словарь для CRM-графика и Taplink (расписание на сайте берёт это же поле).
 * Единственное место, где заводятся варианты категории — при добавлении новой (как «Смешанный»)
 * менять нужно только здесь, дальше она сама долетает до Taplink и карточки клиента. */
export const AGE_GROUP_OPTIONS = [
  { value: 'Взрослые',    label: 'Взрослые' },
  { value: 'Дети (5–17)', label: 'Дети (5–17)' },
  { value: 'Смешанный',   label: 'Смешанный' },
];

const emptyRow = () => ({ start: '', end: '', ageGroup: '' });

export const createEmptyScheduleState = () =>
  WEEKDAYS.map(({ weekday }) => ({
    weekday,
    enabled: false,
    intervals: [emptyRow()],
  }));

/**
 * Группирует дни редактора графика по ИДЕНТИЧНОМУ набору интервалов — «занятие Ср+Пт 10:00–12:00»
 * вместо двух отдельных одинаковых блоков. Дни с уникальным временем остаются каждый в своей группе
 * (одиночная группа = сегодняшнее поведение «один день»). Чистая функция от `rows`,
 * никакой отдельной сущности «группа» в API нет — при сохранении rows разворачиваются обратно как раньше.
 */
export function groupScheduleRows(rows) {
  const enabledRows = (rows || []).filter((r) => r.enabled);
  // Категория — часть сигнатуры: Пн 18:00–19:30 «Взрослые» и Ср 18:00–19:30 «Дети» — разные занятия,
  // их нельзя схлопывать в одну группу, даже если время совпадает.
  const signature = (intervals) =>
    (intervals || [])
      .filter((i) => i.start && i.end)
      .map((i) => `${i.start}-${i.end}-${i.ageGroup || ''}`)
      .sort()
      .join(',');

  const groups = [];
  for (const row of enabledRows) {
    const sig = signature(row.intervals);
    // Пустой/недозаполненный день не сливаем с другими такими же пустыми — только настоящее совпадение времени группируем.
    let group = sig ? groups.find((g) => g.sig === sig) : null;
    if (!group) {
      group = { sig, weekdays: [], intervals: row.intervals?.length ? row.intervals : [{ start: '', end: '' }] };
      groups.push(group);
    }
    group.weekdays.push(row.weekday);
  }
  groups.forEach((g) => g.weekdays.sort((a, b) => a - b));
  groups.sort((a, b) => a.weekdays[0] - b.weekdays[0]);
  return groups;
}

const normalizeInterval = (raw) => {
  const start = raw?.start ?? raw?.time_from ?? raw?.timeFrom ?? '';
  const end = raw?.end ?? raw?.time_to ?? raw?.timeTo ?? '';
  const ageGroup = raw?.ageGroup ?? raw?.age_group ?? '';
  return { start: String(start).slice(0, 5), end: String(end).slice(0, 5), ageGroup };
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
            .map((i) => ({ start: i.start, end: i.end, ageGroup: i.ageGroup || '' }))
        : [],
    })),
  };
}

/**
 * Слоты для формы клиента: value «weekday|start|end» (1–7, HH:mm) по первому дню группы.
 * Если один и тот же интервал повторяется в нескольких днях (напр. Пн/Ср/Пт 20:00–21:30 —
 * одна и та же группа/тренировка), эти дни схлопываются в ОДИН слот с общим `days`,
 * чтобы это было видно сразу, а не терялось за одним случайно выбранным днём.
 * data — ответ GET /trainers/{id}/schedule/
 */
export function flattenScheduleToSlotOptions(data) {
  const rows = scheduleFromApiResponse(data || {});
  const groups = new Map(); // "start|end|ageGroup" → { days: [{weekday, short}], start, end, ageGroup }

  for (const row of rows) {
    if (!row.enabled) continue;
    for (const int of row.intervals || []) {
      if (!int.start || !int.end) continue;
      const meta = WEEKDAYS.find((w) => w.weekday === row.weekday);
      // Категория — часть ключа: тот же час, но «Взрослые» и «Дети» — разные занятия, не сливаем.
      const key = `${int.start}|${int.end}|${int.ageGroup || ''}`;
      if (!groups.has(key)) groups.set(key, { days: [], start: int.start, end: int.end, ageGroup: int.ageGroup || '' });
      groups.get(key).days.push({ weekday: row.weekday, short: meta?.short ?? String(row.weekday) });
    }
  }

  const options = [];
  for (const { days, start, end, ageGroup } of groups.values()) {
    days.sort((a, b) => a.weekday - b.weekday);
    const primaryWeekday = days[0].weekday;
    const label = [ageGroup, `${days.map((d) => d.short).join(', ')} ${start}–${end}`].filter(Boolean).join(' — ');
    options.push({
      value: `${primaryWeekday}|${start}|${end}`,
      label,
      days,
      start,
      end,
      ageGroup,
    });
  }
  options.sort((a, b) => a.days[0].weekday - b.days[0].weekday || a.start.localeCompare(b.start));
  return options;
}

/**
 * Группирует уже собранные слоты (flattenScheduleToSlotOptions) по набору дней:
 * несколько разных интервалов на одних и тех же днях (напр. 3 варианта времени по Пн)
 * идут под ОДНИМ общим заголовком дней, а не отдельной строкой с повтором бейджа дня на каждую.
 */
export function groupSlotOptionsByDays(options) {
  const groups = [];
  for (const opt of options || []) {
    const key = (opt.days || []).map((d) => d.weekday).join(',');
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, days: opt.days, options: [] };
      groups.push(group);
    }
    group.options.push(opt);
  }
  return groups;
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
