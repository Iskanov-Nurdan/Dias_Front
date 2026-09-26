import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, TriangleAlert, Clock, X, Percent, Pencil, Check, Package, PackageOpen, Wallet,
} from 'lucide-react';
import { FormModal, Select, SubmitButton, ActionSheet } from '../../../shared/ui';
import { useToast } from '../../../app/providers/ToastProvider';
import { useAuth } from '../../../app/providers/AuthProvider';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import { fetchSaleSources, createSale, genIdempotencyKey } from '../api';
import { fetchClientsLite, fetchClientProfile } from '../../clients/api';
import { useParkedCarts } from './useParkedCarts';
import {
  lineTotal, cartSubtotal, cartLinesDiscount, cartTotal, changeDue,
} from './cartMath';
import { creditInfo } from '../../clients/creditLimit';
import PaymentScreen from './PaymentScreen';
import './RegisterModal.scss';

const money = (n) => `${Number(n || 0).toLocaleString('ru-RU')} сом`;

let lineSeq = 0;
const newLine = (product, quantity = 1) => ({
  key: `l-${++lineSeq}`,
  profileId: String(product.profile_id),
  quantity,
  unitPrice: Number(product.unit_sale_price ?? product.sale_unit_price ?? 0),
  discountAmount: 0,
  manualOverride: false,
  overrideReason: '',
});

/**
 * Раскладывает нужное количество по партиям одного профиля по FIFO (старые
 * партии — первые). Партии в pool уже приходят с бэка отсортированными
 * `-date, -id` (новые сначала, sale_stock_sources.build_warehouse_batch_sale_sources)
 * — переворачивать/досортировывать не нужно, просто идём с конца массива.
 */
const allocateFifo = (pool, qty) => {
  let remaining = qty;
  const out = [];
  for (let i = pool.length - 1; i >= 0 && remaining > 0; i -= 1) {
    const b = pool[i];
    const avail = Number(b.available_pieces) || 0;
    if (avail <= 0) continue;
    const take = Math.min(remaining, avail);
    out.push({ batch: b, quantity: take });
    remaining -= take;
  }
  return out;
};

/**
 * Касса — единый движок продажи (см. CLAUDE.md: одна вкладка = один каталог,
 * логика чека одна). Три шага в одной модалке: 'shop' (каталог + чек),
 * 'pay' (оплата), 'success' (экран успеха). Отложенные чеки — только в
 * localStorage (useParkedCarts): checkout на бэке атомарный и сразу
 * списывает склад, полноценного «черновика без последствий» там нет —
 * поэтому отложенный чек ничего не резервирует и обязан быть
 * пере-провалидирован по свежим остаткам при восстановлении.
 *
 * Каталог группирует партии склада по товару (profile_stock с бэка —
 * тот же агрегат, что уже показывает страница «Склад»), а не по партии:
 * кассир видит «Товар — 32 шт», а не 7 одинаковых строк с разными
 * остатками. Реальное списание при оплате раскладывается по конкретным
 * партиям по FIFO (allocateFifo) — прозрачно, кассир этого не видит.
 * Ручная цена/скидка (админ) — не может распадаться на несколько партий
 * (иначе непонятно, к какой части чека относится скидка), поэтому в этом
 * случае количество ограничено остатком одной (самой старой) партии.
 */
const RegisterModal = ({ onClose, onSaved, resumeCart }) => {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { carts: parkedCarts, park, remove: removeParked } = useParkedCarts();

  const [step, setStep] = useState('shop');
  const [batches, setBatches] = useState([]);
  const [productStock, setProductStock] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState('');
  const [lines, setLines] = useState([]);
  const [headerDiscount, setHeaderDiscount] = useState(0);
  const [comment, setComment] = useState('');
  const [search, setSearch] = useState('');
  const [catalogOpenMobile, setCatalogOpenMobile] = useState(false);
  const [parkedOpen, setParkedOpen] = useState(false);
  const [clientProfile, setClientProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [idemKey, setIdemKey] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const [resumedParkedId, setResumedParkedId] = useState(null);
  const [conflicts, setConflicts] = useState([]);

  const loadSources = useCallback((forClientId) => {
    setSourcesLoading(true);
    return Promise.all([
      fetchClientsLite('', null),
      fetchSaleSources(forClientId || null, null),
    ])
      .then(([clientsList, sources]) => {
        const freshBatches = sources?.available_warehouse_batches ?? [];
        const freshProducts = sources?.profile_stock ?? [];
        setClients(clientsList);
        setBatches(freshBatches);
        setProductStock(freshProducts);
        return { batches: freshBatches, products: freshProducts };
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        return { batches: [], products: [] };
      })
      .finally(() => setSourcesLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Восстановление отложенного чека — ре-валидация свежих остатков сразу
  // при загрузке каталога, без второго независимого запроса.
  const applyParked = useCallback((cart) => {
    setClientId(cart.clientId || '');
    setComment(cart.comment || '');
    setHeaderDiscount(cart.headerDiscount || 0);
    setResumedParkedId(cart.id);
    loadSources(cart.clientId || null).then(({ products }) => {
      const byProfile = Object.fromEntries(products.map((p) => [String(p.profile_id), p]));
      const foundConflicts = [];
      const restored = (cart.lines || []).map((l) => {
        const fresh = byProfile[String(l.profileId)];
        if (!fresh) {
          foundConflicts.push(`«${l.label || l.profileId}» больше недоступен на складе`);
          return null;
        }
        if (Number(l.quantity) > Number(fresh.available_pieces)) {
          foundConflicts.push(`«${fresh.product_name}»: было ${l.quantity} шт, сейчас доступно ${fresh.available_pieces}`);
        }
        return { ...l, key: l.key || `l-${++lineSeq}` };
      }).filter(Boolean);
      setLines(restored);
      setConflicts(foundConflicts);
    });
    setStep('shop');
    setParkedOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSources]);

  useEffect(() => {
    if (resumeCart) {
      applyParked(resumeCart);
    } else {
      loadSources(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!clientId) { setClientProfile(null); return; }
    fetchClientProfile(clientId, null).then(setClientProfile).catch(() => setClientProfile(null));
  }, [clientId]);

  const batchesByProfile = useMemo(() => {
    const map = {};
    batches.forEach((b) => {
      if (b.profile_id == null) return;
      const k = String(b.profile_id);
      if (!map[k]) map[k] = [];
      map[k].push(b);
    });
    return map;
  }, [batches]);

  const productByProfileId = useMemo(
    () => Object.fromEntries(productStock.map((p) => [String(p.profile_id), p])),
    [productStock],
  );

  const selectedClient = useMemo(
    () => clients.find((c) => String(c.id) === String(clientId)) || null,
    [clients, clientId],
  );

  const creditView = creditInfo(selectedClient, clientProfile?.total_debt);

  const catalogOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return productStock
      .filter((p) => Number(p.available_pieces) > 0)
      .filter((p) => !q || (p.product_name || '').toLowerCase().includes(q));
  }, [productStock, search]);

  const enrichedLines = useMemo(() => lines.map((l) => {
    const product = productByProfileId[l.profileId];
    const pool = batchesByProfile[l.profileId] || [];
    const qty = Number(l.quantity) || 0;
    const availableTotal = pool.reduce((sum, b) => sum + (Number(b.available_pieces) || 0), 0);
    const oldestBatch = pool[pool.length - 1] || null;
    const missing = !product;
    const overQty = !missing && qty > availableTotal;
    const overrideBlocked = !missing && l.manualOverride && qty > 0
      && (!oldestBatch || qty > Number(oldestBatch.available_pieces));
    return {
      ...l, product, pool, qty, availableTotal, oldestBatch, missing, overQty, overrideBlocked,
    };
  }), [lines, productByProfileId, batchesByProfile]);

  const hasBlockers = enrichedLines.some((l) => l.overQty || l.missing || l.overrideBlocked || !(l.qty > 0));
  const hasLines = lines.length > 0;
  const subtotal = cartSubtotal(enrichedLines);
  const linesDiscount = cartLinesDiscount(enrichedLines);
  const total = cartTotal(enrichedLines, headerDiscount);

  const addProduct = (product) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.profileId === String(product.profile_id));
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: (Number(l.quantity) || 0) + 1 } : l));
      }
      return [...prev, newLine(product)];
    });
    setCatalogOpenMobile(false);
  };

  const patchLine = (key, patch) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));
  const stepQty = (key, delta) => setLines((prev) => prev.map((l) => {
    if (l.key !== key) return l;
    const next = Math.max(0, (Number(l.quantity) || 0) + delta);
    return { ...l, quantity: next };
  }));

  const resetCart = () => {
    setLines([]);
    setClientId('');
    setHeaderDiscount(0);
    setComment('');
    setStep('shop');
    setIdemKey(null);
    setResumedParkedId(null);
    setConflicts([]);
    setLastSale(null);
  };

  const handleParkCurrent = () => {
    if (!hasLines) return;
    park({
      id: resumedParkedId || undefined,
      clientId,
      comment,
      headerDiscount,
      lines: lines.map((l) => ({
        key: l.key,
        profileId: l.profileId,
        label: productByProfileId[l.profileId]?.product_name,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discountAmount: l.discountAmount,
        manualOverride: l.manualOverride,
        overrideReason: l.overrideReason,
      })),
      total,
    });
    toast.success('Чек отложен');
    onClose();
  };

  const goToPayment = () => {
    if (hasBlockers || !hasLines) return;
    if (!idemKey) setIdemKey(genIdempotencyKey());
    setStep('pay');
  };

  const submitPayment = async ({ paymentType, splits, paidAmount, method }) => {
    setError(null);
    setSaving(true);
    try {
      const key = idemKey || genIdempotencyKey();
      if (!idemKey) setIdemKey(key);

      const saleLines = [];
      enrichedLines.forEach((l) => {
        const allocations = l.manualOverride
          ? [{ batch: l.oldestBatch, quantity: l.qty }]
          : allocateFifo(l.pool, l.qty);
        allocations.forEach((a, idx) => {
          saleLines.push({
            warehouseBatchId: Number(a.batch.id),
            product: l.product?.product_name,
            quantity: a.quantity,
            unitPrice: l.unitPrice,
            // Скидка/причина ручной цены — только на первую (а при ручной
            // цене — единственную) строку раскладки, иначе сумма скидки
            // задвоится при суммировании по нескольким партиям.
            discountAmount: idx === 0 ? (l.discountAmount || undefined) : undefined,
            manualOverride: l.manualOverride,
            overrideReason: l.overrideReason,
          });
        });
      });

      const sale = await createSale({
        clientId: Number(clientId),
        saleDate: new Date().toISOString().slice(0, 10),
        lines: saleLines,
        discountAmount: headerDiscount || undefined,
        paymentType,
        paymentMethod: method,
        paymentSplits: splits,
        paidAmount,
        comment: comment || undefined,
        idempotencyKey: key,
      }, null);
      if (resumedParkedId) removeParked(resumedParkedId);
      setLastSale({ ...sale, _change: changeDue(splits, total) });
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

  const title = step === 'success' ? 'Продажа оформлена' : step === 'pay' ? 'Оплата' : 'Касса';

  return (
    <FormModal
      icon={ShoppingCart}
      eyebrow="Касса"
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
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск товара…"
                    autoFocus={catalogOpenMobile}
                  />
                </div>
                <button type="button" className="reg__catalog-close" onClick={() => setCatalogOpenMobile(false)} aria-label="Закрыть">
                  <X size={18} />
                </button>
              </div>
              <div className="reg__catalog-list">
                {sourcesLoading ? (
                  <p className="reg__hint">Загрузка каталога…</p>
                ) : catalogOptions.length === 0 ? (
                  <p className="reg__hint">Ничего не найдено</p>
                ) : catalogOptions.map((p, idx) => (
                  <button
                    type="button"
                    key={p.profile_id}
                    className="reg__catalog-item"
                    style={{ '--row-i': idx }}
                    onClick={() => addProduct(p)}
                  >
                    <span className="reg__catalog-item-icon"><Package size={15} /></span>
                    <span className="reg__catalog-item-name">{p.product_name}</span>
                    <span className="reg__catalog-item-meta">
                      <span>{p.available_pieces} шт</span>
                      <span className="reg__catalog-item-price">{money(p.unit_sale_price ?? p.sale_unit_price)}</span>
                    </span>
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
                  onChange={setClientId}
                  options={clients.map((c) => ({ value: String(c.id), label: c.name }))}
                  placeholder="Клиент (необязательно)"
                  className="reg__client-select"
                />
              </div>

              {clientProfile && (creditView.hasLimit || Number(clientProfile.total_debt) > 0) && (
                <div className={`reg__client-debt reg__client-debt--${creditView.level}`}>
                  <div className="reg__client-debt-top">
                    <span className="reg__client-debt-icon"><Wallet size={13} /></span>
                    <span>Долг клиента</span>
                    <strong className="reg__client-debt-value">{money(clientProfile.total_debt)}</strong>
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
                  <div
                    key={l.key}
                    className={`reg__line ${l.overQty || l.missing || l.overrideBlocked ? 'reg__line--error' : ''}`}
                    style={{ '--row-i': idx }}
                  >
                    <div className="reg__line-main">
                      <span className="reg__line-icon"><Package size={13} /></span>
                      <span className="reg__line-name">{l.product?.product_name || '— товар недоступен —'}</span>
                      <button type="button" className="reg__line-remove" onClick={() => removeLine(l.key)} aria-label="Удалить">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="reg__line-row">
                      <div className="reg__qty-stepper">
                        <button type="button" onClick={() => stepQty(l.key, -1)} aria-label="Меньше"><Minus size={13} /></button>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={l.quantity}
                          onChange={(e) => patchLine(l.key, { quantity: e.target.value.replace(/[^\d.]/g, '') })}
                        />
                        <button type="button" onClick={() => stepQty(l.key, 1)} aria-label="Больше"><Plus size={13} /></button>
                      </div>
                      <div className="reg__line-price-block">
                        {l.manualOverride ? (
                          <input
                            type="text"
                            inputMode="decimal"
                            className="reg__line-price-input"
                            value={l.unitPrice}
                            onChange={(e) => patchLine(l.key, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })}
                          />
                        ) : (
                          <span className="reg__line-price">{money(l.unitPrice)}</span>
                        )}
                        {isAdmin && (
                          <button
                            type="button"
                            className={`reg__line-override-btn ${l.manualOverride ? 'reg__line-override-btn--active' : ''}`}
                            onClick={() => patchLine(l.key, { manualOverride: !l.manualOverride })}
                            title="Ручная цена"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </div>
                      <span className="reg__line-total">{money(lineTotal(l))}</span>
                    </div>
                    {l.manualOverride && isAdmin && (
                      <input
                        type="text"
                        className="reg__line-override-reason"
                        value={l.overrideReason}
                        onChange={(e) => patchLine(l.key, { overrideReason: e.target.value })}
                        placeholder="Причина ручной цены (обязательно)"
                      />
                    )}
                    {isAdmin && (
                      <label className="reg__line-discount">
                        <Percent size={12} />
                        <input
                          type="text"
                          inputMode="decimal"
                          value={l.discountAmount || ''}
                          onChange={(e) => patchLine(l.key, { discountAmount: e.target.value.replace(/[^\d.]/g, '') })}
                          placeholder="Скидка на строку, сом"
                        />
                      </label>
                    )}
                    {l.overQty && <p className="reg__line-warn"><TriangleAlert size={12} /> Доступно только {l.availableTotal} шт</p>}
                    {l.missing && <p className="reg__line-warn"><TriangleAlert size={12} /> Товар недоступен, удалите строку</p>}
                    {l.overrideBlocked && (
                      <p className="reg__line-warn">
                        <TriangleAlert size={12} /> Ручная цена не может делиться на несколько партий — доступно только {l.oldestBatch?.available_pieces ?? 0} шт в самой старой партии
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {hasLines && (
                <div className="reg__totals">
                  <div className="reg__totals-row"><span>Сумма</span><span>{money(subtotal)}</span></div>
                  {linesDiscount > 0 && (
                    <div className="reg__totals-row"><span>Скидки по строкам</span><span>−{money(linesDiscount)}</span></div>
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
                <SubmitButton
                  className="reg__pay-btn"
                  disabled={!hasLines || hasBlockers}
                  onClick={goToPayment}
                >
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
          client={selectedClient}
          clientProfile={clientProfile}
          saving={saving}
          error={error}
          onBack={() => setStep('shop')}
          onSubmit={submitPayment}
        />
      )}

      {step === 'success' && lastSale && (
        <div className="reg__success">
          <div className="reg__success-icon"><Check size={32} /></div>
          <p className="reg__success-title">Продажа №{lastSale.sale_number || lastSale.id} оформлена</p>
          {lastSale._change > 0 && (
            <div className="reg__success-change">
              <span>Сдача</span>
              <strong>{money(lastSale._change)}</strong>
            </div>
          )}
          <p className="reg__success-total">Итого: {money(total)}</p>
          <div className="reg__success-actions">
            <button type="button" className="ui-modal-btn" onClick={onClose}>Закрыть</button>
            <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={resetCart}>Новая продажа</button>
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

export default RegisterModal;
