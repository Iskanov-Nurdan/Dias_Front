import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Shield, Lock } from 'lucide-react';
import { Select, SubmitButton } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './EmployeeFormModal.scss';

/**
 * У DIAS_ERP одно поле name — это одновременно и логин, и отображаемое имя
 * (отдельного поля "логин" в бэкенде нет, см. apps/accounts/models.py User).
 * Раньше здесь были два поля (ФИО + Логин) под старый бэкенд Rahman Ata —
 * схлопнуты в одно, потому что хранить их раздельно всё равно негде.
 */
const EmployeeFormModal = ({ employee, roles, onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  const isEdit = !!employee?.id;

  const nameError = touched.name && !name.trim() ? 'Укажите имя' : null;
  const passwordError = touched.password && !isEdit && !password ? 'Укажите пароль' : null;

  useModalEffect(true, onClose);

  useEffect(() => {
    if (employee) {
      setName(employee.name || '');
      setRoleId(employee.id ? String(employee.role ?? '') : '');
    }
  }, [employee]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { name, roleId: roleId || undefined };
    if (password) payload.password = password;
    onSave(payload);
  };

  const content = (
    <div className="efm__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="efm-title">
      <div className="efm" onClick={(e) => e.stopPropagation()}>

        <div className="efm__header">
          <div>
            <p className="efm__header-sub">{isEdit ? 'Редактирование' : 'Новый сотрудник'}</p>
            <h2 id="efm-title" className="efm__title">{isEdit ? employee?.name || 'Сотрудник' : 'Добавить сотрудника'}</h2>
          </div>
          <button type="button" className="efm__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>

        {error && <p className="efm__error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit} className="efm__form">
          <div className="efm__body">

            <div className="efm__field">
              <label className="efm__label" htmlFor="efm-name">
                <User size={14} className="efm__label-icon" />
                Имя (логин) <span className="efm__required">*</span>
              </label>
              <input
                id="efm-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => markTouched('name')}
                required
                className={`efm__input${nameError ? ' efm__input--invalid' : ''}`}
                autoFocus
                placeholder="ivanov"
              />
              {nameError && <span className="efm__field-error">{nameError}</span>}
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
                icon={<Shield size={15} />}
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
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
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
