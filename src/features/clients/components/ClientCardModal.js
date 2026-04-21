import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
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

/** Склонение «N дней» */
const formatDaysRu = (n) => {
  const x = Math.abs(Number(n)) % 100;
  const d = x % 10;
  if (x > 10 && x < 20) return `${n} дней`;
  if (d === 1) return `${n} день`;
  if (d >= 2 && d <= 4) return `${n} дня`;
  return `${n} дней`;
};

/** Строка для карточки: день недели + интервал из training_* */
const formatTrainingScheduleLabel = (client) => {
  const tw = client?.trainingWeekday ?? client?.training_weekday;
  const tf = formatHm(client?.trainingTimeFrom ?? client?.training_time_from);
  const tt = formatHm(client?.trainingTimeTo ?? client?.training_time_to);
  const hasDay = tw != null && tw !== '';
  const hasTime = Boolean(tf || tt);
  if (!hasDay && !hasTime) return '—';
  const dayMeta = hasDay ? WEEKDAYS.find((w) => w.weekday === Number(tw)) : null;
  const dayPart = dayMeta ? dayMeta.label : hasDay ? `День ${tw}` : '';
  let timePart = '';
  if (tf && tt) timePart = `${tf}–${tt}`;
  else if (tf) timePart = `с ${tf}`;
  else if (tt) timePart = `до ${tt}`;
  if (dayPart && timePart) return `${dayPart}, ${timePart}`;
  return dayPart || timePart || '—';
};

const ClientCardModal = ({
  client,
  onEdit,
  onDelete,
  onClose,
  onClientUpdated,
  canManageFreeze = false,
  onFreezeAccessDenied,
  fullscreen = false,
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
    if (!client?.id) {
      setCardPhotos([]);
      setCardPhotosLoading(false);
      return undefined;
    }
    let cancelled = false;
    setCardPhotosLoading(true);
    fetchClientPhotos(client.id, null)
      .then((res) => {
        if (!cancelled) setCardPhotos(res?.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setCardPhotos([]);
      })
      .finally(() => {
        if (!cancelled) setCardPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.id]);

  const applyClientFromServer = useCallback(
    async (payload) => {
      let next = payload;
      if (!next?.id && client?.id) {
        try {
          next = await fetchClient(client.id, null);
        } catch (e) {
          const msg = getApiErrorMessage(e);
          toast.error(msg);
          return;
        }
      }
      if (next?.id) {
        onClientUpdated?.(next);
      }
    },
    [client?.id, onClientUpdated, toast]
  );

  const handleFreezeSubmit = async (body) => {
    if (!client?.id) return;
    setFreezeFormError(null);
    setFreezeSaving(true);
    try {
      const updated =
        freezeModalMode === 'edit'
          ? await updateClientFreeze(client.id, body, null)
          : await createClientFreeze(client.id, body, null);
      await applyClientFromServer(updated);
      setFreezeModalMode(null);
      toast.success(freezeModalMode === 'edit' ? 'Заморозка обновлена' : 'Заморозка сохранена');
    } catch (e) {
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение данных запрещено.'
        : getApiErrorMessage(e);
      setFreezeFormError(msg);
    } finally {
      setFreezeSaving(false);
    }
  };

  const handleDeleteFreeze = async () => {
    if (!client?.id) return;
    try {
      const updated = await deleteClientFreeze(client.id, null);
      await applyClientFromServer(updated);
      toast.success('Заморозка удалена');
    } catch (e) {
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение данных запрещено.'
        : getApiErrorMessage(e);
      toast.error(msg);
    }
  };

  const openFreezeModal = (mode) => {
    if (!canManageFreeze) {
      onFreezeAccessDenied?.();
      return;
    }
    setFreezeFormError(null);
    setFreezeModalMode(mode);
  };

  const freeze = client ? getFreezeFromClient(client) : null;
  const hasFreeze = Boolean(freeze);
  const freezeSummary =
    freeze?.reason != null && String(freeze.reason).trim() !== ''
      ? `Абонемент был заморожен на ${formatDaysRu(freeze.days)}. Причина: ${freeze.reason}.`
      : null;
  const createdByFio = freeze?.createdBy?.fio ?? '—';

  if (!client) return null;

  const dateStartRaw = client.dateStart ?? client.date_start;
  const paymentParts = getClientPaymentsForCard(client);
  const priceDisplay = client.priceDisplay ?? client.totalPrice ?? client.price_display ?? client.total_price;
  const priceBase = Number(client.price) || 0;
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  const priceFinal =
    priceDisplay != null ? Number(priceDisplay) : discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase;

  const content = (
    <div
      className={`client-card-modal__backdrop${fullscreen ? ' client-card-modal__backdrop--fullscreen' : ''}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-card-modal-title"
    >
      <div
        className={`client-card-modal${fullscreen ? ' client-card-modal--fullscreen' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="client-card-modal__header">
          <h2 id="client-card-modal-title" className="client-card-modal__title">
            Карточка клиента
          </h2>
          <button type="button" className="client-card-modal__close" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="client-card-modal__sections">
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Личные данные</h3>
            <dl className="client-card-modal__dl">
              <dt>ФИО</dt>
              <dd>{client.fio || '—'}</dd>
              <dt>Телефон</dt>
              <dd>{client.phone || '—'}</dd>
            </dl>
          </section>
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Абонемент</h3>
            <dl className="client-card-modal__dl">
              <dt>Вид спорта</dt>
              <dd>{client.sportName ?? client.sport?.name ?? '—'}</dd>
              <dt>Тренер</dt>
              <dd>{client.trainerName ?? client.trainer?.fio ?? '—'}</dd>
              <dt>Время занятия</dt>
              <dd>{formatTrainingScheduleLabel(client)}</dd>
              <dt>Дата начала</dt>
              <dd>{dateStartRaw ? new Date(dateStartRaw).toLocaleDateString('ru-RU') : '—'}</dd>
              <dt>Тип</dt>
              <dd
                className={
                  client.clientType === 'individual'
                    ? 'client-card-modal__type-cell client-card-modal__type-cell--individual'
                    : client.clientType === 'one-time'
                      ? 'client-card-modal__type-cell client-card-modal__type-cell--one-time'
                      : ''
                }
              >
                {client.clientType === 'individual'
                  ? 'Индивидуальный'
                  : client.clientType === 'regular'
                    ? 'Регулярный'
                    : client.clientType === 'one-time'
                      ? 'Разовый'
                      : client.clientType || '—'}
              </dd>
            </dl>
          </section>

          <section className="client-card-modal__section client-card-modal__section--freeze">
            <div className="client-card-modal__freeze-head">
              <h3 className="client-card-modal__section-title">Заморозка</h3>
              {canManageFreeze && (
                <div className="client-card-modal__freeze-actions">
                  {!hasFreeze ? (
                    <button
                      type="button"
                      className="client-card-modal__btn-mini client-card-modal__btn-mini--primary"
                      onClick={() => openFreezeModal('create')}
                    >
                      Заморозить
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="client-card-modal__btn-mini client-card-modal__btn-mini--primary"
                        onClick={() => openFreezeModal('edit')}
                      >
                        Изменить заморозку
                      </button>
                      <button
                        type="button"
                        className="client-card-modal__btn-mini client-card-modal__btn-mini--danger"
                        onClick={() => setDeleteFreezeOpen(true)}
                      >
                        Удалить заморозку
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <dl className="client-card-modal__dl">
              <dt>Статус</dt>
              <dd>{hasFreeze ? freezeStatusLabel(freeze.status) : 'Нет заморозки'}</dd>
              <dt>Дней заморозки</dt>
              <dd>{hasFreeze ? formatDaysRu(freeze.days) : '—'}</dd>
              <dt>Причина</dt>
              <dd className="client-card-modal__freeze-reason">{hasFreeze ? freeze.reason || '—' : '—'}</dd>
              <dt>Старая дата начала</dt>
              <dd>{hasFreeze ? formatFreezeDateLabel(freeze.dateStartBefore) : '—'}</dd>
              <dt>Новая дата начала</dt>
              <dd>{hasFreeze ? formatFreezeDateLabel(freeze.dateStartAfter) : '—'}</dd>
              <dt>Кто добавил</dt>
              <dd>{hasFreeze ? createdByFio : '—'}</dd>
              <dt>Дата создания заморозки</dt>
              <dd>{hasFreeze ? formatFreezeDateTimeLabel(freeze.createdAt) : '—'}</dd>
            </dl>
          </section>

          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Оплата</h3>
            <dl className="client-card-modal__dl">
              {discountPct > 0 && (
                <>
                  <dt>Скидка</dt>
                  <dd>{discountPct}%</dd>
                </>
              )}
              <dt>Цена</dt>
              <dd>{formatMoney(priceFinal)}</dd>
              <dt>Оплачено</dt>
              <dd>{isClientPaid(client) ? 'Да' : 'Нет'}</dd>
              <dt>Частичные оплаты</dt>
              <dd>
                {paymentParts.length === 0 ? (
                  '—'
                ) : (
                  <ul className="client-card-modal__payments-list">
                    {paymentParts.map((p, i) => {
                      const dateStr = p.date
                        ? new Date(
                            Number(p.date.slice(0, 4)),
                            Number(p.date.slice(5, 7)) - 1,
                            Number(p.date.slice(8, 10))
                          ).toLocaleDateString('ru-RU')
                        : '—';
                      const amtStr =
                        p.amount != null && Number.isFinite(p.amount)
                          ? `${Number(p.amount).toLocaleString('ru-RU')} сом`
                          : null;
                      return (
                        <li key={i} className="client-card-modal__payments-item">
                          {amtStr ? (
                            <>
                              <span className="client-card-modal__payments-amt">{amtStr}</span>
                              <span> · </span>
                            </>
                          ) : null}
                          <span className="client-card-modal__payments-date">{dateStr}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </dd>
            </dl>
          </section>
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Фото для сверки</h3>
            {cardPhotosLoading ? (
              <p className="client-card-modal__photos-status">Загрузка…</p>
            ) : cardPhotos.length === 0 ? (
              <p className="client-card-modal__photos-status">Нет фото</p>
            ) : (
              <ul className="client-card-modal__photos-grid" aria-label="Фото чеков и наличных">
                {cardPhotos.map((ph) => (
                  <li key={ph.id} className="client-card-modal__photos-item">
                    <a
                      href={ph.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-card-modal__photos-link"
                    >
                      <img src={ph.url} alt="" className="client-card-modal__photos-thumb" />
                      <span className="client-card-modal__photos-kind">{getClientPhotoKindLabel(ph.kind)}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Комментарий</h3>
            <p className="client-card-modal__comment">{client.comment || '—'}</p>
          </section>
        </div>

        {freezeSummary ? (
          <p className="client-card-modal__freeze-footer" role="status">
            {freezeSummary}
          </p>
        ) : null}

        <div className="client-card-modal__actions">
          <button
            type="button"
            className="client-card-modal__btn client-card-modal__btn--primary"
            onClick={() => {
              onEdit(client);
              onClose();
            }}
          >
            Редактировать
          </button>
          <button type="button" className="client-card-modal__btn" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            className="client-card-modal__btn client-card-modal__btn--danger"
            onClick={() => {
              onDelete(client);
              onClose();
            }}
          >
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
        onClose={() => {
          if (!freezeSaving) setFreezeModalMode(null);
        }}
        error={freezeFormError}
        saving={freezeSaving}
        fullscreen={fullscreen}
      />

      {deleteFreezeOpen && (
        <ConfirmModal
          title="Удалить заморозку?"
          message={`Вернуть дату начала абонемента к исходной (${formatFreezeDateLabel(freeze?.dateStartBefore)})? Текущая дата начала в карточке будет пересчитана.`}
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







