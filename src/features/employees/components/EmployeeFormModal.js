import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, AtSign, Phone, Shield, Lock } from 'lucide-react';
import { Select, SubmitButton, PhoneInput } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './EmployeeFormModal.scss';

const EmployeeFormModal = ({ employee, roles, onSave, onClose, error, saving }) => {
  const [fio, setFio] = useState('');
  const [login, setLogin] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  const isEdit = !!employee?.id;

  const fioError = touched.fio && !fio.trim() ? 'Укажите ФИО' : null;
  const loginError = touched.login && !login.trim() ? 'Укажите логин' : null;
  const passwordError = touched.password && !isEdit && !password ? 'Укажите пароль' : null;

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
    if (password) payload.password = password;
    onSave(payload);
  };

  const content = (
    <div className="efm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="efm-title">
      <div className="efm" onClick={(e) => e.stopPropagation()}>

        <div className="efm__header">
          <div>
            <p className="efm__header-sub">{isEdit ? 'Редактирование' : 'Новый сотрудник'}</p>
            <h2 id="efm-title" className="efm__title">{isEdit ? employee?.fio || 'Сотрудник' : 'Добавить сотрудника'}</h2>
          </div>
          <button type="button" className="efm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="efm__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="efm__form">
          <div className="efm__body">

            <div className="efm__field">
              <label className="efm__label" htmlFor="efm-fio">
                <User size={14} className="efm__label-icon" />
                ФИО <span className="efm__required">*</span>
              </label>
              <input
                id="efm-fio"
                type="text"
                value={fio}
                onChange={(e) => setFio(e.target.value)}
                onBlur={() => markTouched('fio')}
                required
                className={`efm__input${fioError ? ' efm__input--invalid' : ''}`}
                autoFocus
                placeholder="Иванов Иван Иванович"
              />
              {fioError && <span className="efm__field-error">{fioError}</span>}
            </div>

            <div className="efm__field">
              <label className="efm__label" htmlFor="efm-login">
                <AtSign size={14} className="efm__label-icon" />
                Логин <span className="efm__required">*</span>
                {isEdit && <span className="efm__hint">· нельзя изменить</span>}
              </label>
              <input
                id="efm-login"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                onBlur={() => markTouched('login')}
                required
                className={`efm__input${isEdit ? ' efm__input--disabled' : ''}${loginError ? ' efm__input--invalid' : ''}`}
                disabled={isEdit}
                placeholder="login"
              />
              {loginError && <span className="efm__field-error">{loginError}</span>}
            </div>

            <div className="efm__field">
              <label className="efm__label" htmlFor="efm-phone">
                <Phone size={14} className="efm__label-icon" />
                Телефон
              </label>
              <PhoneInput
                id="efm-phone"
                value={phone}
                onChange={setPhone}
                className="efm__input"
                placeholder="+996 700 000 000"
              />
            </div>

            <div className="efm__field">
              <label className="efm__label">
                <Shield size={14} className="efm__label-icon" />
                Роль
              </label>
              <Select
                value={String(roleId)}
                onChange={(v) => setRoleId(v)}
                options={(roles || []).map((r) => ({ value: String(r.id), label: r.name || '' }))}
                placeholder="Выберите роль"
                className="efm__select"
              />
            </div>

            <div className="efm__field">
              <label className="efm__label" htmlFor="efm-password">
                <Lock size={14} className="efm__label-icon" />
                Пароль {!isEdit && <span className="efm__required">*</span>}
                {isEdit && <span className="efm__hint">· оставьте пустым, чтобы не менять</span>}
              </label>
              <input
                id="efm-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => markTouched('password')}
                className={`efm__input${passwordError ? ' efm__input--invalid' : ''}`}
                required={!isEdit}
                placeholder={isEdit ? 'Оставить без изменений' : 'Введите пароль'}
              />
              {passwordError && <span className="efm__field-error">{passwordError}</span>}
            </div>

          </div>

          <div className="efm__actions">
            <button type="button" className="efm__btn efm__btn--cancel" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="efm__btn efm__btn--submit">
              {isEdit ? 'Сохранить' : 'Добавить'}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default EmployeeFormModal;
