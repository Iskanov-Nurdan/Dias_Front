import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Select, SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './EmployeeFormModal.scss';

const EmployeeFormModal = ({ employee, roles, onSave, onClose, error, saving }) => {
  const [fio, setFio] = useState('');
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const isEdit = !!employee?.id;

  useModalEffect(true, onClose);

  useEffect(() => {
    if (employee) {
      setFio(employee.fio || '');
      setLogin(employee.login || '');
      setPhone(employee.phone || '');
      if (employee.id) {
        setRoleId(String(employee.roleId ?? employee.role_id ?? employee.role?.id ?? ''));
      } else {
        const defaultRole = (roles || []).find((r) => r.isDefault === true || r.is_default === true);
        setRoleId(defaultRole ? String(defaultRole.id) : '');
      }
    }
  }, [employee, roles]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { fio, login, phone, roleId: roleId || undefined };
    if (!isEdit && password) payload.password = password;
    if (isEdit && password) payload.password = password;
    onSave(payload);
    // Модалку закрывает родитель только при успехе; при ошибке остаёмся открытыми и показываем error
  };

  const content = (
    <div className="employee-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="employee-form-modal-title">
      <div className="employee-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="employee-form-modal__header">
          <h2 id="employee-form-modal-title" className="employee-form-modal__title">{isEdit ? 'Редактировать сотрудника' : 'Добавить сотрудника'}</h2>
          <button type="button" className="employee-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="employee-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="employee-form-modal__form">
          <div className="employee-form-modal__form-body">
          <label className="employee-form-modal__label">
            <span className="employee-form-modal__label-caption">ФИО <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={fio} onChange={(e) => setFio(e.target.value)} required className="employee-form-modal__input" />
          </label>
          <label className="employee-form-modal__label">
            <span className="employee-form-modal__label-caption">Логин <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={login} onChange={(e) => setLogin(e.target.value)} required className="employee-form-modal__input" disabled={isEdit} />
          </label>
          <label className="employee-form-modal__label">
            <span className="employee-form-modal__label-caption">Телефон</span>
            <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="employee-form-modal__input" />
          </label>
          <label className="employee-form-modal__label">
            <span className="employee-form-modal__label-caption">Роль</span>
            <Select
              value={String(roleId)}
              onChange={(v) => setRoleId(v)}
              options={(roles || []).map((r) => ({ value: String(r.id), label: r.name || '' }))}
              placeholder="Роль"
              className="employee-form-modal__select"
            />
          </label>
          <label className="employee-form-modal__label">
            <span className="employee-form-modal__label-caption">Пароль {!isEdit && <span className="form-label-required" aria-hidden="true">*</span>}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="employee-form-modal__input" required={!isEdit} placeholder={isEdit ? 'Оставить пустым' : ''} />
          </label>
          </div>
          <div className="employee-form-modal__actions">
            <button type="button" className="employee-form-modal__btn employee-form-modal__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="employee-form-modal__btn employee-form-modal__btn--submit">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default EmployeeFormModal;
