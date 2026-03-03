import React from 'react';
import { createPortal } from 'react-dom';
import { formatMoney, isClientPaid } from '../../../shared/constants/common';
import './ClientCardModal.scss';

const ClientCardModal = ({ client, onEdit, onDelete, onClose }) => {
  if (!client) return null;
  const priceBase = Number(client.price) || 0;
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  const priceFinal = discountPct > 0 ? priceBase * (1 - discountPct / 100) : priceBase;
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
          <dt>Тип</dt><dd><span className={client.clientType === 'individual' ? 'client-card-modal__type client-card-modal__type--individual' : ''}>{client.clientType === 'individual' ? 'Индивидуальный' : client.clientType === 'regular' ? 'Регулярный' : client.clientType || '—'}</span></dd>
          <dt>Комментарий</dt><dd>{client.comment || '—'}</dd>
        </dl>
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
