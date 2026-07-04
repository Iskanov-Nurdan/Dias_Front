import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Phone, Calendar, User, Dumbbell, Clock, CreditCard, Camera, MessageSquare, Snowflake } from 'lucide-react';
import { formatMoney, isClientPaid } from '../../../shared/constants/common';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage, isPeriodClosedError } from '../../../shared/lib/apiError';
import { WEEKDAYS } from '../../sports-trainers/scheduleConstants';
import { getClientPaymentsForCard } from '../lib/clientActualPayments';
import { createClientFreeze, deleteClientFreeze, fetchClient, fetchClientPhotos, updateClientFreeze } from '../api';
import { getClientPhotoKindLabel } from '../lib/clientPhotos';
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
  const tw = client?.trainingWeekday ?? client?.training_weekday;
  const tf = formatHm(client?.trainingTimeFrom ?? client?.training_time_from);
  const tt = formatHm(client?.trainingTimeTo ?? client?.training_time_to);
  const hasDay = tw != null && tw !== '';
  const hasTime = Boolean(tf || tt);
  if (!hasDay && !hasTime) return null;
  const dayMeta = hasDay ? WEEKDAYS.find((w) => w.weekday === Number(tw)) : null;
  const dayPart = dayMeta ? dayMeta.label : hasDay ? `День ${tw}` : '';
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
  client, onEdit, onDelete, onClose, onClientUpdated,
  canManageFreeze = false, onFreezeAccessDenied, fullscreen = false,
}) => {
  const toast = useToast();
  useModalEffect(!!client, onClose);

  const [cardPhotos, setCardPhotos] = React.useState([]);
  const [cardPhotosLoading, setCardPhotosLoading] = React.useState(false);
  const [freezeModalMode, setFreezeModalMode] = useState(null);
  const [freezeFormError, setFreezeFormError] = useState(null);
  const [freezeSaving, setFreezeSaving] = useState(false);
  const [deleteFreezeOpen, setDeleteFreezeOpen] = useState(false);

  React.useEffect(() => {
    if (!client?.id) { setCardPhotos([]); return undefined; }
    let cancelled = false;
    setCardPhotosLoading(true);
    fetchClientPhotos(client.id, null)
      .then((res) => { if (!cancelled) setCardPhotos(res?.items ?? []); })
      .catch(() => { if (!cancelled) setCardPhotos([]); })
      .finally(() => { if (!cancelled) setCardPhotosLoading(false); });
    return () => { cancelled = true; };
  }, [client?.id]);

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
            <div>
              <h2 id="ccm-title" className="ccm__name">{client.fio || '—'}</h2>
              {client.phone && (
                <a href={`tel:${client.phone}`} className="ccm__phone">
                  <Phone size={12} />{client.phone}
                </a>
              )}
            </div>
          </div>
          <button type="button" className="ccm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        <div className="ccm__body">

          {/* ── Абонемент ── */}
          <section className="ccm__section">
            <h3 className="ccm__section-title"><Dumbbell size={13} />Абонемент</h3>
            <div className="ccm__info-grid">
              {(client.sportName ?? client.sport?.name) && (
                <div className="ccm__info-row">
                  <span className="ccm__info-label">Вид спорта</span>
                  <span className="ccm__info-val">{client.sportName ?? client.sport?.name}</span>
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
              <h3 className="ccm__section-title"><Snowflake size={13} />Заморозка</h3>
              {canManageFreeze && (
                <div className="ccm__freeze-btns">
                  {!hasFreeze ? (
                    <button type="button" className="ccm__btn-mini ccm__btn-mini--freeze" onClick={() => openFreezeModal('create')}>
                      Заморозить
                    </button>
                  ) : (
                    <>
                      <button type="button" className="ccm__btn-mini ccm__btn-mini--edit" onClick={() => openFreezeModal('edit')}>Изменить</button>
                      <button type="button" className="ccm__btn-mini ccm__btn-mini--danger" onClick={() => setDeleteFreezeOpen(true)}>Удалить</button>
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

          {/* ── Фото ── */}
          {(cardPhotosLoading || cardPhotos.length > 0) && (
            <section className="ccm__section">
              <h3 className="ccm__section-title"><Camera size={13} />Фото для сверки</h3>
              {cardPhotosLoading ? (
                <p className="ccm__muted">Загрузка…</p>
              ) : (
                <ul className="ccm__photos">
                  {cardPhotos.map((ph) => (
                    <li key={ph.id}>
                      <a href={ph.url || '#'} target="_blank" rel="noopener noreferrer" className="ccm__photo-link">
                        <img src={ph.url} alt="" className="ccm__photo-thumb" />
                        <span className="ccm__photo-kind">{getClientPhotoKindLabel(ph.kind)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ── Комментарий ── */}
          {client.comment && (
            <section className="ccm__section">
              <h3 className="ccm__section-title"><MessageSquare size={13} />Комментарий</h3>
              <p className="ccm__comment">{client.comment}</p>
            </section>
          )}

        </div>

        {/* ── Кнопки ── */}
        <div className="ccm__actions">
          <button type="button" className="ccm__btn ccm__btn--primary" onClick={() => { onEdit(client); onClose(); }}>
            Редактировать
          </button>
          <button type="button" className="ccm__btn" onClick={onClose}>Закрыть</button>
          <button type="button" className="ccm__btn ccm__btn--danger" onClick={() => { onDelete(client); onClose(); }}>
            Удалить
          </button>
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
