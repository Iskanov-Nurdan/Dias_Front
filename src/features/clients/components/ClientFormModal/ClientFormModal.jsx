import React, { useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '../../../../shared/ui';
import '../ClientsPage/ClientsPage.scss';

const asLower = (v) => String(v || '').trim().toLowerCase();

const clientTypeValue = (c) => {
  const raw = asLower(c?.client_type || c?.type || c?.entity_type || c?.kind);
  if (['company', 'legal', 'organization', 'business'].includes(raw)) return 'company';
  return 'individual';
};

const clientIsActive = (c) => {
  if (c == null) return true;
  const st = asLower(c.status);
  if (st === 'inactive') return false;
  if (st === 'active') return true;
  if (c.is_active === false) return false;
  return true;
};

const getPhoneExtra = (c) => c?.phone_extra ?? c?.phone_alt ?? '';
const companyAccountField = (c) => (
  c?.settlement_account ?? c?.bank_account ?? c?.account_number ?? c?.checking_account ?? ''
);
const innField = (c) => c?.inn ?? c?.tax_id ?? '';
const addressField = (c) => c?.address ?? c?.legal_address ?? '';

const ClientFormModal = ({ client, onClose, onSubmit, error, titleNew = 'Создать клиента', titleEdit = 'Редактировать клиента' }) => {
  const [clientType, setClientType] = useState('individual');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneExtraVal, setPhoneExtraVal] = useState('');
  const [settlementAccount, setSettlementAccount] = useState('');
  const [inn, setInn] = useState('');
  const [address, setAddress] = useState('');
  const [status, setStatus] = useState('active');

  useEffect(() => {
    if (!client) {
      setClientType('individual');
      setName('');
      setPhone('');
      setPhoneExtraVal('');
      setSettlementAccount('');
      setInn('');
      setAddress('');
      setStatus('active');
      return;
    }
    setClientType(clientTypeValue(client));
    setName(client.name || client.title || '');
    setPhone(client.phone || client.phone_number || '');
    setPhoneExtraVal(String(getPhoneExtra(client) || ''));
    setSettlementAccount(String(companyAccountField(client) || ''));
    setInn(String(innField(client) || ''));
    setAddress(String(addressField(client) || ''));
    setStatus(clientIsActive(client) ? 'active' : 'inactive');
  }, [client]);

  const statusOptions = useMemo(
    () => [
      { value: 'active', label: 'Активен' },
      { value: 'inactive', label: 'Неактивен' },
    ],
    [],
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal clients-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{client ? titleEdit : titleNew}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form
          className="clients-modal__form"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              client_type: clientType,
              name: name.trim(),
              phone: phone.trim() || undefined,
              phone_extra: phoneExtraVal.trim() || undefined,
              status,
            };
            if (clientType === 'company') {
              payload.settlement_account = settlementAccount.trim() || undefined;
              payload.inn = inn.trim() || undefined;
              payload.address = address.trim() || undefined;
            }
            onSubmit(payload);
          }}
        >
          <div className="clients-modal__scroll">
            <div className="clients-modal__type-switch" role="tablist" aria-label="Тип клиента">
              <button
                type="button"
                className={`clients-modal__type-btn${clientType === 'individual' ? ' is-active' : ''}`}
                onClick={() => setClientType('individual')}
              >
                Физ лицо
              </button>
              <button
                type="button"
                className={`clients-modal__type-btn${clientType === 'company' ? ' is-active' : ''}`}
                onClick={() => setClientType('company')}
              >
                Компания
              </button>
            </div>

            <label>{clientType === 'company' ? 'Название компании *' : 'ФИО *'}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
            {clientType === 'company' ? (
              <>
                <label>Расчётный счёт</label>
                <input value={settlementAccount} onChange={(e) => setSettlementAccount(e.target.value)} placeholder="Номер расчётного счёта" />
              </>
            ) : null}
            <div className="clients-modal__grid">
              <div>
                <label>Телефон</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+996 …" />
              </div>
              <div>
                <label>{clientType === 'company' ? 'Доп. телефоны' : 'Доп. телефон'}</label>
                <input value={phoneExtraVal} onChange={(e) => setPhoneExtraVal(e.target.value)} placeholder={clientType === 'company' ? 'Через запятую' : ''} />
              </div>
            </div>
            {clientType === 'company' ? (
              <>
                <label>ИНН</label>
                <input value={inn} onChange={(e) => setInn(e.target.value)} />
                <label>Адрес</label>
                <textarea rows={3} value={address} onChange={(e) => setAddress(e.target.value)} />
              </>
            ) : null}
            <label>Статус</label>
            <SearchableSelect value={status} onChange={setStatus} options={statusOptions} placeholder="Статус" />
            {error && <p className="modal__error">{error}</p>}
          </div>
          <div className="modal__actions clients-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClientFormModal;
