import React, { useMemo, useState } from 'react';
import { ReceiptText, TrendingDown, TrendingUp, Repeat } from 'lucide-react';
import { FormModal, SubmitButton, MoneyInput, Select } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { createEntry, updateEntry } from '../api';
import { isoDate } from '../format';

const LINES = [
  { id: 'general', label: 'Общий' },
  { id: 'profile', label: 'Профиль' },
  { id: 'foam', label: 'Пенопласт' },
];

/**
 * Добавление/правка записи реестра «Расходы и доходы». Проверки те же, что
 * на сервере (сумма > 0, дата не в будущем, категория подходит к типу) —
 * здесь только чтобы не гонять заведомо неверный запрос; решает сервер.
 */
const EntryFormModal = ({ entry, categories, onClose, onSaved }) => {
  const toast = useToast();
  const today = isoDate(new Date());
  const [kind, setKind] = useState(entry?.kind || 'expense');
  const [categoryId, setCategoryId] = useState(entry?.category_id ? String(entry.category_id) : '');
  const [amount, setAmount] = useState(entry ? String(Number(entry.amount)) : '');
  const [date, setDate] = useState(entry?.date || today);
  const [productLine, setProductLine] = useState(entry?.product_line || 'general');
  const [name, setName] = useState(entry?.name || '');
  const [comment, setComment] = useState(entry?.comment || '');
  const [recurring, setRecurring] = useState(Boolean(entry?.recurring));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const options = useMemo(
    () => categories.filter((c) => c.kind === kind).map((c) => ({ value: String(c.id), label: c.name })),
    [categories, kind],
  );

  const value = Number(amount);
  const problems = [];
  if (!categoryId) problems.push('Выберите категорию');
  if (!(value > 0)) problems.push('Сумма должна быть больше нуля');
  if (!date || date > today) problems.push('Дата не может быть в будущем');

  const switchKind = (k) => {
    if (k === kind) return;
    setKind(k);
    setCategoryId('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (problems.length || saving) return;
    setSaving(true);
    setError(null);
    const body = { kind, categoryId: Number(categoryId), amount, date, productLine, name, comment, recurring };
    try {
      if (entry) await updateEntry(entry.id, body);
      else await createEntry(body);
      toast.success(entry ? 'Запись обновлена' : (recurring ? 'Регулярная запись создана' : 'Запись добавлена — примите её, чтобы она вошла в отчёт'));
      onSaved?.();
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      icon={ReceiptText}
      eyebrow="Расходы и доходы"
      title={entry ? 'Изменить запись' : 'Новая запись'}
      onClose={onClose}
      error={error}
      size="fullscreen"
      className="an-entry"
    >
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="an-entry__kinds" role="radiogroup" aria-label="Тип записи">
            <button type="button" role="radio" aria-checked={kind === 'expense'} className={kind === 'expense' ? 'active active--expense' : ''} onClick={() => switchKind('expense')}>
              <TrendingDown size={16} /> Расход
            </button>
            <button type="button" role="radio" aria-checked={kind === 'income'} className={kind === 'income' ? 'active active--income' : ''} onClick={() => switchKind('income')}>
              <TrendingUp size={16} /> Доход
            </button>
          </div>

          <div className="an-entry__field">
            <label>Сумма</label>
            <MoneyInput value={amount} onChange={setAmount} allowDecimals className="an-entry__amount" autoFocus={!entry} inputMode="decimal" />
          </div>

          <div className="an-entry__row">
            <div className="an-entry__field">
              <label>Категория</label>
              <Select value={categoryId} onChange={setCategoryId} options={options} placeholder="Выберите категорию" />
            </div>
            <div className="an-entry__field">
              <label>Дата</label>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="an-entry__input" />
            </div>
          </div>

          <div className="an-entry__field">
            <label>Линия</label>
            <div className="an-entry__seg">
              {LINES.map((l) => (
                <button key={l.id} type="button" className={productLine === l.id ? 'active' : ''} onClick={() => setProductLine(l.id)}>{l.label}</button>
              ))}
            </div>
          </div>

          <div className="an-entry__divider" />

          <div className="an-entry__field">
            <label>Наименование <em>необязательно — по умолчанию название категории</em></label>
            <input type="text" value={name} maxLength={255} onChange={(e) => setName(e.target.value)} className="an-entry__input" placeholder="Например: аренда цеха за сентябрь" />
          </div>
          <div className="an-entry__field">
            <label>Комментарий</label>
            <textarea value={comment} rows={2} onChange={(e) => setComment(e.target.value)} className="an-entry__input an-entry__input--area" />
          </div>

          {!entry?.recurring_source_id && (
            <label className="an-entry__check">
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
              <span className="an-entry__check-box"><Repeat size={14} /></span>
              <span>
                <strong>Повторять каждый месяц</strong>
                <small>Каждый месяц появится такая же запись на проверку — дубли не создаются.</small>
              </span>
            </label>
          )}
        </div>

        <div className="form-modal__actions an-entry__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} disabled={problems.length > 0} className="ui-modal-btn ui-modal-btn--primary" title={problems[0]}>
            {entry ? 'Сохранить' : 'Добавить'}
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default EntryFormModal;
