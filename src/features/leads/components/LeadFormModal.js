import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../../shared/ui';
import './LeadFormModal.scss';

const CHANNEL_OPTIONS = [
  { value: '', label: 'Не выбрано' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Другое' },
];

const LeadFormModal = ({ lead, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState('');

  const isEdit = !!lead?.id;

  useEffect(() => {
    if (lead) {
      setName(lead.name ?? '');
      setPhone(lead.phone ?? '');
      setChannel(lead.channel ?? '');
    }
  }, [lead]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      channel: channel || undefined,
    });
  };

  const content = (
    <div className="lead-form-modal__backdrop" onClick={onClose}>
      <div className="lead-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lead-form-modal__head">
          <h2 className="lead-form-modal__title">{isEdit ? 'Редактировать заявку' : 'Новая заявка'}</h2>
          <button type="button" className="lead-form-modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {error && <p className="lead-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="lead-form-modal__form">
          <label className="lead-form-modal__label">
            <span className="lead-form-modal__label-text">Имя</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="lead-form-modal__input" placeholder="Имя клиента" />
          </label>
          <label className="lead-form-modal__label">
            <span className="lead-form-modal__label-text">Телефон</span>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="lead-form-modal__input" placeholder="+996 ..." />
          </label>
          <label className="lead-form-modal__label">
            <span className="lead-form-modal__label-text">Канал</span>
            <Select
              value={channel}
              onChange={setChannel}
              options={CHANNEL_OPTIONS}
              placeholder="Не выбрано"
              className="lead-form-modal__select"
            />
          </label>
          <div className="lead-form-modal__actions">
            <button type="button" className="lead-form-modal__btn lead-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="lead-form-modal__btn lead-form-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default LeadFormModal;
