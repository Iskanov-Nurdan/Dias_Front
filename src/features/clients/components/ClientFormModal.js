import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../../shared/ui';
import { isClientPaid } from '../../../shared/constants/common';
import './ClientFormModal.scss';

const ClientFormModal = ({ client, sports, fetchTrainers, onSave, onClose, error, saving }) => {
  const [fio, setFio] = useState('');
  const [phone, setPhone] = useState('');
  const [sportId, setSportId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [trainersList, setTrainersList] = useState([]);
  const [dateStart, setDateStart] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState(false);
  const [clientType, setClientType] = useState('regular');
  const [gender, setGender] = useState('');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (client) {
      setFio(client.fio || '');
      setPhone(client.phone || '');
      setSportId(client.sportId ?? client.sport_id ?? client.sport?.id ?? '');
      setTrainerId(client.trainerId ?? client.trainer_id ?? client.trainer?.id ?? '');
      setDateStart(client.dateStart ? client.dateStart.slice(0, 10) : '');
      setPrice(client.price ?? '');
      setDiscount(client.discount ?? '');
      setPaid(isClientPaid(client));
      setClientType(client.clientType || 'regular');
      setGender(client.gender || '');
      setComment(client.comment || '');
    }
  }, [client]);

  useEffect(() => {
    if (!fetchTrainers) return;
    if (sportId) {
      fetchTrainers({ sportId }, null)
        .then((d) => setTrainersList(d?.items ?? d?.results ?? (Array.isArray(d) ? d : []) ?? []))
        .catch(() => setTrainersList([]));
    } else {
      setTrainersList([]);
    }
  }, [sportId, fetchTrainers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      fio,
      phone,
      sportId: sportId || undefined,
      trainerId: trainerId || undefined,
      dateStart: dateStart || undefined,
      price: price ? Number(price) : undefined,
      discount: discount ? Number(discount) : undefined,
      paid,
      clientType,
      gender: gender || undefined,
      comment: comment || undefined,
    });
  };

  const content = (
    <div className="client-form-modal__backdrop" onClick={onClose}>
      <div className="client-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="client-form-modal__title">{client?.id ? 'Редактировать клиента' : 'Добавить клиента'}</h2>
        {error && <p className="client-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="client-form-modal__form">
          <div className="client-form-modal__row">
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">ФИО <span className="form-label-required" aria-hidden="true">*</span></span>
              <input type="text" value={fio} onChange={(e) => setFio(e.target.value)} required className="client-form-modal__input" />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Телефон</span>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="client-form-modal__input" />
            </label>
          </div>
          <div className="client-form-modal__row">
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Вид спорта</span>
              <Select value={String(sportId)} onChange={(v) => { setSportId(v); setTrainerId(''); }} options={[{ value: '', label: '—' }, ...(sports || []).map((s) => ({ value: String(s.id), label: s.name || '' }))]} placeholder="—" className="client-form-modal__select" />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Тренер</span>
              <Select value={String(trainerId)} onChange={(v) => setTrainerId(v)} options={[{ value: '', label: '—' }, ...(trainersList || []).map((t) => ({ value: String(t.id), label: t.fio || '' }))]} placeholder="—" className="client-form-modal__select" />
            </label>
          </div>
          <div className="client-form-modal__row">
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Дата начала</span>
              <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="client-form-modal__input" />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Цена</span>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="client-form-modal__input" placeholder="0" />
            </label>
          </div>
          <div className="client-form-modal__row">
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Скидка, %</span>
              <input type="number" min="0" max="100" value={discount} onChange={(e) => setDiscount(e.target.value)} className="client-form-modal__input" placeholder="0" />
            </label>
            <div className="client-form-modal__label client-form-modal__label--toggle">
              <span className="client-form-modal__label-text">Оплачено</span>
              <div className="client-form-modal__paid-toggle" role="group" aria-label="Статус оплаты">
                <button type="button" className={`client-form-modal__paid-option ${paid ? 'client-form-modal__paid-option--active' : ''}`} onClick={() => setPaid(true)}>Да</button>
                <button type="button" className={`client-form-modal__paid-option ${!paid ? 'client-form-modal__paid-option--active' : ''}`} onClick={() => setPaid(false)}>Нет</button>
              </div>
            </div>
          </div>
          <div className="client-form-modal__row">
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Тип</span>
              <Select value={clientType} onChange={setClientType} options={[{ value: 'regular', label: 'Регулярный' }, { value: 'individual', label: 'Индивидуальный' }]} className="client-form-modal__select" />
            </label>
            <label className="client-form-modal__label">
              <span className="client-form-modal__label-text">Пол</span>
              <Select value={gender} onChange={setGender} options={[{ value: '', label: '—' }, { value: 'male', label: 'М' }, { value: 'female', label: 'Ж' }]} placeholder="—" className="client-form-modal__select" />
            </label>
          </div>
          <label className="client-form-modal__label client-form-modal__label--full">
            <span className="client-form-modal__label-text">Комментарий</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="client-form-modal__input" rows={2} placeholder="Необязательно" />
          </label>
          <div className="client-form-modal__actions">
            <button type="button" className="client-form-modal__btn client-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="client-form-modal__btn client-form-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ClientFormModal;
