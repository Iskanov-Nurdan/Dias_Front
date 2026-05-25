/**
 * Журнал действий смены — UI для оператора.
 * Контракт API: summary, field_labels, changes[].old_display/new_display (DIas_ERP audit_messages).
 * Локальная логика ниже — fallback для записей до обновления бэка.
 */
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

/** Убираем хвосты вида «: #1 — 4», « №10», API и ISO-даты — клиенту не показываем. */
function stripOperatorSummaryTechnicalTail(s) {
  let t = String(s).trim();
  if (!t) return t;
  t = t.replace(/\s*(POST|GET|PUT|PATCH|DELETE)\s+\/api\/\S+/gi, '');
  t = t.replace(/:\s*POST\s+\/api\/\S+/gi, '');
  t = t.replace(/\s*\(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}[^\)]*\)/g, '');
  t = t.replace(
    /\s+\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?(\.\d+)?([Zz]|[+-]\d{2}:\d{2})?/g,
    ''
  );
  if (/жалоб|смен/i.test(t)) {
    t = t.replace(/\s*[:：]\s*#.*$/u, '');
  }
  t = t.replace(/\s+#\d+(\s*[—–-]\s*#?\d+)*\s*$/u, '');
  t = t.replace(/\s+№\s*\d+\s*$/u, '');
  t = t.replace(/\s*—\s*—\s*/g, ' — ');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t;
}

/** 1.0000 → 1, 1.50 → 1,5 (в тексте сводки). */
function normalizeDecimalInSummaryText(s) {
  return String(s).replace(/(\d+)(?:\.(\d+))?/g, (full, intPart, decPart) => {
    if (!decPart) return intPart;
    const trimmed = decPart.replace(/0+$/, '');
    if (!trimmed) return intPart;
    return `${intPart},${trimmed}`;
  });
}

/** Сводка целиком похожа на тех. строку (модель #pk) — не показываем оператору. */
function operatorSummaryLooksTechnical(s) {
  if (!s) return true;
  const t = String(s).trim();
  if (/^[a-z][a-z0-9_.]*\s*[#№]\s*\d+$/i.test(t)) return true;
  if (/\w+\.\w+\s*#\d+/i.test(t)) return true;
  if (/\/api\//i.test(t)) return true;
  if (/^(POST|GET|PUT|PATCH|DELETE)\s/i.test(t)) return true;
  return false;
}

/** Понятная сводка по entity_type + action, если бэк отдал тех. description. */
function buildEntityOperatorSummary(a) {
  if (!a) return '';
  const action = a.action || a.action_type || 'view';
  const et = a.entity_type != null ? String(a.entity_type) : '';
  const verb = ACTIVITY_ACTION_LABELS[action] || 'Изменение';

  if (et === 'production.shift' || et === 'production.shiftnote' || et === 'production.shiftcomplaint') {
    if (action === 'create' && et === 'production.shift') return 'Открыта смена';
    if (action === 'update' && et === 'production.shift') {
      const desc = `${a.description || ''} ${a.summary || ''}`;
      if (/close|закры/i.test(desc)) return 'Смена закрыта';
      return 'Изменена смена';
    }
    if (action === 'delete' && et === 'production.shift') return 'Смена закрыта';
    if (et === 'production.shiftnote') {
      if (action === 'create') return 'Добавлена заметка к смене';
      return `${verb} заметку к смене`;
    }
    if (et === 'production.shiftcomplaint') {
      if (action === 'create') return 'Добавлена жалоба';
      return `${verb} жалобу`;
    }
  }

  const section = getActivityModule(a);
  const labelByEntity = {
    'sales.client': 'клиента',
    'materials.rawmaterial': 'сырьё',
    'materials.materialbatch': 'приход материала',
    'sales.order': 'заявку',
    'sales.sale': 'продажу',
    'sales.payment': 'оплату',
    'sales.return': 'возврат',
    'sales.defectrecord': 'брак',
    'sales.reworkrequest': 'переделку',
    'warehouse.warehousebatch': 'партию на складе',
    'chemistry.chemistrybatch': 'партию химии',
    'workshop.workshopblank': 'заготовку',
    'production.productionbatch': 'партию производства',
  };
  const objLabel = labelByEntity[et];
  if (objLabel && section) {
    if (action === 'create') return `Создан ${objLabel}`;
    if (action === 'update') return `Изменён ${objLabel}`;
    if (action === 'delete') return `Удалён ${objLabel}`;
  }
  if (section) return `${verb} — раздел «${section}»`;
  return '';
}

/**
 * Подписи полей с бэка (activity.field_labels) или пустой объект для legacy.
 */
export function getActivityFieldLabels(activity) {
  const fl = activity?.field_labels;
  if (!fl || typeof fl !== 'object' || Array.isArray(fl)) return {};
  return fl;
}

/** Текст списка: summary/description с API как есть; санитизация только для старых тех. строк. */
export function getActivitySummaryForOperator(a) {
  if (!a) return '';
  const fromApi =
    (a.summary && String(a.summary).trim()) ||
    (a.description && String(a.description).trim()) ||
    '';
  if (fromApi) {
    if (!operatorSummaryLooksTechnical(fromApi)) {
      return fixComplaintAccusativeRu(fromApi);
    }
    let s = fixComplaintAccusativeRu(stripOperatorSummaryTechnicalTail(fromApi));
    s = normalizeDecimalInSummaryText(s);
    if (s && !operatorSummaryLooksTechnical(s)) return s;
  }
  const built = buildEntityOperatorSummary(a);
  if (built) return built;
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

/** Поля, которые клиенту не показываем никогда (служебные). */
const GLOBAL_OPERATOR_HIDDEN_FIELD_KEYS = new Set([
  'created_at',
  'updated_at',
  'modified_at',
  'last_login',
  'password',
  'token',
  'secret',
  'refresh',
  'csrf',
  'payload_version',
  'request_id',
  'client_ip',
  'user_agent',
  'actor_role_snapshot',
]);

const MATERIAL_BATCH_FORM_KEYS = new Set([
  'material',
  'quantity_initial',
  'quantity_remaining',
  'unit',
  'unit_price',
  'total_price',
  'supplier_name',
  'supplier_batch_number',
  'comment',
  'received_at',
]);

const RAW_MATERIAL_FORM_KEYS = new Set([
  'name',
  'unit',
  'min_balance',
  'is_active',
  'comment',
]);

/** entity_type с бэка → whitelist ключей для клиентского diff. */
const ENTITY_OPERATOR_FIELD_ALLOWLIST = {
  'sales.client': CLIENT_FORM_FIELD_KEYS,
  'clients.client': CLIENT_FORM_FIELD_KEYS,
  'materials.materialbatch': MATERIAL_BATCH_FORM_KEYS,
  'materials.rawmaterial': RAW_MATERIAL_FORM_KEYS,
  'production.shift': new Set(['opened_at', 'closed_at', 'comment', 'status', 'session_title']),
  'production.shiftnote': new Set(['note', 'text', 'content', 'comment']),
  'production.shiftcomplaint': new Set(['body', 'text', 'content', 'comment']),
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
  'materials.materialbatch': [
    'material',
    'quantity_initial',
    'quantity_remaining',
    'unit',
    'unit_price',
    'total_price',
    'received_at',
    'supplier_name',
    'supplier_batch_number',
    'comment',
  ],
  'materials.rawmaterial': ['name', 'unit', 'min_balance', 'is_active', 'comment'],
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

function hasOperatorFieldLabel(key, activity) {
  if (!key) return false;
  const apiLabels = getActivityFieldLabels(activity);
  if (Object.keys(apiLabels).length > 0) return Object.prototype.hasOwnProperty.call(apiLabels, key);
  return Boolean(FALLBACK_FIELD_LABELS[key]);
}

function isEmptyChangeDisplay(row, activity) {
  const old = formatChangeOld(row, activity);
  const neu = formatChangeNew(row, activity);
  const empty = (v) => v === '—' || v === '' || v == null;
  return empty(old) && empty(neu);
}

/** Фильтр технических полей + только «форменные» поля по сущности + порядок. */
export function getActivityChangesForDisplay(changes, entityType, isAdmin, activity = null) {
  if (!Array.isArray(changes)) return [];
  if (isAdmin) return changes;
  const et = entityType != null ? String(entityType) : '';
  let filtered = changes.filter((row) => {
    const key = extractChangeFieldKey(row);
    if (!key || isTechnicalAuditFieldKey(key)) return false;
    if (GLOBAL_OPERATOR_HIDDEN_FIELD_KEYS.has(key)) return false;
    return true;
  });
  const apiLabels = getActivityFieldLabels(activity);
  const apiLabelKeys = Object.keys(apiLabels);
  if (apiLabelKeys.length > 0) {
    const allowed = new Set(apiLabelKeys);
    filtered = filtered.filter((row) => allowed.has(extractChangeFieldKey(row)));
  } else {
    const allow = ENTITY_OPERATOR_FIELD_ALLOWLIST[et];
    if (allow) {
      filtered = filtered.filter((row) => allow.has(extractChangeFieldKey(row)));
    } else {
      filtered = filtered.filter((row) => hasOperatorFieldLabel(extractChangeFieldKey(row), activity));
    }
  }
  filtered = filtered.filter((row) => !isEmptyChangeDisplay(row, activity));
  return [...filtered].sort((a, b) => {
    const ka = extractChangeFieldKey(a);
    const kb = extractChangeFieldKey(b);
    const ia = sortKeyIndexFromApiLabels(ka, activity, et);
    const ib = sortKeyIndexFromApiLabels(kb, activity, et);
    if (ia !== ib) return ia - ib;
    return getActivityFieldLabelForOperator(a.path || a.field, activity).localeCompare(
      getActivityFieldLabelForOperator(b.path || b.field, activity),
      'ru'
    );
  });
}

function sortKeyIndexFromApiLabels(key, activity, entityType) {
  const apiLabels = getActivityFieldLabels(activity);
  const keys = Object.keys(apiLabels);
  if (keys.length > 0) {
    const i = keys.indexOf(key);
    if (i !== -1) return i;
  }
  return sortKeyIndex(key, entityType);
}

/** Fallback, если бэк не прислал field_labels (старые записи). */
const FALLBACK_FIELD_LABELS = {
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
  quantity_initial: 'Начальное количество',
  quantity_remaining: 'Остаток',
  price: 'Цена',
  unit_price: 'Цена за единицу',
  total_price: 'Сумма партии',
  amount: 'Сумма',
  unit: 'Единица',
  material: 'Материал',
  raw_material: 'Сырьё',
  received_at: 'Дата прихода',
  supplier_name: 'Поставщик',
  supplier_batch_number: 'Номер партии поставщика',
  min_balance: 'Мин. остаток',
  note: 'Заметка',
  body: 'Текст жалобы',
  mentioned_user: 'Упомянутый сотрудник',
  mentioned_users: 'Упомянутые сотрудники',
  is_paid: 'Оплачено',
  paid_at: 'Дата оплаты',
  due_date: 'Срок',
  client: 'Клиент',
  order_line: 'Позиция заявки',
  order_lines: 'Позиции заявки',
  blank: 'Заготовка',
  profile: 'Профиль',
  plastic_profile: 'Профиль',
  recipe: 'Рецепт',
  line_name: 'Линия',
  line_label: 'Линия',
  stock_bucket: 'Тип остатка',
  payment_method: 'Способ оплаты',
  payment_type: 'Тип оплаты',
  sale_status: 'Статус продажи',
  order_status: 'Статус заявки',
  defect_type: 'Тип брака',
  rework_status: 'Статус переделки',
  result: 'Результат',
  writeoff_reason: 'Причина списания',
  package_count: 'Кол-во упаковок',
  packages_count: 'Кол-во упаковок',
  weight_kg: 'Вес, кг',
  length_m: 'Длина, м',
  pieces: 'Штук',
  pcs: 'Штук',
  total_amount: 'Итого',
  subtotal: 'Подытог',
  discount_percent: 'Скидка, %',
  discount_amount: 'Сумма скидки',
  tax_amount: 'Налог',
  vat: 'НДС',
  paid_amount: 'Оплачено',
  remaining_amount: 'Остаток к оплате',
  debt: 'Долг',
  balance: 'Баланс',
  cost: 'Себестоимость',
  profit: 'Прибыль',
  margin: 'Маржа',
  batch_number: 'Номер партии',
  document_number: 'Номер документа',
  invoice_number: 'Номер счёта',
  receipt_number: 'Номер чека',
  tracking_number: 'Трек-номер',
  carrier: 'Перевозчик',
  delivery_address: 'Адрес доставки',
  delivery_date: 'Дата доставки',
  shipped_at: 'Дата отгрузки',
  completed_at: 'Дата завершения',
  canceled_at: 'Дата отмены',
  approved_at: 'Дата согласования',
  rejected_at: 'Дата отклонения',
  started_at: 'Начало',
  finished_at: 'Окончание',
  duration: 'Длительность',
  height_mm: 'Высота, мм',
  width_mm: 'Ширина, мм',
  angle: 'Угол',
  session_title: 'Название смены',
  closing_note: 'Комментарий при закрытии',
  closing_comment: 'Комментарий при закрытии',
  weight: 'Вес',
  volume: 'Объём',
  height: 'Высота',
  width: 'Ширина',
  angle_deg: 'Угол, °',
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

/** Русские подписи из snake_case без англ. Title Case. */
function humanizeFieldKeyRu(key) {
  const parts = String(key).toLowerCase().split('_').filter(Boolean);
  const wordMap = {
    qty: 'кол-во',
    id: '',
    at: '',
    no: 'номер',
    num: 'номер',
    initial: 'начальное',
    remaining: 'остаток',
    supplier: 'поставщик',
    batch: 'партия',
    price: 'цена',
    total: 'сумма',
    unit: 'единица',
    name: 'название',
    status: 'статус',
    date: 'дата',
    time: 'время',
    user: 'пользователь',
    client: 'клиент',
    order: 'заявка',
    sale: 'продажа',
    payment: 'оплата',
    material: 'материал',
    quantity: 'количество',
    received: 'поступление',
    comment: 'комментарий',
    phone: 'телефон',
    email: 'почта',
    address: 'адрес',
    type: 'тип',
    count: 'количество',
    amount: 'сумма',
    discount: 'скидка',
    tax: 'налог',
    line: 'линия',
    shift: 'смена',
    note: 'заметка',
    defect: 'брак',
    rework: 'переделка',
    return: 'возврат',
    warehouse: 'склад',
    production: 'производство',
    chemistry: 'химия',
    recipe: 'рецепт',
    profile: 'профиль',
    blank: 'заготовка',
    package: 'упаковка',
    height: 'высота',
    width: 'ширина',
    angle: 'угол',
    deg: '°',
    min: 'мин.',
    max: 'макс.',
    active: 'активен',
    is: '',
  };
  const words = parts
    .map((p) => wordMap[p] ?? p)
    .filter((w) => w !== '');
  if (!words.length) return 'Поле';
  const phrase = words.join(' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

export function getActivityFieldLabelForOperator(fieldPath, activity = null) {
  const key = extractChangeFieldKey({ path: fieldPath, field: fieldPath });
  if (!key) return fieldPath != null ? String(fieldPath) : '—';
  const apiLabels = getActivityFieldLabels(activity);
  if (apiLabels[key]) return apiLabels[key];
  if (FALLBACK_FIELD_LABELS[key]) return FALLBACK_FIELD_LABELS[key];
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
    const formatted = formatAuditValue(v, k);
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
  const fieldKey = extractChangeFieldKey(row);
  const rawVal = formatAuditValue(row?.[rawKey], fieldKey);

  if (displayStr && !isLikelyMaskedDisplay(displayStr)) {
    return displayStr;
  }

  if (displayStr && isLikelyMaskedDisplay(displayStr)) {
    if (rawVal && rawVal !== '—' && !isLikelyMaskedDisplay(rawVal)) return rawVal;
    const fromSnap = valueFromSnapshot(activity, row, isNew);
    if (fromSnap) return fromSnap;
  }

  if (rawVal && rawVal !== '—') return rawVal;
  const fromSnap = valueFromSnapshot(activity, row, isNew);
  if (fromSnap) return fromSnap;
  return '—';
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
    isAdmin,
    a
  );
  if (visible.length > 0) return true;
  if (isAdmin && activityHasDetail(a)) return true;
  return false;
}

export function fieldTypeLabel(type) {
  return FIELD_TYPE_LABELS[type] || type || '—';
}

const UNIT_LABELS_RU = {
  kg: 'кг',
  g: 'г',
  l: 'л',
  ml: 'мл',
  m: 'м',
  mm: 'мм',
  cm: 'см',
  pcs: 'шт.',
  pc: 'шт.',
  piece: 'шт.',
  pieces: 'шт.',
  unit: 'ед.',
};

const ISO_DATE_RE =
  /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function formatIsoDateString(s) {
  try {
    const d = new Date(s.includes('T') ? s : s.replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return s;
    const hasTime = /[T\s]\d{2}:\d{2}/.test(s);
    if (hasTime) {
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return s;
  }
}

function formatNumberForOperator(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (Number.isInteger(n)) return String(n);
  const s = n.toFixed(4).replace(/\.?0+$/, '');
  return s.replace('.', ',');
}

function formatScalarForOperator(val, fieldKey) {
  if (val === undefined || val === null || val === '') return '—';
  if (typeof val === 'boolean') return val ? 'Да' : 'Нет';
  if (typeof val === 'number') return formatNumberForOperator(val) ?? String(val);

  const str = String(val).trim();
  if (!str) return '—';

  if (fieldKey === 'unit' || fieldKey === 'unit_of_measure') {
    const low = str.toLowerCase();
    if (UNIT_LABELS_RU[low]) return UNIT_LABELS_RU[low];
  }

  if (ISO_DATE_RE.test(str) || /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return formatIsoDateString(str);
  }

  if (/^-?\d+(\.\d+)?$/.test(str)) {
    const formatted = formatNumberForOperator(str);
    if (formatted != null) return formatted;
  }

  if (str.toLowerCase() === 'true') return 'Да';
  if (str.toLowerCase() === 'false') return 'Нет';

  return str;
}

export function formatAuditValue(val, fieldKey = '') {
  if (val === undefined || val === null) return '—';
  if (typeof val === 'object') {
    if (val && typeof val === 'object' && (val.name || val.label || val.title)) {
      return formatScalarForOperator(val.name || val.label || val.title, fieldKey);
    }
    try {
      const compact = JSON.stringify(val);
      if (compact.length > 120) return '—';
      return compact;
    } catch {
      return '—';
    }
  }
  return formatScalarForOperator(val, fieldKey);
}
