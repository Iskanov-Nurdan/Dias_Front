import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, TriangleAlert, X, Check, Package, PackageOpen, Clock, Wallet, Percent,
} from 'lucide-react';
import { FormModal, SubmitButton, Select, ActionSheet } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchFoamGpStock, createFoamSale, fetchFoamClientDebt } from '../api';
import { fetchClientsLite } from '../../clients/api';
import { creditInfo } from '../../clients/creditLimit';
// Переиспользуем ровно те же классы .reg__* и стили кассы профиля, а экран
// оплаты — вообще тот же компонент (PaymentScreen), не копия: касса Foam
// должна быть НЕ ПОХОЖЕЙ, а той же самой, просто с другим каталогом (прямое
// требование пользователя). Единственное реальное отличие бэкендов —
// apps.foam.createFoamSale принимает одно число paid_amount, без разбивки
// на наличные/карту; PaymentScreen всё равно даёт вести сплит наличные+
// карта (кассиру удобнее), а на сабмите Foam просто суммирует их в одно
// число — бэк эту разбивку не увидит и не должен, это нормально: там нет
// такого поля вообще.
//
// Клиент теперь обязательно из общего справочника (client_id, а не текст):
// apps.foam.FoamSale.client_account — FK на apps.sales.Client — только так
// можно посчитать общий на клиента долг/лимит (см. credit_check.py,
// compute_client_debt суммирует обе товарные линии). Долг/лимит клиента —
// GET /foam/sales/client-debt/, тот же creditInfo(), что и в кассе профиля
// (см. shared/clients/creditLimit) — визуально и по смыслу идентично.
// Скидка на чек — FoamSale.discount_amount, считается сервером, видна и
// редактируется только админом, как и в кассе профиля.
import '../../sales/register/RegisterModal.scss';
import './FoamRegisterModal.scss';
import { stockLabel, foamUnit } from '../stockLabel';
import PaymentScreen from '../../sales/register/PaymentScreen';
import { useParkedCarts } from '../../sales/register/useParkedCarts';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const PARKED_STORAGE_KEY = 'dias_pos_parked_carts_foam_v1';

let lineSeq = 0;
const newLine = (s) => ({ key: `l-${++lineSeq}`, stockId: String(s.id), quantity: 1, unitPrice: '' });

const todayISO = () => new Date().toISOString().slice(0, 10);

const FoamRegisterModal = ({ onClose, onSaved }) => {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { carts: parkedCarts, park, remove: removeParked } = useParkedCarts(PARKED_STORAGE_KEY);
  const [step, setStep] = useState('shop');
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crmClients, setCrmClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [client, setClient] = useState('');
  const [clientDebt, setClientDebt] = useState(null);
  const [lines, setLines] = useState([]);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [search, setSearch] = useState('');
  const [catalogOpenMobile, setCatalogOpenMobile] = useState(false);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    fetchFoamGpStock(null).then(setStock).catch((err) => toast.error(getApiErrorMessage(err))).finally(() => setLoading(false));
    fetchClientsLite('', null).then(setCrmClients).catch(() => setCrmClients([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId) { setClientDebt(null); return; }
    fetchFoamClientDebt(clientId, null).then(setClientDebt).catch(() => setClientDebt(null));
  }, [clientId]);

  const pickClient = (id) => {
    setClientId(id);
    const found = crmClients.find((c) => String(c.id) === id);
    setClient(found?.name || '');
  };

  // creditInfo() — тот же расчёт доли/уровня, что в кассе профиля (см.
  // shared/clients/creditLimit); только числа берём из ответа сервера
  // (client-debt/), а не из client-объекта фронта.
  const creditView = useMemo(
    () => creditInfo(
      clientDebt ? { credit_limit: clientDebt.credit_limit, credit_limit_mode: clientDebt.block_mode } : null,
      clientDebt?.current_debt,
    ),
    [clientDebt],
  );

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
  const subtotal = round2(enrichedLines.reduce((sum, l) => sum + l.lineTotal, 0));
  const total = Math.max(0, round2(subtotal - Number(headerDiscount || 0)));

  const addStock = (s) => {
    setLines((prev) => [...prev, newLine(s)]);
    setCatalogOpenMobile(false);
  };
  const patchLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));
  const stepQty = (key, delta) => setLines((prev) => prev.map((l) => (
    l.key === key ? { ...l, quantity: Math.max(0, (Number(l.quantity) || 0) + delta) } : l
  )));

  const handleParkCurrent = () => {
    if (!hasLines) return;
    park({
      clientId,
      client,
      headerDiscount,
      lines: lines.map((l) => ({
        key: l.key,
        stockId: l.stockId,
        label: stockById[l.stockId] ? stockLabel(stockById[l.stockId]) : undefined,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      total,
    });
    toast.success('Чек отложен');
    onClose();
  };

  // Отложенный чек ничего не резервирует на складе (см. useParkedCarts) —
  // при восстановлении сверяем со свежим stock, уже загруженным в этой кассе.
  const applyParked = (cart) => {
    setClientId(cart.clientId || '');
    setClient(cart.client || '');
    setHeaderDiscount(cart.headerDiscount || 0);
    const foundConflicts = [];
    const restored = (cart.lines || []).map((l) => {
      const fresh = stockById[String(l.stockId)];
      if (!fresh) {
        foundConflicts.push(`«${l.label || l.stockId}» больше недоступен на складе`);
        return null;
      }
      if (Number(l.quantity) > Number(fresh.qty)) {
        foundConflicts.push(`«${stockLabel(fresh)}»: было ${l.quantity}, сейчас доступно ${fresh.qty} ${foamUnit(fresh.output_format)}`);
      }
      return { ...l, key: l.key || `l-${++lineSeq}` };
    }).filter(Boolean);
    setLines(restored);
    setConflicts(foundConflicts);
    setParkedOpen(false);
  };

  const goToPayment = () => {
    if (hasBlockers || !hasLines || !clientId) return;
    setStep('pay');
  };

  // PaymentScreen отдаёт { paymentType, splits, paidAmount, method } — общий
  // контракт с кассой профиля. apps.foam не различает наличные/карту и не
  // хранит payment_type отдельно, поэтому для debt шлём 0, иначе — сумму
  // (paidAmount уже посчитан PaymentScreen как paid, splits тут не нужны).
  // Лимит долга (общий на клиента, см. compute_client_debt) проверяет и
  // блокирует сервер — здесь просто показываем то, что он вернёт.
  const submitPayment = async ({ paymentType, paidAmount }) => {
    setError(null);
    setSaving(true);
    try {
      const sale = await createFoamSale({
        clientId: Number(clientId),
        saleDate: todayISO(),
        lines: enrichedLines.map((l) => ({ stockId: Number(l.row.id), qty: l.qty, unitPrice: l.price })),
        discountAmount: headerDiscount || undefined,
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
    setHeaderDiscount(0);
    setLastSale(null);
    setStep('shop');
  };

  const title = step === 'success' ? 'Продажа оформлена' : step === 'pay' ? 'Оплата' : 'Касса';

  return (
    <FormModal
      icon={ShoppingCart}
      eyebrow="Пенополистирол — касса"
      title={title}
      onClose={onClose}
      error={step === 'shop' ? error : null}
      size="fullscreen"
      className={`reg reg--step-${step}`}
      headerExtra={step === 'shop' && (
        <button type="button" className="reg__parked-btn" onClick={() => setParkedOpen(true)}>
          <Clock size={15} />
          {parkedCarts.length > 0 && <span className="reg__parked-badge">{parkedCarts.length}</span>}
        </button>
      )}
    >
      {step === 'shop' && (
        <div className="reg__shop">
          {conflicts.length > 0 && (
            <div className="reg__conflicts">
              <TriangleAlert size={14} />
              <div>
                <p>Остатки изменились с момента отложения чека:</p>
                <ul>{conflicts.map((c) => <li key={c}>{c}</li>)}</ul>
              </div>
              <button type="button" onClick={() => setConflicts([])} aria-label="Закрыть"><X size={14} /></button>
            </div>
          )}

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
                    <span className="reg__catalog-item-meta"><span>{s.qty} {foamUnit(s.output_format)}</span></span>
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

              {clientDebt && (creditView.hasLimit || Number(clientDebt.current_debt) > 0) && (
                <div className={`reg__client-debt reg__client-debt--${creditView.level}`}>
                  <div className="reg__client-debt-top">
                    <span className="reg__client-debt-icon"><Wallet size={13} /></span>
                    <span>Долг клиента</span>
                    <strong className="reg__client-debt-value">{money(clientDebt.current_debt)}</strong>
                  </div>
                  {creditView.hasLimit && (
                    <>
                      <span className="reg__client-debt-bar"><i style={{ width: `${creditView.usedPct}%` }} /></span>
                      <span className="reg__client-debt-note">
                        {creditView.over ? 'Лимит долга превышен' : <>можно в долг ещё <strong>{money(creditView.available)}</strong></>}
                      </span>
                    </>
                  )}
                </div>
              )}

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
                        {l.row && <span className="reg__qty-unit">{foamUnit(l.row.output_format)}</span>}
                      </div>
                      <div className="reg__line-price-block">
                        <input
                          type="text"
                          inputMode="decimal"
                          className="reg__line-price-input"
                          value={l.unitPrice}
                          onChange={(e) => patchLine(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })}
                          placeholder={l.row ? `Цена за 1 ${foamUnit(l.row.output_format)}` : 'Цена'}
                        />
                      </div>
                      <span className="reg__line-total">{money(l.lineTotal)}</span>
                    </div>
                    {l.overQty && <p className="reg__line-warn"><TriangleAlert size={12} /> Доступно только {l.row.qty} {foamUnit(l.row.output_format)}</p>}
                    {!l.missing && !(l.price >= 0 && l.price > 0) && <p className="reg__line-warn"><TriangleAlert size={12} /> Укажите цену</p>}
                  </div>
                ))}
              </div>

              {hasLines && (
                <div className="reg__totals">
                  {headerDiscount > 0 && (
                    <div className="reg__totals-row"><span>Сумма</span><span>{money(subtotal)}</span></div>
                  )}
                  {isAdmin && (
                    <div className="reg__totals-row reg__totals-row--discount">
                      <span><Percent size={13} /> Скидка на чек</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={headerDiscount || ''}
                        onChange={(e) => setHeaderDiscount(Number(e.target.value.replace(/[^\d.]/g, '')) || 0)}
                        placeholder="0"
                      />
                    </div>
                  )}
                  <div className="reg__totals-row reg__totals-row--total"><span>Итого</span><span>{money(total)}</span></div>
                </div>
              )}

              <div className="reg__cart-actions">
                <button type="button" className="reg__park-btn" onClick={handleParkCurrent} disabled={!hasLines}>
                  <Clock size={15} /> Отложить
                </button>
                <SubmitButton className="reg__pay-btn" disabled={!hasLines || hasBlockers || !clientId} onClick={goToPayment}>
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
          clientId={clientId}
          client={clientDebt ? { credit_limit: clientDebt.credit_limit, credit_limit_mode: clientDebt.block_mode } : null}
          clientProfile={clientDebt ? { total_debt: clientDebt.current_debt } : null}
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

      <ActionSheet open={parkedOpen} onClose={() => setParkedOpen(false)} title="Отложенные чеки">
        {parkedCarts.length === 0 && (
          <div className="reg__parked-empty">
            <Clock size={26} />
            <p>Пока нет отложенных чеков</p>
          </div>
        )}
        {parkedCarts.map((c, idx) => (
          <div key={c.id} className="reg__parked-item" style={{ '--row-i': idx }}>
            <button type="button" className="reg__parked-item-main" onClick={() => applyParked(c)}>
              <span className="reg__parked-item-icon"><Package size={14} /></span>
              <span className="reg__parked-item-text">
                <span className="reg__parked-item-title">{c.lines?.length || 0} товар(а) · {money(c.total)}</span>
                <span className="reg__parked-item-time">{new Date(c.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </span>
            </button>
            <button type="button" className="reg__parked-item-remove" onClick={() => removeParked(c.id)} aria-label="Удалить">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </ActionSheet>
    </FormModal>
  );
};

export default FoamRegisterModal;
