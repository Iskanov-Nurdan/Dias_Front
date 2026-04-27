export const ACTIVITY_ACTION_LABELS = {
  create: 'Создал',
  update: 'Изменил',
  delete: 'Удалил',
  restore: 'Восстановил',
  view: 'Просмотрел',
};

export const ACTIVITY_ACTION_COLORS = {
  create: 'var(--success)',
  update: 'var(--accent)',
  delete: 'var(--danger)',
  restore: 'var(--accent)',
  view: 'var(--text-muted)',
};

const FIELD_TYPE_LABELS = {
  scalar: 'Значение',
  enum: 'Перечень',
  fk: 'Связь',
  json: 'JSON',
  file_meta: 'Файл',
};

export function getActivitySummary(a) {
  if (!a) return '';
  return (
    a.summary ||
    a.description ||
    a.object_repr ||
    ''
  );
}

/** Исправление типичной ошибки в шаблонах бэка («жалоба» в вин. падеже после глагола). */
function fixComplaintAccusativeRu(s) {
  if (!s || typeof s !== 'string') return s;
  return s
    .replace(/\bСоздал\s+жалоба\b/g, 'Создал жалобу')
    .replace(/\bИзменил\s+жалоба\b/g, 'Изменил жалобу')
    .replace(/\bУдалил\s+жалоба\b/g, 'Удалил жалобу')
    .replace(/\bВосстановил\s+жалоба\b/g, 'Восстановил жалобу')
    .replace(/\bПросмотрел\s+жалоба\b/g, 'Просмотрел жалобу');
}

/** Убираем хвосты вида «: #1 — 4», « №10» — клиенту не показываем внутренние id. */
function stripOperatorSummaryTechnicalTail(s) {
  let t = String(s).trim();
  if (!t) return t;
  if (/жалоб|смен/i.test(t)) {
    t = t.replace(/\s*[:：]\s*#.*$/u, '');
  }
  t = t.replace(/\s+#\d+(\s*[—–-]\s*#?\d+)*\s*$/u, '');
  t = t.replace(/\s+№\s*\d+\s*$/u, '');
  return t.trim();
}

/** Сводка целиком похожа на тех. строку (модель #pk) — не показываем оператору. */
function operatorSummaryLooksTechnical(s) {
  if (!s) return true;
  const t = String(s).trim();
  if (/^[a-z][a-z0-9_.]*\s*[#№]\s*\d+$/i.test(t)) return true;
  if (/\w+\.\w+\s*#\d+/i.test(t)) return true;
  return false;
}

/** Текст для списка/карточки без технических fallback (sales.client #4). */
export function getActivitySummaryForOperator(a) {
  if (!a) return '';
  const fromApi =
    (a.summary && String(a.summary).trim()) ||
    (a.description && String(a.description).trim()) ||
    (a.object_repr && String(a.object_repr).trim()) ||
    '';
  if (fromApi) {
    let s = fixComplaintAccusativeRu(fromApi);
    s = stripOperatorSummaryTechnicalTail(s);
    if (operatorSummaryLooksTechnical(s)) s = '';
    if (s) return s;
  }
  const section = getActivityModule(a);
  if (section) return `Изменение в разделе «${section}»`;
  return 'Запись в журнале';
}

export function getActivityModule(a) {
  if (!a) return '';
  return a.module || a.section || '';
}

export function getActivityTime(a) {
  if (!a) return null;
  return a.occurred_at || a.created_at || a.timestamp;
}

export function getActivityChanges(a) {
  const ch = a?.payload?.changes;
  return Array.isArray(ch) ? ch : [];
}

/** Контекст операции (endpoint и др.) — см. payload.meta в API бэка. */
export function getActivityPayloadMeta(a) {
  const m = a?.payload?.meta;
  if (m == null) return null;
  if (typeof m === 'string' && m.trim()) return { endpoint: m };
  if (typeof m === 'object' && Object.keys(m).length > 0) return m;
  return null;
}

/** Смена: в ответе может быть shift_id или shift (id / FK). */
export function getActivityShiftRef(a) {
  if (a?.shift_id != null) return String(a.shift_id);
  const s = a?.shift;
  if (s != null && typeof s === 'object' && s.id != null) return String(s.id);
  if (s != null) return String(s);
  return null;
}

/** Линия: line_id или line. */
export function getActivityLineRef(a) {
  if (a?.line_id != null) return String(a.line_id);
  const l = a?.line;
  if (l != null && typeof l === 'object' && l.id != null) return String(l.id);
  if (l != null) return String(l);
  return null;
}

/**
 * Для UI оператора: смена по дате/времени начала (вложенный объект shift), без внутреннего id.
 * Если есть имя сотрудника на смене — «Имя · дата, время». Только shift_id без объекта — null.
 */
export function getActivityShiftHumanLabelForOperator(a) {
  const nested = a?.shift;
  if (!nested || typeof nested !== 'object') return null;
  const opened = nested.opened_at || nested.started_at;
  if (!opened) return null;
  let owner = nested.user_name;
  if (!owner && nested.user && typeof nested.user === 'object') {
    owner = nested.user.name || nested.user.username || nested.user.email;
  }
  try {
    const when = new Date(opened).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const o = owner != null && String(owner).trim() !== '' ? String(owner).trim() : '';
    return o ? `${o} · ${when}` : when;
  } catch {
    return null;
  }
}

/** Ключ поля из строки diff (path или field). */
export function extractChangeFieldKey(row) {
  const raw =
    row?.path != null ? String(row.path) : row?.field != null ? String(row.field) : '';
  if (!raw) return '';
  return raw.split('.').pop().split('[')[0].toLowerCase();
}

/** Поля, оканчивающиеся на _id, но не скрываем (бизнес-идентификаторы). */
const NON_TECHNICAL_ID_SUFFIX = new Set(['external_id', 'tax_id']);

/** Скрываем внутренние ключи: pk, uuid, FK (*_id), пароли. */
export function isTechnicalAuditFieldKey(key) {
  if (!key) return true;
  const k = String(key).toLowerCase();
  if (k === 'id' || k === 'pk' || k === 'uuid') return true;
  if (k.endsWith('_ptr_id')) return true;
  if (/_id$/.test(k) && !NON_TECHNICAL_ID_SUFFIX.has(k)) return true;
  if (['password', 'token', 'secret', 'refresh', 'csrf'].includes(k)) return true;
  return false;
}

/**
 * Порядок полей как в типовых формах (клиенты, линии, …). Для неизвестных entity — этот список.
 * Переопределения по entity_type — точное совпадение строки с бэка.
 */
/** Поля клиента, как в форме ClientsPage (создать/редактировать) — не показываем лишнее из модели (inn, contact, …). */
const CLIENT_FORM_FIELD_KEYS = new Set([
  'name',
  'phone',
  'phone_number',
  'phone_alt',
  'second_phone',
  'address',
  'client_type',
  'type',
  'notes',
  'comment',
]);

/** entity_type с бэка → whitelist ключей для клиентского diff. */
const ENTITY_OPERATOR_FIELD_ALLOWLIST = {
  'sales.client': CLIENT_FORM_FIELD_KEYS,
  'clients.client': CLIENT_FORM_FIELD_KEYS,
};

const SALES_CLIENT_FIELD_ORDER = [
  'name',
  'phone',
  'phone_number',
  'phone_alt',
  'second_phone',
  'address',
  'client_type',
  'type',
  'notes',
  'comment',
];

const ENTITY_FIELD_ORDER_OVERRIDES = {
  'sales.client': SALES_CLIENT_FIELD_ORDER,
  'clients.client': SALES_CLIENT_FIELD_ORDER,
  'production.line': ['name', 'code', 'title', 'description', 'height', 'width', 'angle_deg', 'comment'],
  'lines.line': ['name', 'code', 'title', 'description', 'height', 'width', 'angle_deg', 'comment'],
};

const PREFERRED_FIELD_ORDER = [
  'name',
  'title',
  'first_name',
  'last_name',
  'phone',
  'phone_number',
  'phone_alt',
  'second_phone',
  'mobile',
  'email',
  'address',
  'client_type',
  'type',
  'contact',
  'notes',
  'comment',
  'description',
  'inn',
  'kpp',
  'ogrn',
  'session_title',
  'height',
  'width',
  'angle_deg',
  'opened_at',
  'closed_at',
  'status',
  'quantity',
  'price',
  'amount',
  'unit',
  'is_active',
  'created_at',
  'updated_at',
];

function sortKeyIndex(key, entityType) {
  const order = ENTITY_FIELD_ORDER_OVERRIDES[entityType] || PREFERRED_FIELD_ORDER;
  const i = order.indexOf(key.toLowerCase());
  return i === -1 ? 10000 : i;
}

/** Фильтр технических полей + только «форменные» поля по сущности + порядок. */
export function getActivityChangesForDisplay(changes, entityType, isAdmin) {
  if (!Array.isArray(changes)) return [];
  if (isAdmin) return changes;
  const et = entityType != null ? String(entityType) : '';
  let filtered = changes.filter((row) => !isTechnicalAuditFieldKey(extractChangeFieldKey(row)));
  const allow = ENTITY_OPERATOR_FIELD_ALLOWLIST[et];
  if (allow) {
    filtered = filtered.filter((row) => allow.has(extractChangeFieldKey(row)));
  }
  return [...filtered].sort((a, b) => {
    const ka = extractChangeFieldKey(a);
    const kb = extractChangeFieldKey(b);
    const ia = sortKeyIndex(ka, et);
    const ib = sortKeyIndex(kb, et);
    if (ia !== ib) return ia - ib;
    return getActivityFieldLabelForOperator(a.path || a.field).localeCompare(
      getActivityFieldLabelForOperator(b.path || b.field),
      'ru'
    );
  });
}

/** Понятные подписи полей (без сырого API на латинице, где возможно). */
const OPERATOR_FIELD_LABELS = {
  name: 'Название',
  title: 'Название',
  first_name: 'Имя',
  last_name: 'Фамилия',
  email: 'Эл. почта',
  phone: 'Телефон',
  phone_number: 'Телефон',
  phone_alt: 'Доп. телефон',
  second_phone: 'Доп. телефон',
  mobile: 'Мобильный',
  status: 'Статус',
  address: 'Адрес',
  comment: 'Комментарий',
  description: 'Описание',
  inn: 'ИНН',
  kpp: 'КПП',
  ogrn: 'ОГРН',
  notes: 'Комментарий',
  is_active: 'Активен',
  created_at: 'Создано',
  updated_at: 'Обновлено',
  client_type: 'Тип',
  type: 'Тип',
  contact: 'Контакт',
  code: 'Код',
  sku: 'Артикул',
  barcode: 'Штрихкод',
  quantity: 'Количество',
  price: 'Цена',
  amount: 'Сумма',
  unit: 'Единица',
  weight: 'Вес',
  volume: 'Объём',
  height: 'Высота',
  width: 'Ширина',
  angle_deg: 'Угол, °',
  session_title: 'Название смены',
  opened_at: 'Начало',
  closed_at: 'Окончание',
  line: 'Линия',
  user: 'Пользователь',
  role: 'Роль',
  recipe: 'Рецепт',
  product: 'Товар',
  batch: 'Партия',
  order: 'Заказ',
  shipment: 'Отгрузка',
  sale: 'Продажа',
  payment: 'Оплата',
  discount: 'Скидка',
  tax: 'Налог',
  currency: 'Валюта',
  date: 'Дата',
  time: 'Время',
  due_date: 'Срок',
  priority: 'Приоритет',
  active: 'Активен',
  archived: 'В архиве',
  deleted: 'Удалён',
  slug: 'Код в URL',
  position: 'Позиция',
  sort_order: 'Порядок',
  meta: 'Доп. данные',
  config: 'Настройки',
  settings: 'Параметры',
  reason: 'Причина',
  source: 'Источник',
  reference: 'Ссылка',
  external_id: 'Внешний код',
  file: 'Файл',
  image: 'Изображение',
  url: 'Ссылка',
  website: 'Сайт',
  fax: 'Факс',
  country: 'Страна',
  city: 'Город',
  region: 'Регион',
  zip: 'Индекс',
  postal_code: 'Индекс',
  street: 'Улица',
  building: 'Дом',
  apartment: 'Квартира',
  company: 'Компания',
  organization: 'Организация',
  department: 'Отдел',
  position_title: 'Должность',
  birth_date: 'Дата рождения',
  gender: 'Пол',
  language: 'Язык',
  timezone: 'Часовой пояс',
  theme: 'Тема',
  color: 'Цвет',
  icon: 'Иконка',
  tags: 'Метки',
  category: 'Категория',
  group: 'Группа',
  parent: 'Родитель',
  children: 'Дочерние',
  owner: 'Владелец',
  author: 'Автор',
  editor: 'Редактор',
  reviewer: 'Проверяющий',
  approved: 'Утверждено',
  published: 'Опубликовано',
  draft: 'Черновик',
  version: 'Версия',
  revision: 'Ревизия',
  checksum: 'Контрольная сумма',
  hash: 'Хэш',
  payload: 'Данные',
  data: 'Данные',
  content: 'Содержимое',
  body: 'Текст',
  summary_short: 'Кратко',
  headline: 'Заголовок',
  subtitle: 'Подзаголовок',
  caption: 'Подпись',
  alt: 'Альт. текст',
  title_attr: 'Подсказка',
  placeholder: 'Подсказка в поле',
  required: 'Обязательно',
  readonly: 'Только чтение',
  hidden: 'Скрыто',
  disabled: 'Отключено',
  default: 'По умолчанию',
  min: 'Минимум',
  max: 'Максимум',
  step: 'Шаг',
  precision: 'Точность',
  scale: 'Масштаб',
  format: 'Формат',
  pattern: 'Шаблон',
  validation: 'Проверка',
  error_message: 'Сообщение об ошибке',
  help_text: 'Подсказка',
  label: 'Подпись',
  hint: 'Подсказка',
};

function humanizeFieldKeyRu(key) {
  const k = String(key).toLowerCase().replace(/_/g, ' ');
  return k.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getActivityFieldLabelForOperator(fieldPath) {
  const key = extractChangeFieldKey({ path: fieldPath, field: fieldPath });
  if (!key) return fieldPath != null ? String(fieldPath) : '—';
  if (OPERATOR_FIELD_LABELS[key]) return OPERATOR_FIELD_LABELS[key];
  return humanizeFieldKeyRu(key);
}

function isLikelyMaskedDisplay(s) {
  if (s == null) return false;
  return /\*{2,}/.test(String(s));
}

function snapshotSide(activity, after) {
  const snap = activity?.payload?.snapshot;
  if (!snap || typeof snap !== 'object') return null;
  const obj = after ? snap.after : snap.before;
  return obj && typeof obj === 'object' ? obj : null;
}

/** Для одного поля diff пробуем несколько имён в snapshot (как в формах клиента). */
function snapshotKeysForChangeRow(row) {
  const key = extractChangeFieldKey(row);
  if (!key) return [];
  const map = {
    phone: ['phone', 'phone_number'],
    phone_alt: ['phone_alt', 'second_phone'],
    phone_number: ['phone_number', 'phone'],
  };
  const extra = map[key];
  if (extra) return [...new Set([key, ...extra])];
  return [key];
}

function pickUnmaskedFromObject(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const v = obj[k];
    if (v === undefined || v === null) continue;
    const formatted = formatAuditValue(v);
    if (formatted !== '—' && !isLikelyMaskedDisplay(formatted)) return formatted;
  }
  return null;
}

function valueFromSnapshot(activity, row, after) {
  const obj = snapshotSide(activity, after);
  if (!obj) return null;
  return pickUnmaskedFromObject(obj, snapshotKeysForChangeRow(row));
}

/**
 * Значение «было/стало».
 * Контракт бэка (после фикса build_field_changes): в changes[].old/new для журнала PII не маскируется;
 * password/secret/token — null. Старые строки UserActivity в БД могут ещё долго отдавать *** — тогда
 * пробуем snapshot и нормализованные ключи. Если везде маска, показываем как пришло.
 */
export function formatChangeSideForDisplay(row, side, activity) {
  const isNew = side === 'new';
  const displayKey = isNew ? 'new_display' : 'old_display';
  const rawKey = isNew ? 'new' : 'old';
  const displayRaw = row?.[displayKey];
  const displayStr =
    displayRaw != null && displayRaw !== '' ? String(displayRaw).trim() : '';
  const rawVal = formatAuditValue(row?.[rawKey]);

  if (displayStr && isLikelyMaskedDisplay(displayStr)) {
    if (rawVal && rawVal !== '—' && !isLikelyMaskedDisplay(rawVal)) return rawVal;
    const fromSnap = valueFromSnapshot(activity, row, isNew);
    if (fromSnap) return fromSnap;
  }

  if (displayStr) return displayStr;
  return rawVal;
}

export function formatChangeOld(row, activity = null) {
  return formatChangeSideForDisplay(row, 'old', activity);
}

export function formatChangeNew(row, activity = null) {
  return formatChangeSideForDisplay(row, 'new', activity);
}

/** Название линии для оператора; числовой id не показываем. */
export function getActivityLineHumanLabelForOperator(a) {
  const l = a?.line;
  if (!l || typeof l !== 'object') return null;
  const name = l.name || l.label || l.title || l.line_name;
  const s = name != null ? String(name).trim() : '';
  return s || null;
}

export function activityHasDetail(a) {
  if (!a) return false;
  if (a.has_detail === true) return true;
  if (getActivityPayloadMeta(a)) return true;
  if (typeof a.payload_version === 'number' && a.payload_version >= 1) return true;
  return getActivityChanges(a).length > 0;
}

/** Есть ли что показать в модалке при выбранном режиме (клиент не кликает в пустой diff только из id). */
export function activityShowsDetailInPresentation(a, isAdmin) {
  if (!a || a.id == null) return false;
  const visible = getActivityChangesForDisplay(
    getActivityChanges(a),
    a?.entity_type != null ? String(a.entity_type) : '',
    isAdmin
  );
  if (visible.length > 0) return true;
  if (isAdmin && activityHasDetail(a)) return true;
  return false;
}

export function fieldTypeLabel(type) {
  return FIELD_TYPE_LABELS[type] || type || '—';
}

export function formatAuditValue(val) {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val, null, 0);
    } catch {
      return String(val);
    }
  }
  return String(val);
}
