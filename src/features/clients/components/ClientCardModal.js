import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, isClientPaid } from '../../../shared/constants/common';
import { fetchClientOneTimePayments, deleteOneTimePayment } from '../api';
import { useToast } from '../../../app/providers/ToastProvider';
import { isPeriodClosedError } from '../../../shared/lib/apiError';
import { ConfirmModal } from '../../../shared/ui';
import './ClientCardModal.scss';

const ClientCardModal = ({ client, onEdit, onDelete, onRefresh, onClose }) => {
  const toast = useToast();
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
  const priceDisplay = client.priceDisplay ?? client.totalPrice ?? client.price_display ?? client.total_price;
  const priceBase = Number(client.price) || 0;
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  const priceFinal = priceDisplay != null ? Number(priceDisplay) : (discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase);
  const content = (
    <div className="client-card-modal__backdrop" onClick={onClose}>
      <div className="client-card-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="client-card-modal__title">Карточка клиента</h2>
        <dl className="client-card-modal__dl">
          <dt>ФИО</dt><dd>{client.fio || '—'}</dd>
          <dt>Телефон</dt><dd>{client.phone || '—'}</dd>
          <dt>Вид спорта</dt><dd>{client.sportName ?? client.sport?.name ?? '—'}</dd>
          <dt>Тренер</dt><dd>{client.trainerName ?? client.trainer?.fio ?? '—'}</dd>
          <dt>Дата начала</dt><dd>{client.dateStart ? new Date(client.dateStart).toLocaleDateString() : '—'}</dd>
          {discountPct > 0 && <><dt>Скидка</dt><dd>{discountPct}%</dd></>}
          <dt>Цена</dt><dd>{formatMoney(priceFinal)}</dd>
          <dt>Оплачено</dt><dd>{isClientPaid(client) ? 'Да' : 'Нет'}</dd>
          <dt>Тип</dt><dd className={client.clientType === 'individual' ? 'client-card-modal__type-cell client-card-modal__type-cell--individual' : client.clientType === 'one-time' ? 'client-card-modal__type-cell client-card-modal__type-cell--one-time' : ''}>{client.clientType === 'individual' ? 'Индивидуальный' : client.clientType === 'regular' ? 'Регулярный' : client.clientType === 'one-time' ? 'Разовый' : client.clientType || '—'}</dd>
          <dt>Комментарий</dt><dd>{client.comment || '—'}</dd>
        </dl>
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
          <button type="button" className="client-card-modal__btn" onClick={() => { onEdit(client); onClose(); }}>Редактировать</button>
          <button type="button" className="client-card-modal__btn client-card-modal__btn--danger" onClick={() => { onDelete(client); onClose(); }}>Удалить</button>
          <button type="button" className="client-card-modal__btn client-card-modal__btn--cancel" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ClientCardModal;
