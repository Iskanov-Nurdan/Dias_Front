import React, { useState, useEffect } from 'react';
import { UsersRound, Building2, Phone, MapPin, Wallet } from 'lucide-react';
import { Select, SubmitButton, MoneyInput, FormModal } from '../../../shared/ui';
import './ClientFormModal.scss';

const CLIENT_TYPE_OPTIONS = [
  { value: 'individual', label: 'Физ. лицо' },
  { value: 'company', label: 'Компания' },
];

const ClientFormModal = ({ client, onSave, onClose, error, saving }) => {
  const isEdit = !!client?.id;
  const [name, setName] = useState('');
  const [clientType, setClientType] = useState('individual');
  const [phone, setPhone] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [contact, setContact] = useState('');
  const [inn, setInn] = useState('');
  const [settlementAccount, setSettlementAccount] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (client) {
      setName(client.name || '');
      setClientType(client.client_type || 'individual');
      setPhone(client.phone || '');
      setPhoneAlt(client.phone_alt || '');
      setContact(client.contact || '');
      setInn(client.inn || '');
      setSettlementAccount(client.settlement_account || '');
      setAddress(client.address || '');
      setNotes(client.notes || '');
      setCreditLimit(client.credit_limit != null ? String(client.credit_limit) : '');
    }
  }, [client]);

  const nameError = touched && !name.trim() ? 'Укажите название/ФИО' : null;
  const canSubmit = name.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    onSave({
      name: name.trim(),
      clientType,
      phone,
      phoneAlt,
      contact,
      inn,
      settlementAccount,
      address,
      notes,
      creditLimit,
    });
  };

  return (
    <FormModal
      icon={UsersRound}
      eyebrow={isEdit ? 'Редактирование' : 'Новый клиент'}
      title={isEdit ? client?.name || 'Клиент' : 'Добавить клиента'}
      onClose={onClose}
      error={error}
      size="fullscreen"
      className="cfm"
    >
        <form onSubmit={handleSubmit} className="form-modal__form">
          <div className="form-modal__body">
            <div className="cfm__field">
              <label className="cfm__label" htmlFor="cfm-name">
                Название / ФИО <span className="cfm__required">*</span>
              </label>
              <input
                id="cfm-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched(true)}
                className={`cfm__input${nameError ? ' cfm__input--invalid' : ''}`}
                autoFocus
                placeholder="ОсОО «Ромашка» / Иванов Иван"
              />
              {nameError && <span className="cfm__field-error">{nameError}</span>}
            </div>

            <div className="cfm__field">
              <label className="cfm__label">
                <Building2 size={14} className="cfm__label-icon" />
                Тип клиента
              </label>
              <Select value={clientType} onChange={setClientType} options={CLIENT_TYPE_OPTIONS} className="cfm__select" />
            </div>

            <div className="cfm__section">
              <h3 className="cfm__section-title"><Phone size={13} /> Контакты</h3>
              <div className="cfm__row">
                <div className="cfm__field">
                  <label className="cfm__label" htmlFor="cfm-phone">Телефон</label>
                  <input id="cfm-phone" type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="cfm__input" placeholder="+996 700 123 456" />
                </div>
                <div className="cfm__field">
                  <label className="cfm__label" htmlFor="cfm-phone-alt">Доп. телефон</label>
                  <input id="cfm-phone-alt" type="text" value={phoneAlt} onChange={(e) => setPhoneAlt(e.target.value)} className="cfm__input" placeholder="Необязательно" />
                </div>
              </div>
              <div className="cfm__field">
                <label className="cfm__label" htmlFor="cfm-contact">Контактное лицо</label>
                <input id="cfm-contact" type="text" value={contact} onChange={(e) => setContact(e.target.value)} className="cfm__input" placeholder="Кто на связи" />
              </div>
              <div className="cfm__field">
                <label className="cfm__label" htmlFor="cfm-address">
                  <MapPin size={14} className="cfm__label-icon" />
                  Адрес
                </label>
                <input id="cfm-address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} className="cfm__input" />
              </div>
            </div>

            {clientType === 'company' && (
              <div className="cfm__section">
                <h3 className="cfm__section-title"><Building2 size={13} /> Реквизиты</h3>
                <div className="cfm__row">
                  <div className="cfm__field">
                    <label className="cfm__label" htmlFor="cfm-inn">ИНН</label>
                    <input id="cfm-inn" type="text" value={inn} onChange={(e) => setInn(e.target.value)} className="cfm__input" />
                  </div>
                  <div className="cfm__field">
                    <label className="cfm__label" htmlFor="cfm-account">Расчётный счёт</label>
                    <input id="cfm-account" type="text" value={settlementAccount} onChange={(e) => setSettlementAccount(e.target.value)} className="cfm__input" />
                  </div>
                </div>
              </div>
            )}

            <div className="cfm__section">
              <h3 className="cfm__section-title"><Wallet size={13} /> Кредитный лимит</h3>
              <div className="cfm__field">
                <label className="cfm__label" htmlFor="cfm-credit">Лимит долга, сом</label>
                <MoneyInput id="cfm-credit" value={creditLimit} onChange={setCreditLimit} placeholder="Без лимита" className="cfm__input" />
              </div>
            </div>

            <div className="cfm__field">
              <label className="cfm__label" htmlFor="cfm-notes">Заметки</label>
              <textarea id="cfm-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="cfm__textarea" rows={2} placeholder="Необязательно" />
            </div>
          </div>

          <div className="form-modal__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary" disabled={!canSubmit}>
              {isEdit ? 'Сохранить' : 'Добавить'}
            </SubmitButton>
          </div>
        </form>
    </FormModal>
  );
};

export default ClientFormModal;
