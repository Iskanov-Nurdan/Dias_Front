import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../../shared/ui';
import './ExpenseFormModal.scss';

const ExpenseFormModal = ({ expense, categories = [], onSave, onClose, error, saving }) => {
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [comment, setComment] = useState('');

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
    <div className="expense-form-modal__backdrop" onClick={onClose}>
      <div className="expense-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="expense-form-modal__title">{expense?.id ? 'Редактировать расход' : 'Добавить расход'}</h2>
        {error && <p className="expense-form-modal__error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="expense-form-modal__form">
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Название <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="expense-form-modal__input" placeholder="Например: Аренда зала" />
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Категория</span>
            <Select
              value={String(categoryId)}
              onChange={(v) => setCategoryId(v)}
              options={[{ value: '', label: '—' }, ...categories.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
              placeholder="—"
              className="expense-form-modal__select"
            />
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Сумма <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="expense-form-modal__input" placeholder="0" />
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Дата <span className="form-label-required" aria-hidden="true">*</span></span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="expense-form-modal__input" />
          </label>
          <label className="expense-form-modal__label">
            <span className="expense-form-modal__label-caption">Комментарий</span>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="expense-form-modal__input" rows={2} placeholder="Необязательно" />
          </label>
          <div className="expense-form-modal__actions">
            <button type="button" className="expense-form-modal__btn expense-form-modal__btn--cancel" onClick={onClose} disabled={saving}>Отмена</button>
            <button type="submit" className="expense-form-modal__btn expense-form-modal__btn--submit" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExpenseFormModal;
