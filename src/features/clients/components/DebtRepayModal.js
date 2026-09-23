import React, { useMemo, useState } from 'react';
import { Wallet, Banknote, CreditCard, Info } from 'lucide-react';
import { FormModal, SubmitButton, MoneyInput } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { createDebtPayment } from '../api';
import './DebtRepayModal.scss';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Погашение долга. target — одна продажа (кнопка «Оплатить» в её строке),
 * без target — общий долг клиента: сумма раскладывается по продажам от
 * старых к новым, каждая — отдельной записью Payment (так история платежей
 * честно привязана к покупкам, а не одной «размазанной» суммой).
 * Сервер не ограничивает платёж остатком долга продажи, поэтому потолок
 * (сумма ≤ долга) держим здесь.
 */
const DebtRepayModal = ({ client, debts, target, onClose, onDone }) => {
  const toast = useToast();
  const queue = useMemo(() => {
    const list = target ? [target] : [...debts].sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.sale_id - b.sale_id);
    return list.filter((d) => Number(d.debt_amount) > 0);
  }, [debts, target]);
  const maxAmount = round2(queue.reduce((s, d) => s + Number(d.debt_amount), 0));

  const [amount, setAmount] = useState(String(maxAmount));
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const value = round2(amount);
  const invalid = !(value > 0) || value > maxAmount;
  const remainingAfter = Math.max(0, round2(maxAmount - value));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (invalid || saving) return;
    setError(null);
    setSaving(true);
    let left = value;
    try {
      for (const d of queue) {
        if (left <= 0) break;
        const part = Math.min(left, Number(d.debt_amount));
        // eslint-disable-next-line no-await-in-loop
        await createDebtPayment({ clientId: client.id, saleId: d.sale_id, amount: part, method }, null);
        left = round2(left - part);
      }
      toast.success('Оплата принята');
      onDone?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      toast.error(msg);
      // часть платежей могла пройти — обновим карточку, чтобы не показывать устаревший долг
      onDone?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal
      icon={Wallet}
      eyebrow={client.name}
      title={target ? `Оплата · ${target.sale_number}` : 'Погасить долг'}
      onClose={onClose}
      error={error}
      size="sheet"
      className="drm"
    >
      <form onSubmit={handleSubmit} className="form-modal__form">
        <div className="form-modal__body">
          <div className="drm__due">
            <span>{target ? 'Долг по покупке' : 'Общий долг'}</span>
            <strong>{money(maxAmount)}</strong>
          </div>

          <div className="drm__field">
            <label>Сумма оплаты</label>
            <div className="drm__amount">
              <MoneyInput value={amount} onChange={setAmount} allowDecimals className="drm__input" autoFocus />
              <button type="button" className="drm__full" onClick={() => setAmount(String(maxAmount))}>Вся сумма</button>
            </div>
            {value > maxAmount && <span className="drm__err">Не больше долга — {money(maxAmount)}</span>}
          </div>

          <div className="drm__methods" role="radiogroup" aria-label="Способ оплаты">
            <button type="button" className={method === 'cash' ? 'active' : ''} onClick={() => setMethod('cash')}>
              <Banknote size={16} /> Наличные
            </button>
            <button type="button" className={method === 'card' ? 'active' : ''} onClick={() => setMethod('card')}>
              <CreditCard size={16} /> Карта
            </button>
          </div>

          {!invalid && (
            <p className="drm__after">
              <Info size={13} />
              {remainingAfter > 0
                ? <>После оплаты останется долг <strong>{money(remainingAfter)}</strong></>
                : <>Долг будет <strong>погашен полностью</strong></>}
            </p>
          )}
          {!target && queue.length > 1 && (
            <p className="drm__hint">Сумма закроет покупки по порядку — от самой старой.</p>
          )}
        </div>

        <div className="form-modal__actions">
          <button type="button" className="ui-modal-btn" onClick={onClose} disabled={saving}>Отмена</button>
          <SubmitButton loading={saving} disabled={invalid} className="ui-modal-btn ui-modal-btn--primary">
            Принять {invalid ? '' : money(value)}
          </SubmitButton>
        </div>
      </form>
    </FormModal>
  );
};

export default DebtRepayModal;
