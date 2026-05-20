import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Select } from '../../../../shared/ui';
import { parseApiListResponse } from '../../../../shared/lib';
import {
  acceptOtherExpense,
  createOtherExpense,
  getOtherExpenses,
  rejectOtherExpense,
} from '../../api';
import './OtherExpensesModal.scss';

const MONTH_OPTIONS = [
  { value: '1', label: 'Январь' },
  { value: '2', label: 'Февраль' },
  { value: '3', label: 'Март' },
  { value: '4', label: 'Апрель' },
  { value: '5', label: 'Май' },
  { value: '6', label: 'Июнь' },
  { value: '7', label: 'Июль' },
  { value: '8', label: 'Август' },
  { value: '9', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
];

const formatMoney = (num) =>
  `${Number(num || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} сом`;

const buildQuery = ({ year, month, day }) => {
  const params = { year };
  if (month !== '' && month != null) params.month = month;
  if (day !== '' && day != null) params.day = day;
  return params;
};

const defaultExpenseDate = (year, month, day) => {
  const y = Number(year) || new Date().getFullYear();
  const m = String(month || new Date().getMonth() + 1).padStart(2, '0');
  const d = day
    ? String(day).padStart(2, '0')
    : String(new Date().getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeItem = (row) => ({
  id: row.id,
  name: String(row.name ?? row.title ?? '').trim() || '—',
  amount: Number(row.amount) || 0,
  date: String(row.date ?? row.expense_date ?? '').slice(0, 10),
  status: String(row.status ?? 'pending').toLowerCase(),
});

const statusLabel = (s) => {
  if (s === 'accepted') return 'Принят';
  if (s === 'rejected') return 'Отклонён';
  return 'Ожидает';
};

const AddOtherExpenseModal = ({ open, onClose, onSaved, year, month, day }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setAmount('');
    setExpenseDate(defaultExpenseDate(year, month, day));
    setSubmitError(false);
  }, [open, year, month, day]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const amt = Number(amount);
    if (!trimmedName || !Number.isFinite(amt) || amt <= 0 || !expenseDate) return;
    setSubmitBusy(true);
    setSubmitError(false);
    try {
      await createOtherExpense({ name: trimmedName, amount: amt, date: expenseDate });
      onSaved?.();
      onClose();
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay modal-overlay--stack" onClick={onClose}>
      <div
        className="modal analytics-other-expense-add-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="other-expense-add-title"
      >
        <div className="modal__head modal__head--compact">
          <h3 id="other-expense-add-title">Новый расход</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="analytics-other-expense-add-modal__form" onSubmit={handleCreate}>
          <div className="analytics-other-expense-add-modal__field">
            <label htmlFor="other-exp-name">Имя</label>
            <input
              id="other-exp-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название расхода"
              autoFocus
              required
            />
          </div>
          <div className="analytics-other-expense-add-modal__field">
            <label htmlFor="other-exp-amount">Сумма, сом</label>
            <input
              id="other-exp-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="analytics-other-expense-add-modal__field">
            <label htmlFor="other-exp-date">Дата</label>
            <input
              id="other-exp-date"
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
          {submitError ? (
            <p className="analytics-other-expense-add-modal__error">Не удалось сохранить расход</p>
          ) : null}
          <div className="analytics-other-expense-add-modal__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary btn--sm" disabled={submitBusy}>
              {submitBusy ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const OtherExpensesModal = ({ open, onClose, onChanged, initialYear, initialMonth, initialDay = '' }) => {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [day, setDay] = useState(initialDay);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [actionId, setActionId] = useState(null);

  useEffect(() => {
    if (!open) return;
    setYear(initialYear);
    setMonth(initialMonth);
    setDay(initialDay);
    setAddOpen(false);
  }, [open, initialYear, initialMonth, initialDay]);

  const load = useCallback(
    (signal) => {
      setLoading(true);
      setError(false);
      return getOtherExpenses({ ...buildQuery({ year, month, day }), signal })
        .then((res) => {
          const raw = res.data?.items ?? parseApiListResponse(res.data);
          setItems((Array.isArray(raw) ? raw : []).map(normalizeItem));
        })
        .catch((err) => {
          if (err.name === 'CanceledError' || err.name === 'AbortError') return;
          setError(true);
          setItems([]);
        })
        .finally(() => setLoading(false));
    },
    [year, month, day],
  );

  useEffect(() => {
    if (!open) return undefined;
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [open, load]);

  const dayOptions = useMemo(
    () => [
      { value: '', label: 'Весь месяц' },
      ...Array.from({ length: 31 }, (_, i) => ({
        value: String(i + 1),
        label: String(i + 1),
      })),
    ],
    [],
  );

  const handleAddSaved = async () => {
    await load();
    onChanged?.();
  };

  const runAction = async (id, action) => {
    setActionId(id);
    try {
      if (action === 'accept') await acceptOtherExpense(id);
      else await rejectOtherExpense(id);
      await load();
      onChanged?.();
    } catch {
      setError(true);
    } finally {
      setActionId(null);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div
          className="modal analytics-other-expenses-modal"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="other-expenses-title"
        >
          <div className="modal__head modal__head--compact analytics-other-expenses-modal__head">
            <h3 id="other-expenses-title">Прочие расходы</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
              ×
            </button>
          </div>

          <div className="analytics-other-expenses-modal__bar">
            <label className="analytics-other-expenses-modal__bar-label" htmlFor="other-exp-filter-year">
              Год
            </label>
            <label className="analytics-other-expenses-modal__bar-label">Месяц</label>
            <label className="analytics-other-expenses-modal__bar-label">День</label>
            <span className="analytics-other-expenses-modal__bar-label analytics-other-expenses-modal__bar-label--spacer" aria-hidden="true">
              &nbsp;
            </span>
            <input
              id="other-exp-filter-year"
              className="analytics-other-expenses-modal__control analytics-other-expenses-modal__control--year"
              type="number"
              min="2020"
              max="2035"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
            <div className="analytics-other-expenses-modal__control analytics-other-expenses-modal__control--select">
              <Select value={String(month)} onChange={setMonth} options={MONTH_OPTIONS} />
            </div>
            <div className="analytics-other-expenses-modal__control analytics-other-expenses-modal__control--select">
              <Select value={day === '' ? '' : String(day)} onChange={setDay} options={dayOptions} />
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm analytics-other-expenses-modal__add-btn"
              onClick={() => setAddOpen(true)}
            >
              Добавить расход
            </button>
          </div>

          <div className="analytics-other-expenses-modal__list-wrap">
            {loading && <p className="analytics-empty analytics-empty--inline">Загрузка…</p>}
            {error && !loading && (
              <p className="analytics-empty analytics-empty--inline">Не удалось загрузить расходы</p>
            )}
            {!loading && !error && items.length === 0 ? (
              <p className="analytics-empty analytics-empty--inline">Нет расходов за выбранный период</p>
            ) : null}
            {!loading && items.length > 0 ? (
              <ul className="analytics-other-expenses-modal__list">
                {items.map((item) => {
                  const pending = item.status === 'pending';
                  const busy = actionId === item.id;
                  return (
                    <li
                      key={item.id}
                      className={`analytics-other-expenses-modal__row analytics-other-expenses-modal__row--${item.status}`}
                    >
                      <div className="analytics-other-expenses-modal__row-main">
                        <span className="analytics-other-expenses-modal__row-name">{item.name}</span>
                        <span className="analytics-other-expenses-modal__row-meta">
                          {item.date} · {formatMoney(item.amount)}
                        </span>
                        <span
                          className={`analytics-other-expenses-modal__status analytics-other-expenses-modal__status--${item.status}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </div>
                      {pending ? (
                        <div className="analytics-other-expenses-modal__row-actions">
                          <button
                            type="button"
                            className="btn btn--primary btn--sm"
                            disabled={busy}
                            onClick={() => runAction(item.id, 'accept')}
                          >
                            Принять
                          </button>
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            disabled={busy}
                            onClick={() => runAction(item.id, 'reject')}
                          >
                            Отказать
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>
      </div>

      <AddOtherExpenseModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={handleAddSaved}
        year={year}
        month={month}
        day={day}
      />
    </>
  );
};

export default OtherExpensesModal;
