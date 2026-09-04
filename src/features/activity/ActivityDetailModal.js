import React from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Trash2, Phone, Dumbbell, Clock, Calendar, CreditCard, User, MessageSquare } from 'lucide-react';
import { useModalEffect } from '../../shared/hooks/useModalEffect';
import { formatMoney } from '../../shared/constants/common';
import { WEEKDAYS } from '../sports-trainers/scheduleConstants';
import { ACTION_TYPES, SECTIONS } from './constants';
import '../clients/components/ClientCardModal.scss';
import './ActivityDetailModal.scss';

const FIELD_LABELS = {
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
const GENDER_LABELS = { male: 'Мужской', female: 'Женский' };
const CLIENT_TYPE_LABELS = { regular: 'Регулярный', individual: 'Индивидуальный', 'one-time': 'Разовый' };
const CLIENT_TYPE_MAP = {
  individual: { label: 'Индивидуальный', cls: 'ccm__badge--individual' },
  regular:    { label: 'Регулярный',     cls: 'ccm__badge--regular'    },
  'one-time': { label: 'Разовый',        cls: 'ccm__badge--onetime'    },
};

const formatFieldLabel = (field) => FIELD_LABELS[field] ?? field;

const formatHm = (v) => {
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

const formatFieldValue = (field, value, ctx = {}) => {
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

const formatScheduleLabel = (weekday, timeFrom, timeTo) => {
  const tf = formatHm(timeFrom);
  const tt = formatHm(timeTo);
  const hasDay = weekday != null && weekday !== '';
  const hasTime = Boolean(tf || tt);
  if (!hasDay && !hasTime) return null;
  const dayMeta = hasDay ? WEEKDAYS.find((w) => String(w.weekday) === String(weekday)) : null;
  const dayPart = dayMeta ? dayMeta.label : hasDay ? `День ${weekday}` : '';
  let timePart = '';
  if (tf && tt) timePart = `${tf}–${tt}`;
  else if (tf) timePart = `с ${tf}`;
  else if (tt) timePart = `до ${tt}`;
  if (dayPart && timePart) return `${dayPart}, ${timePart}`;
  return dayPart || timePart || null;
};

/** Карточка удалённого клиента — тот же визуальный формат, что и ClientCardModal, но read-only. */
const ClientSnapshotCard = ({ entry, sports, trainers, onClose }) => {
  const getVal = (...keys) => {
    for (const k of keys) {
      const row = entry.snapshot.find((s) => s.field === k);
      if (row && row.value !== undefined && row.value !== null && row.value !== '') return row.value;
    }
    return null;
  };

  const fio = getVal('fio', 'name') ?? entry.entityLabel;
  const phone = getVal('phone');
  const sportId = getVal('sport', 'sportId', 'sport_id');
  const trainerId = getVal('trainer', 'trainerId', 'trainer_id');
  const sportName = sports.find((s) => String(s.id) === String(sportId))?.name ?? (sportId != null ? `№${sportId}` : null);
  const trainerName = trainers.find((t) => String(t.id) === String(trainerId))?.fio ?? (trainerId != null ? `№${trainerId}` : null);
  const dateStart = getVal('date_start', 'dateStart');
  const clientType = getVal('client_type', 'clientType');
  const price = getVal('price');
  const discount = getVal('discount');
  const paidRaw = getVal('paid');
  const paid = paidRaw === true || paidRaw === 'true';
  const comment = getVal('comment');
  const scheduleLabel = formatScheduleLabel(
    getVal('training_weekday', 'trainingWeekday'),
    getVal('training_time_from', 'trainingTimeFrom'),
    getVal('training_time_to', 'trainingTimeTo'),
  );

  const priceBase = Number(price) || 0;
  const discountPct = Number(discount) || 0;
  const priceFinal = discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase;
  const typeInfo = CLIENT_TYPE_MAP[clientType] || null;
  const initials = (fio || '').split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <>
      <div className="ccm__header">
        <div className="ccm__header-info">
          <div className="ccm__avatar">{initials || <User size={18} />}</div>
          <div>
            <h2 className="ccm__name">{fio || '—'}</h2>
            {phone && <a href={`tel:${phone}`} className="ccm__phone"><Phone size={12} />{phone}</a>}
          </div>
        </div>
        <button type="button" className="ccm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
      </div>

      <div className="activity-detail-modal__meta">
        <span className={`ui-pill ${ACTION_TYPES[entry.actionType]?.cls ?? ''}`}>{ACTION_TYPES[entry.actionType]?.label ?? entry.actionType}</span>
        <span className="activity-detail-modal__meta-text">
          <strong>{entry.actorName}</strong> ({entry.actorRole}) · {SECTIONS[entry.section] ?? entry.section}
        </span>
      </div>

      <div className="ccm__body">
        <section className="ccm__section">
          <h3 className="ccm__section-title"><Dumbbell size={13} />Абонемент</h3>
          <div className="ccm__info-grid">
            {sportName && (
              <div className="ccm__info-row">
                <span className="ccm__info-label">Вид спорта</span>
                <span className="ccm__info-val">{sportName}</span>
              </div>
            )}
            {trainerName && (
              <div className="ccm__info-row">
                <span className="ccm__info-label">Тренер</span>
                <span className="ccm__info-val">{trainerName}</span>
              </div>
            )}
            {scheduleLabel && (
              <div className="ccm__info-row">
                <span className="ccm__info-label"><Clock size={11} />Время</span>
                <span className="ccm__info-val">{scheduleLabel}</span>
              </div>
            )}
            {dateStart && (
              <div className="ccm__info-row">
                <span className="ccm__info-label"><Calendar size={11} />Дата начала</span>
                <span className="ccm__info-val">{new Date(dateStart).toLocaleDateString('ru-RU')}</span>
              </div>
            )}
            {typeInfo && (
              <div className="ccm__info-row">
                <span className="ccm__info-label">Тип</span>
                <span className={`ccm__badge ${typeInfo.cls}`}>{typeInfo.label}</span>
              </div>
            )}
          </div>
        </section>

        <section className="ccm__section">
          <h3 className="ccm__section-title"><CreditCard size={13} />Оплата</h3>
          <div className="ccm__info-grid">
            <div className="ccm__info-row">
              <span className="ccm__info-label">Цена</span>
              <span className="ccm__info-val ccm__price">
                {formatMoney(priceFinal)}
                {discountPct > 0 && <span className="ccm__discount-badge">−{discountPct}%</span>}
              </span>
            </div>
            <div className="ccm__info-row">
              <span className="ccm__info-label">Статус</span>
              <span className={`ccm__badge ${paid ? 'ccm__badge--paid' : 'ccm__badge--unpaid'}`}>
                {paid ? 'Оплачено' : 'Не оплачено'}
              </span>
            </div>
          </div>
        </section>

        {comment && (
          <section className="ccm__section">
            <h3 className="ccm__section-title"><MessageSquare size={13} />Комментарий</h3>
            <p className="ccm__comment">{comment}</p>
          </section>
        )}
      </div>
    </>
  );
};

const ActivityDetailModal = ({ entry, onClose, sports = [], trainers = [] }) => {
  useModalEffect(true, onClose);
  if (!entry) return null;

  const isUpdate = entry.actionType === 'update' && entry.changes?.length;
  const isDelete = entry.actionType === 'delete' && entry.snapshot?.length;
  const isClientCard = entry.section === 'clients' && isDelete;
  const Icon = entry.actionType === 'delete' ? Trash2 : Pencil;

  const content = (
    <div className={`activity-detail-modal__backdrop${isClientCard ? ' ccm__backdrop' : ''}`} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="activity-detail-title">
      <div className={isClientCard ? 'ccm' : 'activity-detail-modal'} onClick={(e) => e.stopPropagation()}>
        {isClientCard ? (
          <>
            <ClientSnapshotCard entry={entry} sports={sports} trainers={trainers} onClose={onClose} />
            <div className="ccm__actions">
              <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
            </div>
          </>
        ) : (
          <>
            <div className="activity-detail-modal__header">
              <h2 id="activity-detail-title" className="activity-detail-modal__title">
                <Icon size={18} /> {entry.entityLabel}
              </h2>
              <button type="button" className="activity-detail-modal__close" onClick={onClose} aria-label="Закрыть">
                <X size={18} />
              </button>
            </div>

            <div className="activity-detail-modal__meta">
              <span className={`ui-pill ${ACTION_TYPES[entry.actionType]?.cls ?? ''}`}>{ACTION_TYPES[entry.actionType]?.label ?? entry.actionType}</span>
              <span className="activity-detail-modal__meta-text">
                <strong>{entry.actorName}</strong> ({entry.actorRole}) · {SECTIONS[entry.section] ?? entry.section}
              </span>
            </div>

            <div className="activity-detail-modal__body">
              {isUpdate && (
                <>
                  <p className="activity-detail-modal__section-label">Что изменилось</p>
                  <div className="activity-detail-modal__diff">
                    {entry.changes.map((c, i) => (
                      <div key={i} className="activity-detail-modal__diff-row">
                        <span className="activity-detail-modal__diff-field">{formatFieldLabel(c.field)}</span>
                        <span className="activity-detail-modal__diff-before">{formatFieldValue(c.field, c.before, { sports })}</span>
                        <span className="activity-detail-modal__diff-arrow">→</span>
                        <span className="activity-detail-modal__diff-after">{formatFieldValue(c.field, c.after, { sports })}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {isDelete && (
                <>
                  <p className="activity-detail-modal__section-label">Что было удалено</p>
                  <div className="activity-detail-modal__snapshot">
                    {entry.snapshot.map((s, i) => {
                      const value = formatFieldValue(s.field, s.value, { sports });
                      return (
                        <div key={i} className="activity-detail-modal__snapshot-row">
                          <span className="activity-detail-modal__snapshot-field">{formatFieldLabel(s.field)}</span>
                          <span className={`activity-detail-modal__snapshot-value${value === '—' ? ' activity-detail-modal__snapshot-value--empty' : ''}`}>{value}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {!isUpdate && !isDelete && (
                <p className="activity-detail-modal__text">{entry.description}</p>
              )}
            </div>

            <div className="activity-detail-modal__actions">
              <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ActivityDetailModal;
