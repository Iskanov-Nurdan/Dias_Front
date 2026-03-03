import React from 'react';
import { createPortal } from 'react-dom';
import { formatMoney } from '../../../shared/constants/common';
import './ClientCardModal.scss';

const ClientCardModal = ({ client, onEdit, onDelete, onClose }) => {
  if (!client) return null;
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
          <dt>Цена</dt><dd>{formatMoney(client.price)}</dd>
          <dt>Оплачено</dt><dd>{client.paid ? 'Да' : 'Нет'}</dd>
          <dt>Тип</dt><dd>{client.clientType || '—'}</dd>
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
