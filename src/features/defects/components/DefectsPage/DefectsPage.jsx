import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './DefectsPage.scss';
import { useOperationalRefetch } from '../../../../shared/realtime';
import {
  useServerQuery,
  formatQuantityDisplay,
  getApiErrorMessage,
  parseLocaleNumber,
  parseApiListResponse,
  readWarehouseQuality,
} from '../../../../shared/lib';
import { apiClient } from '../../../../shared/api';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, SearchableSelect, useToast } from '../../../../shared/ui';
import {
  createDefect,
  getDefect,
  sellDefect,
  updateDefect,
  writeoffDefect,
} from '../../api/defectsApi';
import { getPaymentSelectSources } from '../../../payments/api/paymentsApi';

const STATUS_OPTIONS = [
  { value: 'new', label: 'Новый' },
  { value: 'on_stock', label: 'На складе брака' },
  { value: 'sent_to_rework', label: 'Передан в переделку' },
  { value: 'reworked', label: 'Переделан' },
  { value: 'sold', label: 'Продан' },
  { value: 'written_off', label: 'Списан' },
  { value: 'closed', label: 'Закрыт' },
];

const statusLabel = (v) => STATUS_OPTIONS.find((x) => x.value === v)?.label || v || '—';

const statusVariant = (v) => {
  switch (v) {
    case 'new': return 'default';
    case 'on_stock': return 'warning';
    case 'sent_to_rework': return 'primary';
    case 'reworked': return 'success';
    case 'sold': return 'success';
    case 'written_off': return 'danger';
    case 'closed': return 'default';
    default: return 'default';
  }
};

const SOURCE_LABELS = {
  otk: 'ОТК',
  qc: 'ОТК',
  warehouse: 'Склад',
  return: 'Возврат',
  manual: 'Вручную',
};
const sourceLabel = (t) => SOURCE_LABELS[t] || t || '—';
const FINAL_STATUSES = new Set(['sold', 'written_off', 'closed']);
const SOURCE_OPTIONS = [
  { value: '', label: 'Все источники' },
  { value: 'warehouse', label: 'Склад' },
  { value: 'return', label: 'Возврат' },
  { value: 'otk', label: 'ОТК' },
  { value: 'manual', label: 'Вручную' },
];

/** Доступный остаток (шт) для sell / writeoff / send-to-rework. */
const defectAvailablePcs = (d) => {
  if (!d || typeof d !== 'object') return 0;
  if (d.available_quantity_pcs != null && d.available_quantity_pcs !== '') {
    const n = Number(d.available_quantity_pcs);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  const n = Number(d.quantity_pcs ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/** Подпись колонки «Количество» из API или из остатка. */
const defectQuantityLabel = (d) => {
  if (!d) return '—';
  if (d.status === 'closed') {
    const lbl = d.display_quantity_label;
    if (lbl != null && String(lbl).trim() !== '') return String(lbl).trim();
    return '0 шт';
  }
  const lbl = d.display_quantity_label;
  if (lbl != null && String(lbl).trim() !== '') return String(lbl).trim();
  const a = defectAvailablePcs(d);
  return a > 0 ? `${formatQuantityDisplay(a)} шт` : '—';
};

const defectQuantityPcsRaw = (d) => {
  if (!d) return 0;
  const n = Number(d.quantity_pcs ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Операции sell / writeoff / send-to-rework — только при открытом остатке и не в финальном closed. */
const canMutateDefectStock = (d) => {
  if (!d) return false;
  if (FINAL_STATUSES.has(String(d.status))) return false;
  if (defectAvailablePcs(d) <= 0) return false;
  if (defectQuantityPcsRaw(d) <= 0) return false;
  return ['new', 'on_stock', 'reworked'].includes(d.status);
};

const defectErrorMessage = (e, fallback) => {
  const code = String(e?.response?.data?.code || '').toLowerCase();
  const map = {
    invalid_status: 'Недопустимый статус операции.',
    invalid_transition: 'Недопустимый переход статуса.',
    missing_defect: 'Не указан брак.',
    no_defect: 'Брак не найден.',
    defect_already_exists: 'Запись брака уже существует.',
    missing_quantity: 'Укажите количество.',
    invalid_quantity: 'Количество должно быть больше 0.',
    negative_quantity: 'Количество не может быть отрицательным.',
    quantity_exceeded: 'Количество превышает доступный остаток.',
    qty_too_high: 'Количество превышает доступный остаток.',
    defect_not_available: 'Этот брак уже недоступен для операции.',
    missing_client: 'Выберите клиента.',
    inactive_client: 'Клиент неактивен.',
    missing_price: 'Укажите цену.',
    invalid_price: 'Цена должна быть больше 0.',
    missing_reason: 'Укажите причину.',
    warehouse_apply: 'Ошибка складской операции.',
    warehouse_rollback: 'Ошибка отката складской операции.',
    rework_active: 'По этому браку уже есть активная переделка.',
    rework_already_completed: 'Переделка уже завершена.',
    rework_already_canceled: 'Переделка уже отменена.',
    rework_complete_forbidden: 'Завершение переделки недоступно в этом статусе.',
    rework_cancel_forbidden: 'Отмена переделки недоступна в этом статусе.',
    use_rework_complete: 'Завершайте переделку во вкладке Переделка.',
    defect_update_forbidden: 'Редактирование полей брака ограничено.',
    rework_update_forbidden: 'Редактирование переделки в этом состоянии запрещено.',
    delete_disabled: 'Удаление отключено.',
  };
  if (map[code]) return map[code];
  return getApiErrorMessage(e, fallback);
};

const DefectsPage = () => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '', source_type: '', search: '' });
  const [modalDefect, setModalDefect] = useState(null);
  const [detailDefectId, setDetailDefectId] = useState(null);
  const [writeoffTarget, setWriteoffTarget] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);
  const [writeoffReason, setWriteoffReason] = useState('');
  const [writeoffQty, setWriteoffQty] = useState('');
  const [sellClient, setSellClient] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [clients, setClients] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [writeoffBusy, setWriteoffBusy] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [detailReloadKey, setDetailReloadKey] = useState(0);
  const { items, meta, raw, loading, error, refetch } = useServerQuery('defects/', queryState, { enabled: true });
  useOperationalRefetch(['defect_record', 'sale', 'rework_request', 'warehouse_batch'], refetch, true);

  const bumpDefectDetail = () => setDetailReloadKey((k) => k + 1);

  const defectByWarehouseSourceId = useMemo(() => {
    const m = new Map();
    items.forEach((d) => {
      if (d.source_type === 'warehouse' && d.source_id != null) {
        m.set(String(d.source_id), d);
      }
    });
    return m;
  }, [items]);

  const listMeta = useMemo(() => {
    if (meta) return meta;
    const r = raw;
    const ps = Number(queryState.page_size) || 20;
    if (r && typeof r.count === 'number' && ps > 0) {
      const pages = Math.max(1, Math.ceil(r.count / ps));
      return { page: queryState.page, pages, total: r.count };
    }
    return null;
  }, [meta, raw, queryState.page, queryState.page_size]);

  useEffect(() => {
    getPaymentSelectSources()
      .then((r) => {
        const list = Array.isArray(r.data?.clients) ? r.data.clients : [];
        setClients(
          list.filter((client) => client?.is_active === true || String(client?.status || '').toLowerCase() === 'active'),
        );
      })
      .catch(() => setClients([]));
  }, []);

  const onSubmitDefect = async (payload) => {
    setSubmitError('');
    const editing = Boolean(modalDefect?.id);
    try {
      if (editing) {
        await updateDefect(modalDefect.id, payload);
      } else if (Array.isArray(payload)) {
        for (const p of payload) {
          await createDefect(p);
        }
      } else {
        await createDefect(payload);
      }
      const batchLen = Array.isArray(payload) ? payload.length : 0;
      setModalDefect(null);
      refetch();
      toast.show(
        editing ? 'Запись обновлена'
          : batchLen > 1 ? `Создано записей: ${batchLen}`
            : batchLen === 1 ? 'Запись брака сохранена'
              : 'Запись брака сохранена',
      );
    } catch (e) {
      setSubmitError(defectErrorMessage(e, 'Ошибка сохранения записи брака'));
    }
  };

  return (
    <div className="page commercial-page page--defects">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <input
            type="text"
            className="ds-toolbar__search"
            placeholder="Поиск"
            value={queryState.search}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
          <SearchableSelect
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            options={[{ value: '', label: 'Все статусы' }, ...STATUS_OPTIONS]}
            placeholder="Статус"
          />
          <SearchableSelect
            value={queryState.source_type}
            onChange={(v) => setQueryState((p) => ({ ...p, source_type: v, page: 1 }))}
            options={SOURCE_OPTIONS}
            placeholder="Источник"
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDefect({})}>Создать брак</button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет записей брака" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <>
          <div className="commercial-table-wrap">
            <table className="data-table data-table--fixed data-table--row-actions data-table--defects">
            <thead>
              <tr>
                <th>№ брака</th>
                <th>Брак / продукт</th>
                <th>Источник</th>
                <th>Причина</th>
                <th className="data-table__cell--num">Количество</th>
                <th>Статус</th>
                <th aria-hidden />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const st = d.status;
                const menuItems = [{ label: 'Открыть', onClick: () => setDetailDefectId(d.id) }];
                if (canMutateDefectStock(d)) {
                  menuItems.push(
                    {
                      label: 'Списать',
                      danger: true,
                      onClick: () => {
                        setWriteoffTarget(d);
                        setWriteoffReason('');
                        setWriteoffQty('');
                        setSubmitError('');
                      },
                    },
                    {
                      label: 'Продать',
                      onClick: () => {
                        setSellTarget(d);
                        setSellQty(String(defectAvailablePcs(d)));
                        setSellClient('');
                        setSellPrice('');
                        setSubmitError('');
                      },
                    },
                  );
                }
                return (
                  <tr key={d.id}>
                    <td>
                      <button type="button" className="btn btn--ghost" onClick={() => setDetailDefectId(d.id)}>
                        {d.display || 'Брак'}
                      </button>
                    </td>
                    <td>{d.product || d.profile_name || d.product_name || '—'}</td>
                    <td>{d.source_label || sourceLabel(d.source_type)}</td>
                    <td>{d.defect_reason || d.writeoff_reason || '—'}</td>
                    <td className="data-table__cell--num">{defectQuantityLabel(d)}</td>
                    <td><Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></td>
                    <td>
                      {menuItems.length ? (
                        <ActionMenu ariaLabel="Действия" items={menuItems} />
                      ) : (
                        <span className="defects-table__empty-action">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
          <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
        </>
      )}

      {modalDefect && (
        <DefectModal
          defect={modalDefect?.id ? modalDefect : null}
          defectByWarehouseSourceId={defectByWarehouseSourceId}
          onClose={() => { setModalDefect(null); setSubmitError(''); }}
          onSubmit={onSubmitDefect}
          error={submitError}
        />
      )}
      {detailDefectId && (
        <DefectDetailModal
          defectId={detailDefectId}
          reloadKey={detailReloadKey}
          onClose={() => setDetailDefectId(null)}
          onSell={(defect) => {
            setDetailDefectId(null);
            setSellTarget(defect);
            setSellQty(String(defectAvailablePcs(defect)));
            setSellClient('');
            setSellPrice('');
            setSubmitError('');
          }}
          onWriteoff={(defect) => {
            setDetailDefectId(null);
            setWriteoffTarget(defect);
            setWriteoffReason('');
            setWriteoffQty('');
            setSubmitError('');
          }}
        />
      )}

      <ConfirmModal
        open={!!writeoffTarget}
        title="Списать брак"
        message={writeoffTarget ? (
          <div className="defects-sell-fields">
            <p style={{ margin: 0 }}>Доступно к списанию: {defectQuantityLabel(writeoffTarget)}</p>
            <div>
              <label htmlFor="defect-writeoff-qty">Количество (шт)</label>
              <input
                id="defect-writeoff-qty"
                value={writeoffQty}
                onChange={(e) => { setWriteoffQty(e.target.value); setSubmitError(''); }}
                disabled={writeoffBusy}
                placeholder="Весь остаток, если пусто"
              />
            </div>
            <div>
              <label htmlFor="defect-writeoff-reason">Причина списания *</label>
              <textarea id="defect-writeoff-reason" rows={3} value={writeoffReason} onChange={(e) => setWriteoffReason(e.target.value)} disabled={writeoffBusy} />
            </div>
          </div>
        ) : null}
        confirmText="Списать"
        confirmBusy={writeoffBusy}
        onConfirm={async () => {
          const reason = writeoffReason.trim();
          if (!reason) {
            setSubmitError('Укажите причину списания');
            return;
          }
          if (!writeoffTarget?.id || writeoffBusy) return;
          const avail = defectAvailablePcs(writeoffTarget);
          const raw = String(writeoffQty).trim();
          const wq = raw === '' ? avail : parseLocaleNumber(raw);
          if (!Number.isFinite(wq) || wq <= 0) {
            setSubmitError('Укажите корректное количество');
            return;
          }
          if (wq > avail) {
            setSubmitError('Количество не может превышать доступный остаток');
            return;
          }
          setWriteoffBusy(true);
          setSubmitError('');
          try {
            const payload = { writeoff_reason: reason };
            if (Math.round(wq) < avail) {
              payload.quantity = String(Math.round(wq));
            }
            await writeoffDefect(writeoffTarget.id, payload);
            await refetch();
            bumpDefectDetail();
            setWriteoffTarget(null);
            setWriteoffReason('');
            setWriteoffQty('');
            toast.show('Списание выполнено');
          } catch (e) {
            setSubmitError(defectErrorMessage(e, 'Ошибка операции'));
          } finally {
            setWriteoffBusy(false);
          }
        }}
        onCancel={() => { if (!writeoffBusy) { setWriteoffTarget(null); setWriteoffReason(''); setWriteoffQty(''); setSubmitError(''); } }}
        error={writeoffTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!sellTarget}
        title="Продать брак"
        message={(
          <div className="defects-sell-fields">
            <div>
              <label htmlFor="defect-sell-client">Клиент *</label>
              <SearchableSelect
                value={sellClient}
                onChange={setSellClient}
                options={[{ value: '', label: 'Выберите клиента' }, ...clients.map((c) => ({ value: String(c.id), label: c.name || 'Без названия' }))]}
              />
            </div>
            <div>
              <label htmlFor="defect-sell-price">Цена *</label>
              <input id="defect-sell-price" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
            </div>
            <div>
              <label htmlFor="defect-sell-qty">Количество (шт) *</label>
              <input
                id="defect-sell-qty"
                value={sellQty}
                onChange={(e) => { setSellQty(e.target.value); setSubmitError(''); }}
                disabled={sellBusy}
              />
              {sellTarget ? (
                <p className="defects-inline-hint">
                  Доступно: {defectQuantityLabel(sellTarget)}
                </p>
              ) : null}
            </div>
          </div>
        )}
        confirmText="Продать"
        confirmBusy={sellBusy}
        onConfirm={async () => {
          const cid = Number(sellClient);
          const price = parseLocaleNumber(sellPrice);
          const qty = parseLocaleNumber(sellQty);
          if (!sellClient || !Number.isFinite(cid) || cid <= 0) {
            setSubmitError('Выберите клиента');
            return;
          }
          if (!Number.isFinite(price) || price <= 0) {
            setSubmitError('Укажите цену');
            return;
          }
          if (!Number.isFinite(qty) || qty <= 0) {
            setSubmitError('Укажите корректное количество');
            return;
          }
          if (!sellTarget?.id || sellBusy) return;
          const avail = defectAvailablePcs(sellTarget);
          if (!Number.isFinite(avail) || avail <= 0) {
            setSubmitError('Нет доступного остатка для продажи');
            return;
          }
          if (qty > avail) {
            setSubmitError('Количество не может превышать доступный остаток');
            return;
          }
          setSellBusy(true);
          setSubmitError('');
          try {
            await sellDefect(sellTarget.id, {
              client_id: cid,
              price: String(price),
              quantity: String(Math.round(qty)),
            });
            await refetch();
            bumpDefectDetail();
            setSellTarget(null);
            toast.show(Math.round(qty) >= Math.round(avail) ? 'Брак продан' : 'Часть брака продана');
          } catch (e) {
            setSubmitError(defectErrorMessage(e, 'Ошибка операции'));
          } finally {
            setSellBusy(false);
          }
        }}
        onCancel={() => { if (!sellBusy) { setSellTarget(null); setSubmitError(''); } }}
        error={sellTarget ? submitError : undefined}
      />
    </div>
  );
};

const gpWarehouseProductLabel = (b) => {
  if (!b || typeof b !== 'object') return '—';
  const own = typeof b.product === 'string' ? b.product.trim() : '';
  if (own) return own;
  const pl = b.linked_entities?.profile?.label;
  if (typeof pl === 'string' && pl.trim()) return pl.trim();
  return '—';
};

const newEmptyDefectCartLine = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  warehouse_batch_id: '',
  quantity_pcs: '',
  defect_reason: '',
});

const DefectModal = ({
  defect,
  defectByWarehouseSourceId,
  onClose,
  onSubmit,
  error,
}) => {
  const [localError, setLocalError] = useState('');
  const [editReason, setEditReason] = useState(defect?.defect_reason || '');
  const [gpBatches, setGpBatches] = useState([]);
  const [gpLoading, setGpLoading] = useState(!defect);
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [cartLines, setCartLines] = useState(() => [newEmptyDefectCartLine()]);

  useEffect(() => {
    setEditReason(defect?.defect_reason || '');
  }, [defect]);

  useEffect(() => {
    if (defect) return undefined;
    let alive = true;
    setGpLoading(true);
    apiClient.get('warehouse/batches/', { params: { page_size: 500 } })
      .then((res) => {
        if (!alive) return;
        const list = parseApiListResponse(res.data).filter((b) => {
          if (readWarehouseQuality(b) === 'defect') return false;
          if (String(b.status || '').toLowerCase() !== 'available') return false;
          const av = Number(b.available_quantity ?? 0);
          return Number.isFinite(av) && av > 0;
        });
        setGpBatches(list);
      })
      .catch(() => {
        if (alive) setGpBatches([]);
      })
      .finally(() => {
        if (alive) setGpLoading(false);
      });
    return () => { alive = false; };
  }, [defect]);

  useEffect(() => {
    setActiveLineIdx((i) => (cartLines.length === 0 ? 0 : Math.min(i, cartLines.length - 1)));
  }, [cartLines.length]);

  const batchById = useMemo(() => {
    const m = new Map();
    gpBatches.forEach((b) => {
      if (b?.id != null) m.set(String(b.id), b);
    });
    return m;
  }, [gpBatches]);

  const batchCap = useCallback((bid) => {
    const b = batchById.get(String(bid));
    if (!b) return null;
    const n = Number(b.available_quantity);
    return Number.isFinite(n) ? n : null;
  }, [batchById]);

  const gpOptions = useMemo(() => gpBatches.filter((b) => !defectByWarehouseSourceId?.get(String(b.id))), [gpBatches, defectByWarehouseSourceId]);

  const gpBatchOptionLabel = (b) => {
    const name = gpWarehouseProductLabel(b);
    const av = b.available_quantity;
    const avPart = av != null && av !== '' ? ` — свободно ${formatQuantityDisplay(av)} шт` : '';
    return `${name}${avPart}`;
  };

  const selectedCartLine = cartLines.length > 0
    ? cartLines[Math.min(activeLineIdx, cartLines.length - 1)]
    : null;

  const submitEdit = async (e) => {
    e.preventDefault();
    setLocalError('');
    if (!editReason.trim()) {
      setLocalError('Укажите причину брака.');
      return;
    }
    await onSubmit({ defect_reason: editReason.trim() });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    setLocalError('');
    const payloads = [];
    const seenBatch = new Set();
    for (let i = 0; i < cartLines.length; i += 1) {
      const line = cartLines[i];
      if (!line.warehouse_batch_id) {
        setLocalError(`Позиция ${i + 1}: выберите партию.`);
        setActiveLineIdx(i);
        return;
      }
      const sid = Number(line.warehouse_batch_id);
      if (seenBatch.has(sid)) {
        setLocalError('Одна партия не может быть указана дважды.');
        setActiveLineIdx(i);
        return;
      }
      seenBatch.add(sid);
      if (defectByWarehouseSourceId?.has(String(sid))) {
        setLocalError('По выбранной партии уже есть запись брака.');
        setActiveLineIdx(i);
        return;
      }
      const q = parseLocaleNumber(line.quantity_pcs);
      if (!Number.isFinite(q) || q <= 0) {
        setLocalError(`Позиция ${i + 1}: укажите количество (шт).`);
        setActiveLineIdx(i);
        return;
      }
      const cap = batchCap(line.warehouse_batch_id);
      if (cap != null && q > cap) {
        setLocalError(`Позиция ${i + 1}: не больше ${formatQuantityDisplay(cap)} шт.`);
        setActiveLineIdx(i);
        return;
      }
      if (!line.defect_reason.trim()) {
        setLocalError(`Позиция ${i + 1}: укажите причину.`);
        setActiveLineIdx(i);
        return;
      }
      payloads.push({
        source_type: 'warehouse',
        warehouse_batch: sid,
        quantity_pcs: String(Math.round(q)),
        defect_reason: line.defect_reason.trim(),
      });
    }
    if (payloads.length === 0) {
      setLocalError('Добавьте позицию.');
      return;
    }
    await onSubmit(payloads);
  };

  if (defect) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal--wide defects-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal__head">
            <h3>Брак</h3>
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
          </div>
          <form className="defects-modal__form" onSubmit={submitEdit}>
            <div className="defects-modal__scroll">
              <label>Продукт</label>
              <input value={defect.product || defect.product_name || '—'} readOnly />
              <label>Причина брака *</label>
              <input value={editReason} onChange={(e) => setEditReason(e.target.value)} />
              {(error || localError) && <p className="modal__error">{localError || error}</p>}
            </div>
            <div className="modal__actions defects-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
              <button type="submit" className="btn btn--primary">Сохранить</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide defects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая запись брака</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <p className="defects-modal__intro">
          Учёт брака только со склада готовой продукции (партия склада ГП).
        </p>
        <form className="defects-modal__form" onSubmit={submitCreate}>
          <div className="defects-modal__scroll">
            {gpLoading ? <p className="defects-inline-note">Загрузка партий…</p> : null}
            <div className="defects-modal__cart-layout">
              <div className="defects-modal__cart-panel">
                <div className="defects-modal__cart-head">
                  <span>Позиции</span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={gpLoading}
                    onClick={() => {
                      setCartLines((prev) => {
                        const next = [...prev, newEmptyDefectCartLine()];
                        setActiveLineIdx(next.length - 1);
                        return next;
                      });
                    }}
                  >
                    + Добавить
                  </button>
                </div>
                <div className="defects-modal__cart-list">
                  {cartLines.map((line, idx) => {
                    const b = line.warehouse_batch_id ? batchById.get(String(line.warehouse_batch_id)) : null;
                    const title = b ? gpWarehouseProductLabel(b) : `Позиция ${idx + 1}`;
                    const qty = parseLocaleNumber(line.quantity_pcs);
                    const qtyPart = Number.isFinite(qty) && qty > 0 ? `${formatQuantityDisplay(qty)} шт` : '…';
                    return (
                      <button
                        key={line.key}
                        type="button"
                        className={`defects-modal__cart-item${activeLineIdx === idx ? ' is-active' : ''}`}
                        onClick={() => setActiveLineIdx(idx)}
                      >
                        <span className="defects-modal__cart-item-title">{title}</span>
                        <span className="defects-modal__cart-item-meta">{qtyPart}{(line.defect_reason || '').trim() ? ` · ${(line.defect_reason || '').trim().slice(0, 36)}${(line.defect_reason || '').trim().length > 36 ? '…' : ''}` : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedCartLine ? (() => {
                const idx = Math.min(activeLineIdx, cartLines.length - 1);
                const line = cartLines[idx];
                const cap = line.warehouse_batch_id ? batchCap(line.warehouse_batch_id) : null;
                return (
                  <div className="defects-modal__line-detail">
                    <div className="defects-modal__line-detail-head">
                      <span className="defects-modal__line-detail-title">Позиция {idx + 1}</span>
                      {cartLines.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setCartLines((prev) => {
                              const next = prev.filter((_, i) => i !== idx);
                              setActiveLineIdx((cur) => {
                                if (next.length === 0) return 0;
                                if (cur >= idx && cur > 0) return cur - 1;
                                return Math.min(cur, next.length - 1);
                              });
                              return next.length > 0 ? next : [newEmptyDefectCartLine()];
                            });
                          }}
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                    <label>Партия склада ГП *</label>
                    <SearchableSelect
                      value={line.warehouse_batch_id}
                      onChange={(v) => {
                        const capN = batchCap(v);
                        setCartLines((prev) => prev.map((row, i) => {
                          if (i !== idx) return row;
                          const qtyParsed = parseLocaleNumber(row.quantity_pcs);
                          const qtyNext = capN != null && (!row.quantity_pcs || !Number.isFinite(qtyParsed) || qtyParsed > capN)
                            ? String(capN)
                            : row.quantity_pcs;
                          return { ...row, warehouse_batch_id: v, quantity_pcs: qtyNext };
                        }));
                      }}
                      placeholder="Выберите партию"
                      disabled={gpLoading}
                      options={[
                        { value: '', label: gpLoading ? 'Загрузка…' : 'Выберите партию' },
                        ...gpOptions.map((b) => ({ value: String(b.id), label: gpBatchOptionLabel(b) })),
                      ]}
                    />
                    {cap != null ? (
                      <>
                        <label>Доступно</label>
                        <div className="defects-modal__readonly">{`${formatQuantityDisplay(cap)} шт`}</div>
                      </>
                    ) : null}
                    <label>Количество (шт) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.quantity_pcs}
                      onChange={(e) => setCartLines((prev) => prev.map((row, i) => (i === idx ? { ...row, quantity_pcs: e.target.value } : row)))}
                    />
                    <label>Причина брака *</label>
                    <input
                      value={line.defect_reason}
                      onChange={(e) => setCartLines((prev) => prev.map((row, i) => (i === idx ? { ...row, defect_reason: e.target.value } : row)))}
                    />
                  </div>
                );
              })() : null}
            </div>
            {(error || localError) && <p className="modal__error">{localError || error}</p>}
          </div>
          <div className="modal__actions defects-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={gpLoading && gpOptions.length === 0}>Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DefectDetailModal = ({
  defectId,
  reloadKey = 0,
  onClose,
  onSell,
  onWriteoff,
}) => {
  const [defect, setDefect] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getDefect(defectId);
        if (!alive) return;
        setDefect(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(getApiErrorMessage(e, 'Не удалось загрузить карточку брака'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [defectId, reloadKey]);

  const st = defect?.status;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide defects-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка брака</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && defect && (
          <>
            <div className="defects-detail-modal__scroll">
              <section className="defects-detail-modal__section">
                <h4>Основное</h4>
                <p><strong>Брак:</strong> {defect.display || 'Карточка брака'}</p>
                <p><strong>Брак / продукт:</strong> {defect.product || defect.product_name || '—'}</p>
                <p><strong>Источник:</strong> {defect.source_label || sourceLabel(defect.source_type)}</p>
                <p><strong>Причина:</strong> {defect.defect_reason || defect.writeoff_reason || '—'}</p>
                <p><strong>Статус:</strong> <Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></p>
              </section>

              <section className="defects-detail-modal__section">
                <h4>Количество</h4>
                <p><strong>Количество:</strong> {defect.display_quantity_label || '—'}</p>
                <p><strong>Всего поступило:</strong> {`${formatQuantityDisplay(defect.original_quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Доступно:</strong> {`${formatQuantityDisplay(defect.available_quantity_pcs ?? defect.quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Продано:</strong> {`${formatQuantityDisplay(defect.sold_quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Списано:</strong> {`${formatQuantityDisplay(defect.written_off_quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Отправлено в переделку:</strong> {`${formatQuantityDisplay(defect.sent_to_rework_quantity_pcs ?? 0)} шт`}</p>
              </section>

              <section className="defects-detail-modal__section">
                <h4>Связи</h4>
                <ul className="defects-detail-modal__links">
                  {defect.warehouse_batch ? <li><strong>Партия склада:</strong> {typeof defect.warehouse_batch === 'object' ? (defect.warehouse_batch.label || '—') : '—'}</li> : null}
                  {defect.source_type === 'return' || defect.source_id != null ? <li><strong>Источник возврата:</strong> {defect.source_label || '—'}</li> : null}
                  {defect.sale ? <li><strong>Связанная продажа:</strong> {typeof defect.sale === 'object' ? (defect.sale.display || defect.sale.sale_number || '—') : '—'}</li> : null}
                  {Array.isArray(defect.rework_requests) && defect.rework_requests.length > 0 ? (
                    <li>
                      <strong>Запросы переделки:</strong> {defect.rework_requests.map((x) => x.rework_number || x.display || '—').join(', ')}
                    </li>
                  ) : null}
                  {Array.isArray(defect.linked_entities) && defect.linked_entities.length > 0 ? (
                    <li><strong>Связанные объекты:</strong> {defect.linked_entities.map((x) => x.label || '—').join(', ')}</li>
                  ) : null}
                </ul>
                {!defect.warehouse_batch
                  && !(defect.source_type === 'return' || defect.source_id != null)
                  && !defect.sale
                  && !(Array.isArray(defect.rework_requests) && defect.rework_requests.length > 0)
                  && !(Array.isArray(defect.linked_entities) && defect.linked_entities.length > 0) ? (
                    <p>Связей пока нет.</p>
                  ) : null}
              </section>
            </div>
            <div className="modal__actions defects-detail-modal__footer">
              {canMutateDefectStock(defect) ? (
                <>
                  <button type="button" className="btn btn--secondary" onClick={() => onSell(defect)}>Продать</button>
                  <button type="button" className="btn btn--danger" onClick={() => onWriteoff(defect)}>Списать</button>
                </>
              ) : null}
              <button type="button" className="btn btn--primary" onClick={onClose}>Закрыть</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DefectsPage;
