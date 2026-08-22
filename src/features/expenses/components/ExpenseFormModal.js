import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Tag } from 'lucide-react';
import { Select, SubmitButton, MoneyInput } from '../../../shared/ui';
import { useModalEffect } from '../../../shared/hooks/useModalEffect';
import './ExpenseFormModal.scss';

const ExpenseFormModal = ({ expense, categories = [], onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [comment, setComment] = useState('');
  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));

  const nameError = touched.name && !name.trim() ? 'Укажите название' : null;
  const amountError = touched.amount && !(amount !== '' && Number.isFinite(Number(amount)) && Number(amount) >= 0)
    ? 'Укажите сумму' : null;

  useModalEffect(true, onClose);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (expense?.id) {
      setName(expense.name ?? '');
      setCategoryId(expense.categoryId ?? expense.category_id ?? expense.category?.id ?? '');
      setAmount(expense.amount != null ? String(expense.amount) : '');
      setDate(expense.date ? expense.date.slice(0, 10) : today);
      setComment(expense.comment ?? '');
    } else {
      setName('');
      setCategoryId(expense?.categoryId ?? expense?.category_id ?? expense?.category?.id ?? '');
      setAmount('');
      setDate(today);
      setComment('');
    }
  }, [expense]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      categoryId: categoryId || undefined,
      amount: amount !== '' ? Number(amount) : undefined,
      date: date || undefined,
      comment: comment.trim() || undefined,
    });
  };

  const content = (
    <div className="expense-form-modal__backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="expense-form-modal-title">
      <div className="expense-form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="expense-form-modal__header">
          <h2 id="expense-form-modal-title" className="expense-form-modal__title">{expense?.id ? 'Редактировать расход' : 'Добавить расход'}</h2>
          <button type="button" className="expense-form-modal__close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
        </div>
        {error && <p className="expense-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="expense-form-modal__form">
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched('name')}
              required
              className={`expense-form-modal__input${nameError ? ' expense-form-modal__input--invalid' : ''}`}
              placeholder="Название"
            />
            {nameError && <span className="expense-form-modal__field-error">{nameError}</span>}
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Категория</span>
            <Select
              value={String(categoryId)}
              onChange={(v) => setCategoryId(v)}
              options={[{ value: '', label: '—' }, ...categories.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
              placeholder="—"
              className="expense-form-modal__select"
              icon={<Tag size={15} />}
            />
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Сумма <span className="form-label-required" aria-hidden="true">*</span></span>
            <MoneyInput
              allowDecimals
              value={amount}
              onChange={setAmount}
              onBlur={() => markTouched('amount')}
              required
              className={`expense-form-modal__input${amountError ? ' expense-form-modal__input--invalid' : ''}`}
              placeholder="0"
            />
            {amountError && <span className="expense-form-modal__field-error">{amountError}</span>}
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Дата <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="expense-form-modal__input" />
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Комментарий</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="expense-form-modal__textarea" rows={2} placeholder="—" />
          </label>
          <div className="expense-form-modal__actions">
            <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
            <SubmitButton loading={saving} className="ui-modal-btn ui-modal-btn--primary">
              Сохранить
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExpenseFormModal;
