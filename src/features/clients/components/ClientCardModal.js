import React, { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Calendar, User, Clock, CreditCard, MessageSquare, Snowflake, Pencil, Trash2, CircleCheck, CircleAlert, Ticket, History, MessageCircle, ChevronDown, FileClock } from 'lucide-react';
import { formatMoney, isClientPaid, formatSubscriptionEnd } from '../../../shared/constants/common';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage, isPeriodClosedError } from '../../../shared/lib/apiError';
import { WEEKDAYS } from '../../sports-trainers/scheduleConstants';
import { getClientPaymentsForCard } from '../lib/clientActualPayments';
import { createClientFreeze, deleteClientFreeze, fetchClient, updateClientFreeze } from '../api';
import { getPaymentKindLabel } from '../lib/paymentKinds';
import { fetchClientChanges, fetchClientHistory } from '../api';
import { formatFieldLabel, formatFieldValue } from '../../../shared/lib/auditFormat';
import {
  formatFreezeDateLabel,
  formatFreezeDateTimeLabel,
  freezeStatusLabel,
  getFreezeFromClient,
} from '../lib/clientFreezeNormalize';
import { ConfirmModal } from '../../../shared/ui';
import ClientFreezeModal from './ClientFreezeModal';
import './ClientCardModal.scss';

const formatHm = (v) => {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : s;
};

const formatDaysRu = (n) => {
  const x = Math.abs(Number(n)) % 100;
  const d = x % 10;
  if (x > 10 && x < 20) return `${n} дней`;
  if (d === 1) return `${n} день`;
  if (d >= 2 && d <= 4) return `${n} дня`;
  return `${n} дней`;
};

const formatTrainingScheduleLabel = (client) => {
  // Полный список дней (напр. Пн/Ср/Пт) — trainingWeekday сам по себе
  // помнит только первый день группы (см. ClientTrainingDay на бэкенде),
  // раньше карточка честно показывала именно эту неполную правду.
  const rawDays = client?.trainingWeekdays ?? client?.training_weekdays;
  const tw = client?.trainingWeekday ?? client?.training_weekday;
  const days = Array.isArray(rawDays) && rawDays.length > 0
    ? rawDays
    : (tw != null && tw !== '' ? [tw] : []);
  const tf = formatHm(client?.trainingTimeFrom ?? client?.training_time_from);
  const tt = formatHm(client?.trainingTimeTo ?? client?.training_time_to);
  const hasDay = days.length > 0;
  const hasTime = Boolean(tf || tt);
  if (!hasDay && !hasTime) return null;
  // Один день — полное название («Понедельник»), как и раньше. Несколько —
  // короткими сокращениями через запятую («Пн, Ср, Пт»): «Понедельник,
  // Среда, Пятница, 18:00–19:00» не влезало бы в строку карточки.
  let dayPart = '';
  if (hasDay) {
    const metas = days
      .map((d) => WEEKDAYS.find((w) => w.weekday === Number(d)))
      .filter(Boolean)
      .sort((a, b) => a.weekday - b.weekday);
    if (metas.length === 1) dayPart = metas[0].label;
    else if (metas.length > 1) dayPart = metas.map((m) => m.short).join(', ');
    else dayPart = `День ${days[0]}`;
  }
  let timePart = '';
  if (tf && tt) timePart = `${tf}–${tt}`;
  else if (tf) timePart = `с ${tf}`;
  else if (tt) timePart = `до ${tt}`;
  if (dayPart && timePart) return `${dayPart}, ${timePart}`;
  return dayPart || timePart || null;
};

const CLIENT_TYPE_MAP = {
  individual: { label: 'Индивидуальный', cls: 'ccm__badge--individual' },
  regular:    { label: 'Регулярный',     cls: 'ccm__badge--regular'    },
  'one-time': { label: 'Разовый',        cls: 'ccm__badge--onetime'    },
};

const ClientCardModal = ({
  client, onEdit, onDelete, onClose, onClientUpdated, canManage = true,
  canManageFreeze = false, onFreezeAccessDenied, fullscreen = false,
}) => {
  const toast = useToast();
  useModalEffect(!!client, onClose);

  const [freezeModalMode, setFreezeModalMode] = useState(null);
  const [freezeFormError, setFreezeFormError] = useState(null);
  const [freezeSaving, setFreezeSaving] = useState(false);
  const [deleteFreezeOpen, setDeleteFreezeOpen] = useState(false);

  const paymentKindRaw = client?.paymentKind ?? client?.payment_kind ?? '';
  const paymentKindLabel = getPaymentKindLabel(paymentKindRaw) || '';

  /**
   * История периодов. В базе каждый месяц — отдельная запись, поэтому карточка
   * показывала только текущий период, а прошлые искали поиском по ФИО.
   * Грузим по требованию: открывать её нужно не всегда.
   */
  const [history, setHistory] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  /**
   * История лежит в самом низу карточки, поэтому при раскрытии подводим блок
   * в зону видимости: иначе панель открывается ниже границы окна и создаёт
   * впечатление, что ничего не произошло.
   */
  const historyRef = useRef(null);

  /**
   * Последние изменения карточки.
   *
   * Кто поменял цену, тренера или статус оплаты, было видно только в журнале
   * действий — а он закрыт отдельным правом, и найти там правки одного
   * человека среди тысяч записей практически нельзя. Грузим по требованию.
   */
  const [changes, setChanges] = useState(null);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesLoading, setChangesLoading] = useState(false);
  const changesRef = useRef(null);

  const loadChanges = async () => {
    if (changesOpen) { setChangesOpen(false); return; }
    setChangesOpen(true);
    const reveal = () => {
      window.setTimeout(
        () => changesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        60,
      );
    };
    if (changes || !client?.id) { reveal(); return; }
    setChangesLoading(true);
    try {
      setChanges(await fetchClientChanges(client.id, 15, null));
    } catch {
      // Журнал не отвечает — блок просто скажет, что записей нет
      setChanges({ items: [] });
    } finally {
      setChangesLoading(false);
      reveal();
    }
  };

  const loadHistory = async () => {
    if (historyOpen) { setHistoryOpen(false); return; }
    setHistoryOpen(true);
    const reveal = () => {
      window.setTimeout(
        () => historyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
        60,
      );
    };
    if (history || !client?.id) { reveal(); return; }
    setHistoryLoading(true);
    try {
      setHistory(await fetchClientHistory(client.id, null));
    } catch {
      setHistory({ items: [], summary: {} });
    } finally {
      setHistoryLoading(false);
      reveal();
    }
  };

  const subEnd = formatSubscriptionEnd(client);
  const paymentKindReceiptAmount = client?.paymentKindReceiptAmount ?? client?.payment_kind_receipt_amount;
  const paymentKindCashAmount = client?.paymentKindCashAmount ?? client?.payment_kind_cash_amount;

  const applyClientFromServer = useCallback(async (payload) => {
    let next = payload;
    if (!next?.id && client?.id) {
      try { next = await fetchClient(client.id, null); }
      catch (e) { toast.error(getApiErrorMessage(e)); return; }
    }
    if (next?.id) onClientUpdated?.(next);
  }, [client?.id, onClientUpdated, toast]);

  const handleFreezeSubmit = async (body) => {
    if (!client?.id) return;
    setFreezeFormError(null);
    setFreezeSaving(true);
    try {
      const updated = freezeModalMode === 'edit'
        ? await updateClientFreeze(client.id, body, null)
        : await createClientFreeze(client.id, body, null);
      await applyClientFromServer(updated);
      setFreezeModalMode(null);
      toast.success(freezeModalMode === 'edit' ? 'Заморозка обновлена' : 'Заморозка сохранена');
    } catch (e) {
      setFreezeFormError(isPeriodClosedError(e) ? 'Период закрыт.' : getApiErrorMessage(e));
    } finally { setFreezeSaving(false); }
  };

  const handleDeleteFreeze = async () => {
    if (!client?.id) return;
    try {
      const updated = await deleteClientFreeze(client.id, null);
      await applyClientFromServer(updated);
      toast.success('Заморозка удалена');
    } catch (e) {
      toast.error(isPeriodClosedError(e) ? 'Период закрыт.' : getApiErrorMessage(e));
    }
  };

  const openFreezeModal = (mode) => {
    if (!canManageFreeze) { onFreezeAccessDenied?.(); return; }
    setFreezeFormError(null);
    setFreezeModalMode(mode);
  };

  if (!client) return null;

  const freeze = getFreezeFromClient(client);
  const hasFreeze = Boolean(freeze);
  const dateStartRaw = client.dateStart ?? client.date_start;
  const paymentParts = getClientPaymentsForCard(client);
  const priceDisplay = client.priceDisplay ?? client.totalPrice ?? client.price_display ?? client.total_price;
  const priceBase = Number(client.price) || 0;
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  const priceFinal = priceDisplay != null ? Number(priceDisplay) : discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase;
  const paid = isClientPaid(client);
  const typeInfo = CLIENT_TYPE_MAP[client.clientType] || null;
  const scheduleLabel = formatTrainingScheduleLabel(client);
  const initials = (client.fio || '').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  const content = (
    <div
      className={`ccm__backdrop${fullscreen ? ' ccm__backdrop--fullscreen' : ''}`}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-labelledby="ccm-title"
    >
      <div className={`ccm${fullscreen ? ' ccm--fullscreen' : ''}`} onClick={(e) => e.stopPropagation()}>

        {/* ── Шапка ── */}
        <div className="ccm__header">
          <div className="ccm__header-info">
            <div className="ccm__avatar">{initials || <User size={18} />}</div>
            <div className="ccm__header-text">
              <h2 id="ccm-title" className="ccm__name">{client.fio || '—'}</h2>
              {client.phone ? (
                <span className="ccm__contacts">
                  <a href={`tel:${client.phone}`} className="ccm__phone">
                    <Phone size={12} />{client.phone}
                  </a>
                  {/* Написать прямо отсюда: номер уже есть, раньше его копировали руками */}
                  {String(client.phone).replace(/\D/g, '').length >= 9 && (
                    <a
                      href={`https://wa.me/${String(client.phone).replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ccm__wa"
                      title="Написать в WhatsApp"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  )}
                </span>
              ) : (
                <span className="ccm__phone ccm__phone--empty">Телефон не указан</span>
              )}
            </div>
          </div>
          <button type="button" className="ccm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        <div className="ccm__body">

          {/* ── Абонемент ── */}
          <section className="ccm__section">
            <h3 className="ccm__section-title">
              <span className="ccm__section-icon"><Ticket size={13} /></span>
              Абонемент
            </h3>
            <div className="ccm__info-grid">
              {(client.sportName ?? client.sport?.name) && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Вид спорта</span>
                  <span className="ccm__info-val">{client.sportName ?? client.sport?.name}</span>
                </div>
              )}
              {/* Дата окончания приходила с сервера, но в карточке не показывалась */}
              {subEnd && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Действует до</span>
                  <span className={`ccm__info-val ccm__until ccm__until--${subEnd.tone}`}>
                    {subEnd.text}
                    {subEnd.note && <span className="ccm__until-note">{subEnd.note}</span>}
                  </span>
                </div>
              )}
              {(client.trainerName ?? client.trainer?.fio) && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Тренер</span>
                  <span className="ccm__info-val">{client.trainerName ?? client.trainer?.fio}</span>
                </div>
              )}
              {scheduleLabel && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label"><Clock size={11} />Время</span>
                  <span className="ccm__info-val">{scheduleLabel}</span>
                </div>
              )}
              {dateStartRaw && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label"><Calendar size={11} />Дата начала</span>
                  <span className="ccm__info-val">{new Date(dateStartRaw).toLocaleDateString('ru-RU')}</span>
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

          {/* ── Оплата ── */}
          <section className="ccm__section ccm__section--payment">
            <h3 className="ccm__section-title">
              <span className="ccm__section-icon"><CreditCard size={13} /></span>
              Оплата
            </h3>
            <div className="ccm__price-hero">
              <span className="ccm__price-hero-label">Цена абонемента</span>
              <span className="ccm__price-hero-row">
                <strong className="ccm__price-hero-value">{formatMoney(priceFinal)}</strong>
                {discountPct > 0 && <span className="ccm__discount-badge">−{discountPct}%</span>}
              </span>
            </div>
            <div className="ccm__info-grid">
              <div className="ccm__info-row">
                <span className="ccm__info-label">Статус</span>
                <span className={`ccm__badge ${paid ? 'ccm__badge--paid' : 'ccm__badge--unpaid'}`}>
                  {paid ? <CircleCheck size={12} /> : <CircleAlert size={12} />}
                  {paid ? 'Оплачено' : 'Не оплачено'}
                </span>
              </div>
              {paymentKindLabel && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Способ оплаты</span>
                  <span className="ccm__info-val">{paymentKindLabel}</span>
                </div>
              )}
              {paymentKindRaw === 'mixed' && (paymentKindReceiptAmount != null || paymentKindCashAmount != null) && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label" />
                  <span className="ccm__info-val ccm__mixed-split">
                    <span className="ccm__mixed-split-item">Чек: {formatMoney(paymentKindReceiptAmount || 0)}</span>
                    <span className="ccm__mixed-split-item">Наличные: {formatMoney(paymentKindCashAmount || 0)}</span>
                  </span>
                </div>
              )}
              {paymentParts.length > 0 && (
                <div className="ccm__info-row ccm__info-row--col">
                  <span className="ccm__info-label">Частичные оплаты</span>
                  <div className="ccm__payments">
                    {paymentParts.map((p, i) => {
                      const dateStr = p.date
                        ? new Date(Number(p.date.slice(0,4)), Number(p.date.slice(5,7))-1, Number(p.date.slice(8,10))).toLocaleDateString('ru-RU')
                        : '—';
                      const amtStr = p.amount != null && Number.isFinite(p.amount)
                        ? `${Number(p.amount).toLocaleString('ru-RU')} сом` : null;
                      return (
                        <div key={i} className="ccm__payment-row">
                          {amtStr && <strong>{amtStr}</strong>}
                          <span>{dateStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* ── Заморозка ── */}
          <section className="ccm__section ccm__section--freeze">
            <div className="ccm__freeze-head">
              <h3 className="ccm__section-title">
                <span className="ccm__section-icon ccm__section-icon--freeze"><Snowflake size={13} /></span>
                Заморозка
              </h3>
              {canManageFreeze && (
                <div className="ccm__freeze-btns">
                  {!hasFreeze ? (
                    <button type="button" className="ccm__btn-mini ccm__btn-mini--freeze" onClick={() => openFreezeModal('create')}>
                      <Snowflake size={12} /> Заморозить
                    </button>
                  ) : (
                    <>
                      <button type="button" className="ccm__btn-mini ccm__btn-mini--edit" onClick={() => openFreezeModal('edit')}>
                        <Pencil size={12} /> Изменить
                      </button>
                      <button type="button" className="ccm__btn-mini ccm__btn-mini--danger" onClick={() => setDeleteFreezeOpen(true)}>
                        <Trash2 size={12} /> Удалить
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {!hasFreeze ? (
              <p className="ccm__freeze-empty">Заморозки нет</p>
            ) : (
              <div className="ccm__info-grid">
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Статус</span>
                  <span className="ccm__badge ccm__badge--freeze">{freezeStatusLabel(freeze.status)}</span>
                </div>
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Дней</span>
                  <span className="ccm__info-val">{formatDaysRu(freeze.days)}</span>
                </div>
                {freeze.reason && (
                  <div className="ccm__info-row">
                    <span className="ccm__info-label">Причина</span>
                    <span className="ccm__info-val">{freeze.reason}</span>
                  </div>
                )}
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Дата до</span>
                  <span className="ccm__info-val">{formatFreezeDateLabel(freeze.dateStartBefore)}</span>
                </div>
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Дата после</span>
                  <span className="ccm__info-val">{formatFreezeDateLabel(freeze.dateStartAfter)}</span>
                </div>
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Добавил</span>
                  <span className="ccm__info-val">{freeze?.createdBy?.fio ?? '—'}</span>
                </div>
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Создана</span>
                  <span className="ccm__info-val">{formatFreezeDateTimeLabel(freeze.createdAt)}</span>
                </div>
              </div>
            )}
          </section>

          {/* ── Комментарий ── */}
          {client.comment && (
            <section className="ccm__section">
              <h3 className="ccm__section-title">
                <span className="ccm__section-icon"><MessageSquare size={13} /></span>
                Комментарий
              </h3>
              <p className="ccm__comment">{client.comment}</p>
            </section>
          )}

        </div>

        {/* ── История периодов ── */}
        {client?.id && (
          <div className="ccm__history" ref={historyRef}>
            <button
              type="button"
              className="ccm__history-toggle"
              onClick={loadHistory}
              aria-expanded={historyOpen}
            >
              <span className="ccm__history-toggle-icon"><History size={14} /></span>
              <span className="ccm__history-toggle-text">История посещений и оплат</span>
              {history?.summary?.periods != null && (
                <span className="ccm__history-count">{history.summary.periods}</span>
              )}
              {/* Шеврон вместо смены надписи «Скрыть/Показать»: состояние видно
                  по повороту, а название секции остаётся на месте */}
              <ChevronDown
                size={16}
                className={`ccm__history-chevron${historyOpen ? ' ccm__history-chevron--open' : ''}`}
                aria-hidden
              />
            </button>
            {historyOpen && (
              historyLoading ? (
                <p className="ccm__history-loading">Загрузка…</p>
              ) : !history?.items?.length ? (
                <p className="ccm__history-loading">Других периодов нет</p>
              ) : (
                <div className="ccm__history-panel">
                  {/* Слева справочное, справа деньги: раньше четыре одинаковые
                      плитки весили поровну, хотя заходят сюда ради сумм */}
                  <div className="ccm__history-summary">
                    <div className="ccm__history-stat">
                      <span className="ccm__history-stat-label">Периодов</span>
                      <span className="ccm__history-stat-value">{history.summary.periods}</span>
                    </div>
                    <div className="ccm__history-stat">
                      <span className="ccm__history-stat-label">Занимается с</span>
                      <span className="ccm__history-stat-value">
                        {history.summary.firstDate ? new Date(history.summary.firstDate).toLocaleDateString('ru-RU') : '—'}
                      </span>
                    </div>
                    <div className="ccm__history-stat ccm__history-stat--money ccm__history-stat--paid">
                      <span className="ccm__history-stat-label">Оплачено</span>
                      <span className="ccm__history-stat-value">{formatMoney(history.summary.collectedTotal)}</span>
                    </div>
                    {history.summary.debtTotal > 0 && (
                      <div className="ccm__history-stat ccm__history-stat--money ccm__history-stat--debt">
                        <span className="ccm__history-stat-label">Долг</span>
                        <span className="ccm__history-stat-value">{formatMoney(history.summary.debtTotal)}</span>
                      </div>
                    )}
                  </div>
                  <ul className="ccm__history-list">
                    {history.items.map((h) => {
                      const isCurrent = String(h.id) === String(client.id);
                      return (
                        <li key={h.id} className={`ccm__history-row${isCurrent ? ' ccm__history-row--current' : ''}`}>
                          {/* Дата и вид спорта — левый блок в две строки, деньги
                              и статус — правый. Раньше четыре колонки одной
                              линией наезжали друг на друга, а бейдж «сейчас»
                              перекрывал название секции */}
                          <span className="ccm__history-main">
                            <span className="ccm__history-date">
                              {h.dateStart ? new Date(h.dateStart).toLocaleDateString('ru-RU') : '—'}
                              {isCurrent && <span className="ccm__history-now">сейчас</span>}
                            </span>
                            <span className="ccm__history-sport">{h.sportName ?? h.sport?.name ?? '—'}</span>
                          </span>
                          <span className="ccm__history-money">
                            <span className="ccm__history-price">{formatMoney(h.priceDisplay ?? h.price)}</span>
                            <span className={`ccm__history-status ccm__history-status--${h.fullyPaid ? 'ok' : 'debt'}`}>
                              {h.fullyPaid ? 'оплачен' : `долг ${Number(h.debt || 0).toLocaleString('ru-RU')} сом`}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )
            )}
          </div>
        )}

        {/* ── Последние изменения ── */}
        {client?.id && (
          <div className="ccm__history ccm__changes" ref={changesRef}>
            <button
              type="button"
              className="ccm__history-toggle"
              onClick={loadChanges}
              aria-expanded={changesOpen}
            >
              <span className="ccm__history-toggle-icon"><FileClock size={14} /></span>
              <span className="ccm__history-toggle-text">Последние изменения</span>
              {changes?.items?.length > 0 && (
                <span className="ccm__history-count">{changes.items.length}</span>
              )}
              <ChevronDown
                size={16}
                className={`ccm__history-chevron${changesOpen ? ' ccm__history-chevron--open' : ''}`}
                aria-hidden
              />
            </button>
            {changesOpen && (
              changesLoading ? (
                <p className="ccm__history-loading">Загрузка…</p>
              ) : !changes?.items?.length ? (
                <p className="ccm__history-loading">Изменений не зафиксировано</p>
              ) : (
                <ul className="ccm__changes-list">
                  {changes.items.map((entry) => (
                    <li key={entry.id} className="ccm__changes-row">
                      <div className="ccm__changes-head">
                        <span className="ccm__changes-who">{entry.actorName || 'Неизвестно'}</span>
                        <span className="ccm__changes-when">
                          {new Date(entry.createdAt).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', year: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <span className="ccm__changes-what">{entry.description || '—'}</span>
                      {/* Сами правки: «что было → что стало». Без этого запись
                          сообщает лишь факт правки, а не её содержание */}
                      {entry.changes?.length > 0 && (
                        <ul className="ccm__changes-diff">
                          {entry.changes.map((ch) => (
                            <li key={ch.field} className="ccm__changes-diff-row">
                              <span className="ccm__changes-field">{formatFieldLabel(ch.field)}</span>
                              {/* Сервер присылает beforeLabel/afterLabel для полей
                                  со ссылками — без них было бы «Тренер: №6 → №12» */}
                              <span className="ccm__changes-before">
                                {ch.beforeLabel ?? formatFieldValue(ch.field, ch.before)}
                              </span>
                              <span className="ccm__changes-arrow" aria-hidden>→</span>
                              <span className="ccm__changes-after">
                                {ch.afterLabel ?? formatFieldValue(ch.field, ch.after)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )
            )}
          </div>
        )}

        {/* ── Кнопки ── */}
        {/* Кнопки правки видит только тот, кто может ими пользоваться: раньше они
            показывались всем и лишь по клику выдавали «У вас нет доступа». */}
        <div className="ccm__actions">
          {canManage && (
            <>
              <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={() => { onEdit(client); onClose(); }}>
                <Pencil size={15} /> Редактировать
              </button>
              <button type="button" className="ui-modal-btn ui-modal-btn--danger" onClick={() => { onDelete(client); onClose(); }}>
                <Trash2 size={15} /> Удалить
              </button>
            </>
          )}
          <button type="button" className="ui-modal-btn" onClick={onClose}><X size={15} /> Закрыть</button>
        </div>
      </div>

      <ClientFreezeModal
        open={freezeModalMode != null}
        mode={freezeModalMode === 'edit' ? 'edit' : 'create'}
        initialDays={freeze?.days ?? 1}
        initialReason={freeze?.reason ?? ''}
        clientFio={client.fio}
        onSubmit={handleFreezeSubmit}
        onClose={() => { if (!freezeSaving) setFreezeModalMode(null); }}
        error={freezeFormError}
        saving={freezeSaving}
        fullscreen={fullscreen}
      />

      {deleteFreezeOpen && (
        <ConfirmModal
          title="Удалить заморозку?"
          message={`Вернуть дату начала к исходной (${formatFreezeDateLabel(freeze?.dateStartBefore)})?`}
          confirmText="Удалить"
          onConfirm={handleDeleteFreeze}
          onCancel={() => setDeleteFreezeOpen(false)}
          danger
        />
      )}
    </div>
  );

  return createPortal(content, document.body);
};

export default ClientCardModal;
