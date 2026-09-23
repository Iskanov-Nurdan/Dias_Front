import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, TriangleAlert, X, Check, Package, PackageOpen,
} from 'lucide-react';
import { FormModal, SubmitButton, Select } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchFoamGpStock, createFoamSale } from '../api';
import { fetchClientsLite } from '../../clients/api';
// Переиспользуем ровно те же классы .reg__* и стили кассы профиля, а экран
// оплаты — вообще тот же компонент (PaymentScreen), не копия: касса Foam
// должна быть НЕ ПОХОЖЕЙ, а той же самой, просто с другим каталогом (прямое
// требование пользователя). Единственное реальное отличие бэкендов —
// apps.foam.createFoamSale принимает одно число paid_amount, без разбивки
// на наличные/карту; PaymentScreen всё равно даёт вести сплит наличные+
// карта (кассиру удобнее), а на сабмите Foam просто суммирует их в одно
// число — бэк эту разбивку не увидит и не должен, это нормально: там нет
// такого поля вообще. Клиент здесь свободный текст (нет FK на Клиентов),
// поэтому PaymentScreen получает синтетический clientId/client — только
// то, что ему нужно для проверки «клиент выбран», без CRM-объекта.
import '../../sales/register/RegisterModal.scss';
import './FoamRegisterModal.scss';
import { stockLabel } from '../stockLabel';
import PaymentScreen from '../../sales/register/PaymentScreen';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

let lineSeq = 0;
const newLine = (s) => ({ key: `l-${++lineSeq}`, stockId: String(s.id), quantity: 1, unitPrice: '' });

const todayISO = () => new Date().toISOString().slice(0, 10);

const FoamRegisterModal = ({ onClose, onSaved }) => {
  const toast = useToast();
  const [step, setStep] = useState('shop');
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crmClients, setCrmClients] = useState([]);
  // apps.foam.client — свободная строка на бэке (нет FK на общий справочник
  // Клиентов), но кассиру нужен выбор из того же CRM-справочника, что и
  // касса профиля (fetchClientsLite), а не свободный текст.
  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState('');
  const [lines, setLines] = useState([]);
  const [search, setSearch] = useState('');
  const [catalogOpenMobile, setCatalogOpenMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    fetchFoamGpStock(null).then(setStock).catch((err) => toast.error(getApiErrorMessage(err))).finally(() => setLoading(false));
    fetchClientsLite('', null).then(setCrmClients).catch(() => setCrmClients([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickClient = (id) => {
    setClientId(id);
    const found = crmClients.find((c) => String(c.id) === id);
    setClient(found?.name || '');
  };

  const stockById = useMemo(() => Object.fromEntries(stock.map((s) => [String(s.id), s])), [stock]);

  const catalogOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return stock
      .filter((s) => Number(s.qty) > 0)
      .filter((s) => !q || stockLabel(s).toLowerCase().includes(q))
      .slice(0, 60);
  }, [stock, search]);

  const enrichedLines = useMemo(() => lines.map((l) => {
    const row = stockById[l.stockId];
    const qty = Number(l.quantity) || 0;
    const price = Number(l.unitPrice) || 0;
    const overQty = !!row && qty > Number(row.qty);
    return { ...l, row, qty, price, lineTotal: round2(qty * price), overQty, missing: !row };
  }), [lines, stockById]);

  const hasLines = lines.length > 0;
  const hasBlockers = enrichedLines.some((l) => l.overQty || l.missing || !(l.qty > 0) || !(l.price >= 0));
  const total = round2(enrichedLines.reduce((sum, l) => sum + l.lineTotal, 0));

  const addStock = (s) => {
    setLines((prev) => [...prev, newLine(s)]);
    setCatalogOpenMobile(false);
  };
  const patchLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));
  const stepQty = (key, delta) => setLines((prev) => prev.map((l) => (
    l.key === key ? { ...l, quantity: Math.max(0, (Number(l.quantity) || 0) + delta) } : l
  )));

  const goToPayment = () => {
    if (hasBlockers || !hasLines || !client.trim()) return;
    setStep('pay');
  };

  // PaymentScreen отдаёт { paymentType, splits, paidAmount, method } — общий
  // контракт с кассой профиля. apps.foam не различает наличные/карту и не
  // хранит payment_type отдельно, поэтому для debt шлём 0, иначе — сумму
  // (paidAmount уже посчитан PaymentScreen как paid, splits тут не нужны).
  const submitPayment = async ({ paymentType, paidAmount }) => {
    setError(null);
    setSaving(true);
    try {
      const sale = await createFoamSale({
        client: client.trim(),
        saleDate: todayISO(),
        lines: enrichedLines.map((l) => ({ stockId: Number(l.row.id), qty: l.qty, unitPrice: l.price })),
        paidAmount: paymentType === 'debt' ? 0 : Math.min(Number(paidAmount) || 0, total),
      }, null);
      setLastSale(sale);
      setStep('success');
      onSaved?.();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setLines([]);
    setClientId('');
    setClient('');
    setLastSale(null);
    setStep('shop');
  };

  const title = step === 'success' ? 'Продажа оформлена' : step === 'pay' ? 'Оплата' : 'Касса';

  return (
    <FormModal icon={ShoppingCart} eyebrow="Пенополистирол — касса" title={title} onClose={onClose} error={step === 'shop' ? error : null} size="fullscreen" className={`reg reg--step-${step}`}>
      {step === 'shop' && (
        <div className="reg__shop">
          <div className="reg__layout">
            <section className={`reg__catalog ${catalogOpenMobile ? 'reg__catalog--open-mobile' : ''}`}>
              <div className="reg__catalog-head">
                <div className="reg__search">
                  <Search size={15} />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск товара…" autoFocus={catalogOpenMobile} />
                </div>
                <button type="button" className="reg__catalog-close" onClick={() => setCatalogOpenMobile(false)} aria-label="Закрыть"><X size={18} /></button>
              </div>
              <div className="reg__catalog-list">
                {loading ? (
                  <p className="reg__hint">Загрузка каталога…</p>
                ) : catalogOptions.length === 0 ? (
                  <p className="reg__hint">Ничего не найдено</p>
                ) : catalogOptions.map((s, idx) => (
                  <button
                    type="button"
                    key={s.id}
                    className="reg__catalog-item"
                    style={{ '--row-i': idx }}
                    onClick={() => addStock(s)}
                  >
                    <span className="reg__catalog-item-icon"><Package size={15} /></span>
                    <span className="reg__catalog-item-name">{stockLabel(s)}</span>
                    <span className="reg__catalog-item-meta"><span>{s.qty} шт</span></span>
                    <Plus size={14} className="reg__catalog-item-add" />
                  </button>
                ))}
              </div>
            </section>

            <section className="reg__cart">
              <div className="reg__cart-toolbar">
                <button type="button" className="reg__catalog-open-mobile" onClick={() => setCatalogOpenMobile(true)}>
                  <Plus size={15} /> Добавить товар
                </button>
                <Select
                  value={clientId}
                  onChange={pickClient}
                  options={crmClients.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder="Клиент *"
                  className="reg__client-select"
                />
              </div>

              <div className="reg__lines">
                {!hasLines && (
                  <div className="reg__hint reg__hint--empty">
                    <PackageOpen size={30} />
                    <p>Чек пуст — добавьте товар из каталога</p>
                  </div>
                )}
                {enrichedLines.map((l, idx) => (
                  <div key={l.key} className={`reg__line ${l.overQty || l.missing ? 'reg__line--error' : ''}`} style={{ '--row-i': idx }}>
                    <div className="reg__line-main">
                      <span className="reg__line-icon"><Package size={13} /></span>
                      <span className="reg__line-name">{l.row ? stockLabel(l.row) : '— товар недоступен —'}</span>
                      <button type="button" className="reg__line-remove" onClick={() => removeLine(l.key)} aria-label="Удалить"><Trash2 size={14} /></button>
                    </div>
                    <div className="reg__line-row">
                      <div className="reg__qty-stepper">
                        <button type="button" onClick={() => stepQty(l.key, -1)} aria-label="Меньше"><Minus size={13} /></button>
                        <input type="text" inputMode="decimal" value={l.quantity} onChange={(e) => patchLine(l.key, { quantity: e.target.value.replace(/[^\d.]/g, '') })} />
                        <button type="button" onClick={() => stepQty(l.key, 1)} aria-label="Больше"><Plus size={13} /></button>
                      </div>
                      <div className="reg__line-price-block">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="reg__line-price-input"
                          value={l.unitPrice}
                          onChange={(e) => patchLine(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })}
                          placeholder="Цена"
                        />
                      </div>
                      <span className="reg__line-total">{money(l.lineTotal)}</span>
                    </div>
                    {l.overQty && <p className="reg__line-warn"><TriangleAlert size={12} /> Доступно только {l.row.qty} шт</p>}
                    {!l.missing && !(l.price >= 0 && l.price > 0) && <p className="reg__line-warn"><TriangleAlert size={12} /> Укажите цену</p>}
                  </div>
                ))}
              </div>

              {hasLines && (
                <div className="reg__totals">
                  <div className="reg__totals-row reg__totals-row--total"><span>Итого</span><span>{money(total)}</span></div>
                </div>
              )}

              <div className="reg__cart-actions">
                <SubmitButton className="reg__pay-btn" disabled={!hasLines || hasBlockers || !client.trim()} onClick={goToPayment}>
                  Оплата · {money(total)}
                </SubmitButton>
              </div>
            </section>
          </div>
        </div>
      )}

      {step === 'pay' && (
        <PaymentScreen
          total={total}
          clientId={client || ''}
          client={null}
          clientProfile={null}
          saving={saving}
          error={error}
          onBack={() => setStep('shop')}
          onSubmit={submitPayment}
        />
      )}

      {step === 'success' && lastSale && (
        <div className="reg__success">
          <div className="reg__success-icon"><Check size={32} /></div>
          <p className="reg__success-title">Продажа №{lastSale.id} оформлена</p>
          <p className="reg__success-total">Итого: {money(total)}</p>
          <div className="reg__success-actions">
            <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
            <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={resetAll}>Новая продажа</button>
          </div>
        </div>
      )}
    </FormModal>
  );
};

export default FoamRegisterModal;
