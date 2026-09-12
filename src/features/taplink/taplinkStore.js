export const GRADIENT_PRESETS = [
  { id: 'red',     label: 'Красный',     value: 'linear-gradient(145deg, #1a0505 0%, #6b1414 60%, #8b1a1a 100%)' },
  { id: 'crimson', label: 'Бордовый',    value: 'linear-gradient(145deg, #1a0505 0%, #7a1010 60%, #c53030 100%)' },
  { id: 'blue',    label: 'Синий',       value: 'linear-gradient(145deg, #050a1a 0%, #0f2b6b 60%, #1a3d8b 100%)' },
  { id: 'teal',    label: 'Морской',     value: 'linear-gradient(145deg, #051016 0%, #0f4a6b 60%, #1a6a8b 100%)' },
  { id: 'green',   label: 'Зелёный',     value: 'linear-gradient(145deg, #051a0a 0%, #1a6b2b 60%, #1a8b3d 100%)' },
  { id: 'purple',  label: 'Фиолетовый',  value: 'linear-gradient(145deg, #0a0516 0%, #3d1270 60%, #5a1a9c 100%)' },
  { id: 'amber',   label: 'Янтарный',    value: 'linear-gradient(145deg, #1a0e05 0%, #7a3d10 60%, #9c5a1a 100%)' },
  { id: 'orange',  label: 'Оранжевый',   value: 'linear-gradient(145deg, #1a0a00 0%, #8b3d00 60%, #c05a00 100%)' },
  { id: 'navy',    label: 'Тёмно-синий', value: 'linear-gradient(145deg, #05051a 0%, #1a1a6b 60%, #2a2a8b 100%)' },
  { id: 'pink',    label: 'Розовый',     value: 'linear-gradient(145deg, #1a0510 0%, #7a1050 60%, #9c1a6b 100%)' },
];

export const DEFAULT_DATA = {
  // Когда сервер последний раз реально сохранял конфиг (ISO-строка) — приходит с бэка
  // в ответах GET/PUT /api/taplink/, null пока ничего не сохранено.
  updatedAt: null,
  hero: {
    title: 'Рахман Ата',
    subtitle: 'Спорт Клубу',
    desc: '7 дисциплин единоборств · Профессиональные тренеры · Для всех возрастов',
    bg: null,
  },
  stats: [
    { n: '7',    l: 'секций' },
    { n: '5',    l: 'тренеров' },
    { n: '500+', l: 'учеников' },
    { n: '1+',   l: 'год работы' },
  ],
  sports: [
    {
      id: 1, name: 'ММА', emoji: '🥋', photo: null,
      gradient: 'linear-gradient(145deg, #1a0505 0%, #6b1414 60%, #8b1a1a 100%)',
      desc: 'Смешанные единоборства объединяют ударные и борцовские техники. Развивают силу, скорость и уверенность в себе. Группы для всех уровней подготовки — от новичков до профессионалов.',
      schedule: [
        { id: 1, group: 'Взрослые',   days: 'Пн, Ср, Пт', time: '18:00–20:00', trainer: 'Алибек Жаксыбеков' },
        { id: 2, group: 'Дети (7–14)', days: 'Вт, Чт',     time: '15:00–16:30', trainer: 'Алибек Жаксыбеков' },
      ],
      videos: ['', '', '', '', ''],
    },
    {
      id: 2, name: 'Дзюдо', emoji: '🥋', photo: null,
      gradient: 'linear-gradient(145deg, #050a1a 0%, #0f2b6b 60%, #1a3d8b 100%)',
      desc: 'Японское боевое искусство, основанное на бросках, удержаниях и болевых приёмах. Развивает гибкость, баланс и тактическое мышление. Занятия подходят детям с 5 лет и взрослым любого возраста.',
      schedule: [
        { id: 1, group: 'Взрослые',  days: 'Пн, Ср, Пт', time: '17:00–19:00', trainer: 'Дана Нурланова' },
        { id: 2, group: 'Дети (5–12)', days: 'Вт, Чт, Сб', time: '14:00–15:30', trainer: 'Дана Нурланова' },
      ],
      videos: ['', '', '', '', ''],
    },
    {
      id: 3, name: 'Бокс', emoji: '🥊', photo: null,
      gradient: 'linear-gradient(145deg, #1a0505 0%, #7a1010 60%, #c53030 100%)',
      desc: 'Классика ударных единоборств. Тренировки развивают скорость реакции, координацию и физическую форму. Профессиональный ринг, боксёрские мешки и полный набор снарядов.',
      schedule: [
        { id: 1, group: 'Взрослые',   days: 'Вт, Чт, Сб', time: '19:00–21:00', trainer: 'Серик Ахметов' },
        { id: 2, group: 'Дети (8–16)', days: 'Пн, Ср, Пт', time: '15:30–17:00', trainer: 'Серик Ахметов' },
      ],
      videos: ['', '', '', '', ''],
    },
    {
      id: 4, name: 'Кроссфит', emoji: '💪', photo: null,
      gradient: 'linear-gradient(145deg, #051a0a 0%, #1a6b2b 60%, #1a8b3d 100%)',
      desc: 'Функциональный тренинг высокой интенсивности. Каждый день — новый WOD. Идеально подходит для роста силы, развития выносливости и снижения веса.',
      schedule: [
        { id: 1, group: 'Утро',   days: 'Пн–Пт',      time: '07:00–08:30', trainer: 'Нурлан Бекзатов' },
        { id: 2, group: 'Вечер',  days: 'Пн, Ср, Пт', time: '19:00–20:30', trainer: 'Нурлан Бекзатов' },
      ],
      videos: ['', '', '', '', ''],
    },
    {
      id: 5, name: 'Грэпплинг', emoji: '🤼', photo: null,
      gradient: 'linear-gradient(145deg, #0a0516 0%, #3d1270 60%, #5a1a9c 100%)',
      desc: 'Борцовская дисциплина без ударов: броски, болевые и удушающие приёмы. Эффективная база для ММА и практической самозащиты. Тренировки в кимоно и без.',
      schedule: [
        { id: 1, group: 'Взрослые', days: 'Вт, Чт, Сб', time: '20:00–22:00', trainer: 'Рустам Сейтжанов' },
      ],
      videos: ['', '', '', '', ''],
    },
    {
      id: 6, name: 'Вольная борьба', emoji: '🤼‍♂️', photo: null,
      gradient: 'linear-gradient(145deg, #1a0e05 0%, #7a3d10 60%, #9c5a1a 100%)',
      desc: 'Олимпийская дисциплина с богатыми казахскими традициями. Воспитывает силу, ловкость и волю к победе. Группы для детей, юношей и взрослых.',
      schedule: [
        { id: 1, group: 'Взрослые',    days: 'Пн, Ср, Пт', time: '18:00–20:00', trainer: '' },
        { id: 2, group: 'Дети (6–14)', days: 'Вт, Чт, Сб', time: '15:00–16:30', trainer: '' },
      ],
      videos: ['', '', '', '', ''],
    },
    {
      id: 7, name: 'Бразильский джиу-джитсу', emoji: '🥋', photo: null,
      gradient: 'linear-gradient(145deg, #051016 0%, #0f4a6b 60%, #1a6a8b 100%)',
      desc: 'Техника работы в партере: болевые и удушающие приёмы. Самая эффективная система самозащиты и фундамент современного ММА. Занятия для детей и взрослых.',
      schedule: [
        { id: 1, group: 'Взрослые',   days: 'Вт, Чт, Сб', time: '20:00–22:00', trainer: 'Рустам Сейтжанов' },
        { id: 2, group: 'Дети (8–14)', days: 'Пн, Ср',     time: '15:00–16:30', trainer: 'Рустам Сейтжанов' },
      ],
      videos: ['', '', '', '', ''],
    },
  ],
  trainers: [
    {
      id: 1, name: 'Алибек Жаксыбеков', sportName: 'ММА', emoji: '🥋', photo: null,
      experience: '12 лет',
      achievements: ['Чемпион Казахстана по ММА', 'Мастер спорта международного класса', 'Тренер высшей категории'],
      shortBio: 'Мастер спорта, чемпион Казахстана',
      bio: 'Алибек — профессиональный тренер по ММА с 12-летним стажем. Чемпион Казахстана, мастер спорта международного класса. Работает с начинающими и профессиональными бойцами. Его воспитанники выступают на республиканских и международных соревнованиях.',
      videos: ['', '', '', '', ''],
    },
    {
      id: 2, name: 'Серик Ахметов', sportName: 'Бокс', emoji: '🥊', photo: null,
      experience: '15 лет',
      achievements: ['Чемпион Центральной Азии по боксу', 'Мастер спорта международного класса', 'Воспитал более 30 чемпионов'],
      shortBio: 'МСМК, чемпион Центральной Азии',
      bio: 'Серик — тренер по боксу с 15-летним стажем. Мастер спорта международного класса, чемпион Центральной Азии. Подготовил более 30 чемпионов регионального и республиканского уровня.',
      videos: ['', '', '', '', ''],
    },
    {
      id: 3, name: 'Дана Нурланова', sportName: 'Дзюдо', emoji: '🥋', photo: null,
      experience: '8 лет',
      achievements: ['Кандидат в мастера спорта по дзюдо', 'Тренер первой категории', 'Чемпионка области'],
      shortBio: 'КМС по дзюдо, тренер первой категории',
      bio: 'Дана — тренер по дзюдо с 8-летним стажем. Кандидат в мастера спорта, чемпионка области. Специализируется на детских группах и подготовке спортсменов к соревнованиям.',
      videos: ['', '', '', '', ''],
    },
    {
      id: 4, name: 'Нурлан Бекзатов', sportName: 'Кроссфит', emoji: '💪', photo: null,
      experience: '7 лет',
      achievements: ['CrossFit Level 2 Trainer', 'Участник отборочных CrossFit Games', 'Сертифицированный нутрициолог'],
      shortBio: 'CrossFit L2, участник CrossFit Games',
      bio: 'Нурлан — сертифицированный тренер CrossFit уровня L2, участник отборочных CrossFit Games. Специализируется на функциональном тренинге и скоростно-силовой подготовке.',
      videos: ['', '', '', '', ''],
    },
    {
      id: 5, name: 'Рустам Сейтжанов', sportName: 'Бразильский джиу-джитсу', emoji: '🥋', photo: null,
      experience: '10 лет',
      achievements: ['Пурпурный пояс по БДД', 'Сертифицированный тренер IBJJF', 'Чемпион РК по грэпплингу'],
      shortBio: 'Пурпурный пояс БДД, чемпион РК',
      bio: 'Рустам — тренер по бразильскому джиу-джитсу и грэпплингу с 10-летним опытом. Пурпурный пояс, сертифицированный тренер IBJJF. Его группы показывают одни из лучших результатов в регионе.',
      videos: ['', '', '', '', ''],
    },
  ],
  prices: [
    { id: 1, name: 'Разовое',   price: '500 сом',    desc: 'Попробуй любую секцию',         hot: false },
    { id: 2, name: '8 занятий', price: '3 200 сом',  desc: '400 сом за занятие',            hot: false },
    { id: 3, name: '12 занятий',price: '4 200 сом',  desc: '350 сом за занятие',            hot: true  },
    { id: 4, name: 'Безлимит',  price: '6 000 сом',  desc: 'Все секции без ограничений',    hot: false },
  ],
  offer: {
    enabled: true,
    label: 'Акция',
    title: 'Первое занятие — бесплатно',
    desc: 'Приходи на пробную тренировку без обязательств. Выбери любую секцию.',
    btn: 'Записаться бесплатно',
  },
  // Контакты по умолчанию пустые. Раньше здесь стояли выдуманные телефон,
  // почта и город из другой страны — они показались бы посетителю сайта, если
  // конфиг не успел загрузиться или поле очистили в редакторе. Пустое поле
  // публичная страница просто не выводит, а неверный номер уводит клиента.
  footer: {
    phone: '',
    whatsapp: '',
    telegram: '',
    instagram: '',
    tiktok: '',
    email: '',
    address: '',
    mapUrl: '',
    copy: '© 2026 Рахман Ата Спорт Клубу. Все права защищены.',
  },
};

// Session store — holds live editor data (including blob: video URLs).
// Only valid within the current browser tab/SPA session.
let _session = null;

export function setSessionData(data) {
  _session = data;
}

/** True if editor has pushed live session data (blob: video URLs present). */
export function hasSessionData() {
  return _session !== null;
}

// ─── Shared merge helper ──────────────────────────────────────────────────────

function mergeWithDefaults(p) {
  const nonEmpty = (arr, def) => (Array.isArray(arr) && arr.length > 0) ? arr : def;
  return {
    updatedAt: p.updatedAt ?? null,
    hero:     { ...DEFAULT_DATA.hero,     ...(p.hero     || {}) },
    stats:    nonEmpty(p.stats,    DEFAULT_DATA.stats),
    sports:   nonEmpty(p.sports,   DEFAULT_DATA.sports).map(s => {
      if (s.schedule && s.schedule.length > 0) return s;
      const def = DEFAULT_DATA.sports.find(d => d.id === s.id);
      return { ...s, schedule: def ? def.schedule : [] };
    }),
    trainers: nonEmpty(p.trainers, DEFAULT_DATA.trainers),
    prices:   nonEmpty(p.prices,   DEFAULT_DATA.prices),
    offer:    { ...DEFAULT_DATA.offer,    ...(p.offer    || {}) },
    footer:   { ...DEFAULT_DATA.footer,   ...(p.footer   || {}) },
  };
}

// ─── Sync (localStorage / session) ───────────────────────────────────────────

export function loadTaplinkData() {
  // Prefer live session data (has blob: video URLs) over persisted localStorage data
  if (_session) return _session;
  try {
    const raw = localStorage.getItem('taplink-data');
    if (!raw) return DEFAULT_DATA;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return DEFAULT_DATA;
  }
}

export function saveTaplinkData(data) {
  // Blob URLs are session-only; strip them so they don't pollute the saved state
  const cleanVids = arr => (arr || []).map(v => (v && v.startsWith('blob:')) ? '' : (v || ''));
  const clean = {
    ...data,
    sports:   data.sports.map(s => ({ ...s, videos: cleanVids(s.videos) })),
    trainers: data.trainers.map(t => ({ ...t, videos: cleanVids(t.videos) })),
  };
  localStorage.setItem('taplink-data', JSON.stringify(clean));
}

// ─── Async (API) ──────────────────────────────────────────────────────────────
// Used when BACKEND_ENABLED = true in api.js.
// Falls back to sync localStorage on any error.

export async function loadTaplinkDataAsync() {
  const { BACKEND_ENABLED, fetchConfig } = await import('./api.js');
  if (!BACKEND_ENABLED) return loadTaplinkData();
  try {
    const raw = await fetchConfig();
    const merged = mergeWithDefaults(raw);
    // Cache to localStorage so offline / fallback still works
    saveTaplinkData(merged);
    return merged;
  } catch {
    return loadTaplinkData();
  }
}

/**
 * Строгая загрузка для редактора — ошибку НЕ проглатывает (в отличие от loadTaplinkDataAsync
 * выше, которая тихо подменяет её локальным кэшем — это ок для публичной страницы,
 * но не ок для админки: там нельзя молча редактировать неизвестно чей черновик).
 * Вызывающий сам решает, что показать при ошибке (баннер + повтор), а не получает
 * замаскированный сбой в виде «как будто всё загрузилось».
 */
export async function loadTaplinkConfigStrict(signal) {
  const { fetchConfig } = await import('./api.js');
  const raw = await fetchConfig(signal);
  const merged = mergeWithDefaults(raw);
  saveTaplinkData(merged);
  return merged;
}

export async function saveTaplinkDataAsync(data) {
  const { BACKEND_ENABLED, saveConfig } = await import('./api.js');
  // Always persist locally first (instant feedback, offline safety)
  saveTaplinkData(data);
  if (!BACKEND_ENABLED) return null;
  // Strip blob: URLs before sending to server
  const cleanVids = arr => (arr || []).map(v => (v && v.startsWith('blob:')) ? '' : (v || ''));
  const payload = {
    ...data,
    sports:   data.sports.map(s => ({ ...s, videos: cleanVids(s.videos) })),
    trainers: data.trainers.map(t => ({ ...t, videos: cleanVids(t.videos) })),
  };
  const res = await saveConfig(payload);
  // Сервер вернул свежий updatedAt — кэшируем его же, чтобы бейдж «Сохранено: …» не отставал
  if (res?.updatedAt) saveTaplinkData({ ...data, updatedAt: res.updatedAt });
  return res;
}
