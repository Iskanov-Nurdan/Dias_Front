import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Select } from '../../../shared/ui';
import './ExpenseFormModal.scss';

const ExpenseFormModal = ({ expense, categories = [], onSave, onClose }) => {
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
    onClose();
  };

  const content = (
    <div className="expense-form-modal__backdrop" onClick={onClose}>
      <div className="expense-form-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="expense-form-modal__title">{expense?.id ? 'Редактировать расход' : 'Добавить расход'}</h2>
        <form onSubmit={handleSubmit} className="expense-form-modal__form">
          <label className="expense-form-modal__label">
            Название
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="expense-form-modal__input" placeholder="Например: Аренда зала" />
          </label>
          <label className="expense-form-modal__label">
            Категория
            <Select
              value={String(categoryId)}
              onChange={(v) => setCategoryId(v)}
              options={[{ value: '', label: '—' }, ...categories.map((c) => ({ value: String(c.id), label: c.name || '' }))]}
              placeholder="—"
              className="expense-form-modal__select"
            />
          </label>
          <label className="expense-form-modal__label">
            Сумма
            <input type="number" step="any" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="expense-form-modal__input" placeholder="0" />
          </label>
          <label className="expense-form-modal__label">
            Дата
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="expense-form-modal__input" />
          </label>
          <label className="expense-form-modal__label">
            Комментарий
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} className="expense-form-modal__input" rows={2} placeholder="Необязательно" />
          </label>
          <div className="expense-form-modal__actions">
            <button type="button" className="expense-form-modal__btn expense-form-modal__btn--cancel" onClick={onClose}>Отмена</button>
            <button type="submit" className="expense-form-modal__btn expense-form-modal__btn--submit">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

export default ExpenseFormModal;
