import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../../shared/ui';
import './EmployeeFormModal.scss';

const EmployeeFormModal = ({ employee, roles, onSave, onClose }) => {
  const [fio, setFio] = useState('');
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const isEdit = !!employee?.id;

  useEffect(() => {
    if (employee) {
      setFio(employee.fio || '');
      setLogin(employee.login || '');
      setPhone(employee.phone || '');
      setRoleId(employee.roleId ?? employee.role_id ?? employee.role?.id ?? '');
    }
  }, [employee]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { fio, login, phone, roleId: roleId || undefined };
    if (!isEdit && password) payload.password = password;
    if (isEdit && password) payload.password = password;
    onSave(payload);
    onClose();
  };

  const content = (
    <div className="employee-form-modal__backdrop" onClick={onClose}>
      <div className="employee-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="employee-form-modal__title">{isEdit ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h2>
        <form onSubmit={handleSubmit} className="employee-form-modal__form">
          <label className="employee-form-modal__label">
            ФИО
            <input type="text" value={fio} onChange={(e) => setFio(e.target.value)} required className="employee-form-modal__input" />
          </label>
          <label className="employee-form-modal__label">
            Логин
            <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} required className="employee-form-modal__input" disabled={isEdit} />
          </label>
          <label className="employee-form-modal__label">
            Телефон
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="employee-form-modal__input" />
          </label>
          <label className="employee-form-modal__label">
            Роль
            <Select
              value={String(roleId)}
              onChange={(v) => setRoleId(v)}
              options={(roles || []).map((r) => ({ value: String(r.id), label: r.name || '' }))}
              placeholder="Выберите роль"
              className="employee-form-modal__select"
            />
          </label>
          <label className="employee-form-modal__label">
            Пароль {isEdit && '(оставьте пустым, чтобы не менять)'}
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="employee-form-modal__input" required={!isEdit} />
          </label>
          <div className="employee-form-modal__actions">
            <button type="button" className="employee-form-modal__btn employee-form-modal__btn--cancel" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="employee-form-modal__btn employee-form-modal__btn--submit">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default EmployeeFormModal;
