import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { formatMoney, isClientPaid } from '../../../shared/constants/common';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import { fetchClientOneTimePayments, deleteOneTimePayment } from '../api';
import { useToast } from '../../../app/providers/ToastProvider';
import { isPeriodClosedError } from '../../../shared/lib/apiError';
import { ConfirmModal } from '../../../shared/ui';
import { WEEKDAYS } from '../../sports-trainers/scheduleConstants';
import { getClientPaymentsForCard } from '../lib/clientActualPayments';
import './ClientCardModal.scss';

const formatHm = (v) => {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  return /^\d{2}:\d{2}/.test(s) ? s.slice(0, 5) : s;
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

const ClientCardModal = ({ client, onEdit, onDelete, onRefresh, onClose }) => {
  const toast = useToast();

  useModalEffect(!!client, onClose);
  const [oneTimePayments, setOneTimePayments] = useState([]);
  const [oneTimeLoading, setOneTimeLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [onetimeExpanded, setOnetimeExpanded] = useState(false);
  const [confirmDeletePayment, setConfirmDeletePayment] = useState(null);

  useEffect(() => {
    if (!client?.id) return;
    setOneTimeLoading(true);
    fetchClientOneTimePayments(client.id, null)
      .then((res) => {
        const items = res?.items ?? res?.results ?? res?.data ?? [];
        setOneTimePayments(Array.isArray(items) ? items : []);
      })
      .catch(() => setOneTimePayments([]))
      .finally(() => setOneTimeLoading(false));
  }, [client?.id]);

  const handleDeleteOneTime = async (payment) => {
    if (!client?.id || !payment?.id) return;
    setConfirmDeletePayment(null);
    setDeletingId(payment.id);
    try {
      await deleteOneTimePayment(client.id, payment.id, null);
      setOneTimePayments((prev) => prev.filter((p) => p.id !== payment.id));
      onRefresh?.();
      toast.success('Доплата удалена');
    } catch (e) {
      const msg = isPeriodClosedError(e)
        ? 'Период закрыт. Изменение финансовых данных запрещено.'
        : (e.response?.data?.error?.message ?? e.response?.data?.message ?? e.message ?? 'Ошибка удаления');
      toast.error(msg);
    } finally {
      setDeletingId(null);
    }
  };

  if (!client) return null;
  const dateStartRaw = client.dateStart ?? client.date_start;
  const paymentParts = getClientPaymentsForCard(client);
  const priceDisplay = client.priceDisplay ?? client.totalPrice ?? client.price_display ?? client.total_price;
  const priceBase = Number(client.price) || 0;
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  const priceFinal = priceDisplay != null ? Number(priceDisplay) : (discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase);
  const content = (
    <div className="client-card-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="client-card-modal-title">
      <div className="client-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="client-card-modal__header">
          <h2 id="client-card-modal-title" className="client-card-modal__title">Карточка клиента</h2>
          <button type="button" className="client-card-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        <div className="client-card-modal__sections">
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Личные данные</h3>
            <dl className="client-card-modal__dl">
              <dt>ФИО</dt><dd>{client.fio || '—'}</dd>
              <dt>Телефон</dt><dd>{client.phone || '—'}</dd>
            </dl>
          </section>
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Абонемент</h3>
            <dl className="client-card-modal__dl">
              <dt>Вид спорта</dt><dd>{client.sportName ?? client.sport?.name ?? '—'}</dd>
              <dt>Тренер</dt><dd>{client.trainerName ?? client.trainer?.fio ?? '—'}</dd>
              <dt>Время занятия</dt><dd>{formatTrainingScheduleLabel(client)}</dd>
              <dt>Дата начала</dt><dd>{dateStartRaw ? new Date(dateStartRaw).toLocaleDateString() : '—'}</dd>
              <dt>Тип</dt><dd className={client.clientType === 'individual' ? 'client-card-modal__type-cell client-card-modal__type-cell--individual' : client.clientType === 'one-time' ? 'client-card-modal__type-cell client-card-modal__type-cell--one-time' : ''}>{client.clientType === 'individual' ? 'Индивидуальный' : client.clientType === 'regular' ? 'Регулярный' : client.clientType === 'one-time' ? 'Разовый' : client.clientType || '—'}</dd>
            </dl>
          </section>
          <section className="client-card-modal__section">
            <h3 className="client-card-modal__section-title">Оплата</h3>
            <dl className="client-card-modal__dl">
              {discountPct > 0 && <><dt>Скидка</dt><dd>{discountPct}%</dd></>}
              <dt>Цена</dt><dd>{formatMoney(priceFinal)}</dd>
              <dt>Оплачено</dt><dd>{isClientPaid(client) ? 'Да' : 'Нет'}</dd>
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
            <h3 className="client-card-modal__section-title">Комментарий</h3>
            <p className="client-card-modal__comment">{client.comment || '—'}</p>
          </section>
        </div>
        {oneTimePayments.length > 0 && (
          <div className="client-card-modal__onetime">
            <button
              type="button"
              className="client-card-modal__onetime-toggle"
              onClick={() => setOnetimeExpanded((v) => !v)}
              aria-expanded={onetimeExpanded}
            >
              <span className="client-card-modal__onetime-title">Разовые доплаты ({oneTimePayments.length})</span>
              <span className={`client-card-modal__onetime-chevron${onetimeExpanded ? ' client-card-modal__onetime-chevron--open' : ''}`} aria-hidden>▼</span>
            </button>
            {onetimeExpanded && (
              <ul className="client-card-modal__onetime-list">
                {oneTimePayments.map((p) => (
                  <li key={p.id} className="client-card-modal__onetime-item">
                    <span className="client-card-modal__onetime-amount">{formatMoney(p.amount)}</span>
                    <span className="client-card-modal__onetime-date">{p.date ? new Date(p.date).toLocaleDateString() : '—'}</span>
                    <button
                      type="button"
                      className="client-card-modal__onetime-delete"
                      onClick={() => setConfirmDeletePayment(p)}
                      disabled={deletingId === p.id}
                      title="Удалить доплату"
                    >
                      {deletingId === p.id ? '…' : '✕'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {oneTimeLoading && oneTimePayments.length === 0 && <p className="client-card-modal__onetime-loading">Загрузка доплат…</p>}
        {confirmDeletePayment && (
          <ConfirmModal
            title="Удалить доплату?"
            message={`Удалить доплату ${formatMoney(confirmDeletePayment.amount)} от ${confirmDeletePayment.date ? new Date(confirmDeletePayment.date).toLocaleDateString() : '—'}?`}
            confirmText="Удалить"
            onConfirm={() => handleDeleteOneTime(confirmDeletePayment)}
            onCancel={() => setConfirmDeletePayment(null)}
            danger
          />
        )}
        <div className="client-card-modal__actions">
          <button type="button" className="client-card-modal__btn client-card-modal__btn--primary" onClick={() => { onEdit(client); onClose(); }}>Редактировать</button>
          <button type="button" className="client-card-modal__btn" onClick={onClose}>Закрыть</button>
          <button type="button" className="client-card-modal__btn client-card-modal__btn--danger" onClick={() => { onDelete(client); onClose(); }}>Удалить</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ClientCardModal;
