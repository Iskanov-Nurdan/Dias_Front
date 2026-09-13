import { formatMoney } from '../constants/common';
import { WEEKDAYS } from '../../features/sports-trainers/scheduleConstants';

// Записи журнала приходят с бэкенда полями модели и enum-значениями на
// английском. Здесь они превращаются в русские подписи и читаемые значения.
// Модуль общий: тем же форматом пользуются и модалка журнала, и блок
// «Последние изменения» в карточке клиента — иначе одно и то же название
// поля пришлось бы держать в двух словарях.

export const FIELD_LABELS = {
  fio: 'ФИО',
  name: 'Имя',
  phone: 'Телефон',
  sport: 'Вид спорта', sportId: 'Вид спорта', sport_id: 'Вид спорта',
  trainer: 'Тренер', trainerId: 'Тренер', trainer_id: 'Тренер',
  date_start: 'Дата начала', dateStart: 'Дата начала',
  actual_payment_date: 'Дата оплаты', actualPaymentDate: 'Дата оплаты',
  price: 'Цена',
  club_price: 'Цена клуба', clubPrice: 'Цена клуба',
  trainer_price: 'Цена тренера', trainerPrice: 'Цена тренера',
  discount: 'Скидка',
  paid: 'Оплата',
  client_type: 'Тип клиента', clientType: 'Тип клиента',
  gender: 'Пол',
  comment: 'Комментарий',
  added_by: 'Добавил', addedBy: 'Добавил',
  training_weekday: 'День тренировки', trainingWeekday: 'День тренировки',
  training_time_from: 'Время с', trainingTimeFrom: 'Время с',
  training_time_to: 'Время до', trainingTimeTo: 'Время до',
  warning_count: 'Предупреждения', warningCount: 'Предупреждения',
  role: 'Роль',
  percent: 'Процент',
  amount: 'Сумма',
  category: 'Категория',
  weekday: 'День недели',
  time: 'Время',
  schedule: 'График',
  sportIds: 'Виды спорта', sport_ids: 'Виды спорта',
  status: 'Статус',
  channel: 'Канал',
  source: 'Источник',
  targetType: 'Кому', target_type: 'Кому',
  stageId: 'Этап воронки', stage_id: 'Этап воронки',
};

// Значения enum-полей приходят с бэка на английском — сотрудники должны видеть их на русском.
// Ключи из разных доменов (лиды/заморозка/...) не пересекаются, поэтому один общий словарь безопасен.
const STATUS_VALUE_LABELS = {
  // Лиды
  pending: 'Новая',
  accepted: 'Запишется',
  rejected: 'Отказался',
  spam: 'Спам',
  // Заморозка абонемента
  active: 'Активна',
  inactive: 'Неактивна',
  cancelled: 'Отменена',
  ended: 'Завершена',
};

const CHANNEL_VALUE_LABELS = {
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  taplink: 'Taplink',
  other: 'Другое',
};

const SOURCE_VALUE_LABELS = {
  target: 'Реклама (таргет)',
  reels: 'Reels',
  stories: 'Stories',
  direct: 'Direct',
  post: 'Пост/лента',
};

const TARGET_TYPE_VALUE_LABELS = {
  adult: 'Взрослый',
  children: 'Дети',
};

const ID_FIELDS = new Set(['sport', 'sportId', 'sport_id', 'trainer', 'trainerId', 'trainer_id', 'added_by', 'addedBy']);
const MONEY_FIELDS = new Set(['price', 'club_price', 'clubPrice', 'trainer_price', 'trainerPrice', 'discount', 'amount']);
const DATE_FIELDS = new Set(['date_start', 'dateStart', 'actual_payment_date', 'actualPaymentDate']);
export const GENDER_LABELS = { male: 'Мужской', female: 'Женский' };
export const CLIENT_TYPE_LABELS = { regular: 'Регулярный', individual: 'Индивидуальный', 'one-time': 'Разовый' };

export const formatFieldLabel = (field) => FIELD_LABELS[field] ?? field;

export const formatHm = (v) => {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : s;
};

/** Расписание тренера: [{ weekday, enabled, intervals: [{start,end}] }] → «Пн 10:00–11:00; Ср 14:00–16:00» */
const formatScheduleValue = (days) => {
  if (!Array.isArray(days)) return String(days);
  const parts = days
    .filter((d) => d?.enabled)
    .map((d) => {
      const meta = WEEKDAYS.find((w) => w.weekday === Number(d.weekday));
      const dayLabel = meta ? meta.short : `День ${d.weekday}`;
      const intervals = (d.intervals || [])
        .map((iv) => `${formatHm(iv.start)}–${formatHm(iv.end)}`)
        .join(', ');
      return intervals ? `${dayLabel} ${intervals}` : dayLabel;
    });
  return parts.length ? parts.join('; ') : 'Без тренировок';
};

export const formatFieldValue = (field, value, ctx = {}) => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'paid') return value === true || value === 'true' ? 'Да' : 'Нет';
  if (field === 'gender') return GENDER_LABELS[value] ?? value;
  if (field === 'client_type' || field === 'clientType') return CLIENT_TYPE_LABELS[value] ?? value;
  if (field === 'status') return STATUS_VALUE_LABELS[String(value).toLowerCase()] ?? value;
  if (field === 'channel') return CHANNEL_VALUE_LABELS[String(value).toLowerCase()] ?? value;
  if (field === 'source') return SOURCE_VALUE_LABELS[String(value).toLowerCase()] ?? value;
  if (field === 'targetType' || field === 'target_type') return TARGET_TYPE_VALUE_LABELS[String(value).toLowerCase()] ?? value;
  if (field === 'training_weekday' || field === 'trainingWeekday' || field === 'weekday') {
    const w = WEEKDAYS.find((x) => String(x.weekday) === String(value));
    return w ? w.label : value;
  }
  if (field === 'schedule') return formatScheduleValue(value);
  if (field === 'sportIds' || field === 'sport_ids') {
    const ids = Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return '—';
    return ids.map((id) => ctx.sports?.find((s) => String(s.id) === String(id))?.name ?? `№${id}`).join(', ');
  }
  if (MONEY_FIELDS.has(field)) return formatMoney(value);
  if (DATE_FIELDS.has(field)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  if (ID_FIELDS.has(field)) return `№${value}`;
  if (Array.isArray(value)) {
    return value.length
      ? value.map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ')
      : '—';
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
