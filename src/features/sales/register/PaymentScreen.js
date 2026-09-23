import React, { useMemo, useState } from 'react';
import {
  Banknote, CreditCard, Wallet, TriangleAlert, Delete, Receipt, CircleCheck, Clock, Undo2, Check,
} from 'lucide-react';
import { SubmitButton } from '../../../shared/ui';
import { splitsSum, changeDue, remainingToPay, round2 } from './cartMath';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;

const QUICK_AMOUNTS = [100, 500, 1000, 5000];
const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'back'];

/**
 * Экран оплаты кассы: «К оплате / Получено / Осталось / Сдача» всегда на
 * виду, крупная цифровая клавиатура, быстрые суммы, сплит наличные/карта.
 *
 * Полностью/частично — это НЕ отдельный переключатель, который можно было
 * выставить не глядя на введённую сумму (раньше можно было выбрать вкладку
 * «Полностью», ничего не вписав в сумму — кнопка «Оплатить» просто была
 * неактивна, но сам выбор вводил в заблуждение). Тип оплаты считается сам
 * по введённой сумме: паid === total → «Оплата полностью», 0 < paid < total
 * → «Оплата частично», всё это — авто, без ручного переключателя, который
 * может противоречить факту введённой суммы.
 *
 * Долг — только с выбранным клиентом (как и оплата с остатком в долг —
 * если платят не полностью, остаток тоже становится долгом клиента, а
 * анонимный долг бэк не принимает).
 */
const PaymentScreen = ({ total, clientId, client, clientProfile, saving, error, onBack, onSubmit }) => {
  const [isDebt, setIsDebt] = useState(false);
  const [activeMethod, setActiveMethod] = useState('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');

  const splits = useMemo(() => {
    const out = [];
    if (Number(cashAmount) > 0) out.push({ method: 'cash', amount: round2(Number(cashAmount)) });
    if (Number(cardAmount) > 0) out.push({ method: 'card', amount: round2(Number(cardAmount)) });
    return out;
  }, [cashAmount, cardAmount]);

  const paid = splitsSum(splits);
  const remaining = isDebt ? 0 : remainingToPay(splits, total);
  const change = isDebt ? 0 : changeDue(splits, total);

  // full — оплачено ровно/больше (сдача считается отдельно и не влияет на
  // квалификацию), partial — что-то внесли, но меньше суммы, null — ещё
  // ничего не ввели.
  const paymentKind = paid >= total && total > 0 ? 'full' : paid > 0 ? 'partial' : null;
  const partialNeedsClient = paymentKind === 'partial' && !clientId;

  const overLimit = (isDebt || paymentKind === 'partial')
    && !!clientId
    && client?.credit_limit != null
    && client?.credit_limit_mode === 'hard'
    && (Number(clientProfile?.total_debt || 0) + (isDebt ? total : Math.max(0, total - paid))) > Number(client.credit_limit);

  const setActiveAmount = (updater) => {
    if (activeMethod === 'cash') setCashAmount((v) => updater(v));
    else setCardAmount((v) => updater(v));
  };

  const pressKey = (k) => {
    setActiveAmount((v) => {
      if (k === 'back') return v.slice(0, -1);
      const next = (v || '') + k;
      return next.replace(/^0+(?=\d)/, '');
    });
  };

  const addQuick = (amount) => {
    setActiveAmount((v) => String(round2((Number(v) || 0) + amount)));
  };

  const setNoChange = () => {
    const otherPaid = activeMethod === 'cash' ? round2(Number(cardAmount) || 0) : round2(Number(cashAmount) || 0);
    const need = Math.max(0, round2(total - otherPaid));
    setActiveAmount(() => String(need));
  };

  const toggleDebt = () => {
    setIsDebt((v) => !v);
  };

  const canSubmit = !saving && !overLimit && (
    isDebt ? !!clientId : (paymentKind === 'full' || (paymentKind === 'partial' && !!clientId))
  );

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (isDebt) {
      onSubmit({ paymentType: 'debt', splits: [], paidAmount: undefined, method: undefined });
      return;
    }
    const effectivePaid = paymentKind === 'full' ? Math.min(paid, total) : paid;
    // Если оплатили ровно/больше "в полную" — не шлём сдачу отдельной строкой
    // (splits.cash может включать сдачу, серверу нужна только доплата = total).
    const cappedSplits = (() => {
      if (change <= 0) return splits;
      // Уменьшаем cash-сплит на сумму сдачи, чтобы сервер не увидел переплату.
      return splits.map((s) => (s.method === 'cash' ? { ...s, amount: round2(s.amount - change) } : s)).filter((s) => s.amount > 0);
    })();
    onSubmit({
      paymentType: paymentKind === 'full' ? 'full' : 'partial',
      splits: cappedSplits,
      paidAmount: paymentKind === 'full' ? total : effectivePaid,
      method: cappedSplits.length === 1 ? cappedSplits[0].method : undefined,
    });
  };

  const submitLabel = isDebt ? 'В долг' : paymentKind === 'partial' ? 'Оплатить частично' : 'Оплатить';

  return (
    <div className="reg__pay">
      {error && <p className="reg__pay-error">{error}</p>}

      <div className="reg__pay-modes">
        <button type="button" className={!isDebt ? 'active' : ''} onClick={() => setIsDebt(false)}>Оплата</button>
        <button
          type="button"
          className={isDebt ? 'active' : ''}
          onClick={toggleDebt}
          disabled={!clientId}
          title={!clientId ? 'Выберите клиента для продажи в долг' : undefined}
        >
          В долг
        </button>
      </div>

      {isDebt ? (
        <div className="reg__pay-debt">
          <Wallet size={28} />
          <p>Товар отдаётся, оплата не регистрируется — долг клиента вырастет на <strong>{money(total)}</strong>.</p>
          {clientProfile && (
            <p className="reg__pay-debt-current">
              Текущий долг: {money(clientProfile.total_debt)}
              {client?.credit_limit != null && <> · лимит {money(client.credit_limit)}</>}
            </p>
          )}
          {overLimit && (
            <p className="reg__pay-debt-blocked"><TriangleAlert size={14} /> Превышен кредитный лимит клиента — продажа в долг заблокирована.</p>
          )}
        </div>
      ) : (
        <>
          <div className="reg__pay-summary">
            <div><span><Receipt size={11} /> К оплате</span><strong>{money(total)}</strong></div>
            <div><span><CircleCheck size={11} /> Получено</span><strong>{money(paid)}</strong></div>
            <div className={remaining > 0 ? 'reg__pay-summary-warn' : ''}><span><Clock size={11} /> Осталось</span><strong>{money(remaining)}</strong></div>
            <div className={change > 0 ? 'reg__pay-summary-change' : ''}><span><Undo2 size={11} /> Сдача</span><strong>{money(change)}</strong></div>
          </div>

          {paymentKind === 'partial' && (
            <p className={`reg__pay-partial-hint ${partialNeedsClient ? 'reg__pay-partial-hint--error' : ''}`}>
              {partialNeedsClient
                ? <><TriangleAlert size={13} /> Неполная оплата — остаток {money(remaining)} уйдёт в долг, для этого выберите клиента</>
                : <>Остаток {money(remaining)} уйдёт в долг клиента</>}
            </p>
          )}
          {overLimit && (
            <p className="reg__pay-partial-hint reg__pay-partial-hint--error"><TriangleAlert size={13} /> Превышен кредитный лимит клиента</p>
          )}

          <div className="reg__pay-methods">
            <button type="button" className={activeMethod === 'cash' ? 'active' : ''} onClick={() => setActiveMethod('cash')}>
              {activeMethod === 'cash' && <Check size={12} className="reg__pay-method-check" />}
              <span className="reg__pay-method-head"><Banknote size={16} /> Наличные</span>
              <span className="reg__pay-method-amount">{money(cashAmount || 0)}</span>
            </button>
            <button type="button" className={activeMethod === 'card' ? 'active' : ''} onClick={() => setActiveMethod('card')}>
              {activeMethod === 'card' && <Check size={12} className="reg__pay-method-check" />}
              <span className="reg__pay-method-head"><CreditCard size={16} /> Карта</span>
              <span className="reg__pay-method-amount">{money(cardAmount || 0)}</span>
            </button>
          </div>

          <div className="reg__pay-quick">
            {QUICK_AMOUNTS.map((a) => (
              <button type="button" key={a} onClick={() => addQuick(a)}>+{a}</button>
            ))}
            <button type="button" className="reg__pay-quick-exact" onClick={setNoChange}>Без сдачи</button>
          </div>

          <div className="reg__pay-keypad">
            {KEYPAD_KEYS.map((k) => (
              <button type="button" key={k} onClick={() => pressKey(k)} className={k === 'back' ? 'reg__pay-key-back' : ''}>
                {k === 'back' ? <Delete size={18} /> : k}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="reg__pay-actions">
        <button type="button" className="ui-modal-btn" onClick={onBack} disabled={saving}>Назад</button>
        <SubmitButton loading={saving} disabled={!canSubmit} className="ui-modal-btn ui-modal-btn--primary" onClick={handleSubmit}>
          {submitLabel}
        </SubmitButton>
      </div>
    </div>
  );
};

export default PaymentScreen;
