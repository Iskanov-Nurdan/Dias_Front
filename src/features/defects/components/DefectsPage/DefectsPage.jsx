import React, { useEffect, useMemo, useState } from 'react';
import './DefectsPage.scss';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber, readWarehouseDefectReason } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, Select, useToast } from '../../../../shared/ui';
import {
  createDefect,
  getDefects,
  getDefectsSelectSources,
  sellDefect,
  sendDefectToRework,
  updateDefect,
  writeoffDefect,
} from '../../api/defectsApi';

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
  qc: 'Контроль качества',
  warehouse: 'Склад',
  return: 'Возврат',
  manual: 'Вручную',
};
const sourceLabel = (t) => SOURCE_LABELS[t] || t || '—';

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

const canEditDefect = (s) => ['new', 'on_stock'].includes(s);
/** Операции sell / writeoff / send-to-rework — только при открытом остатке и не в финальном closed. */
const canMutateDefectStock = (d) => {
  if (!d) return false;
  if (d.status === 'closed') return false;
  if (defectAvailablePcs(d) <= 0) return false;
  if (defectQuantityPcsRaw(d) <= 0) return false;
  return ['new', 'on_stock', 'reworked'].includes(d.status);
};

const defectCounterPcsLine = (label, value) => (
  <p><strong>{label}</strong> {`${formatQuantityDisplay(value == null || value === '' ? 0 : value)} шт`}</p>
);

const DefectsPage = ({ onSentToReworkSuccess }) => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '' });
  const [modalDefect, setModalDefect] = useState(null);
  const [detailDefectId, setDetailDefectId] = useState(null);
  const [writeoffTarget, setWriteoffTarget] = useState(null);
  const [sellTarget, setSellTarget] = useState(null);
  const [sendReworkTarget, setSendReworkTarget] = useState(null);
  const [sendReworkQty, setSendReworkQty] = useState('');
  const [writeoffReason, setWriteoffReason] = useState('');
  const [writeoffQty, setWriteoffQty] = useState('');
  const [sellClient, setSellClient] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [sellQty, setSellQty] = useState('');
  const [clients, setClients] = useState([]);
  const [returnLines, setReturnLines] = useState([]);
  const [warehouseDefectBatches, setWarehouseDefectBatches] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const [sendReworkBusy, setSendReworkBusy] = useState(false);
  const [writeoffBusy, setWriteoffBusy] = useState(false);
  const [sellBusy, setSellBusy] = useState(false);
  const [sellComment, setSellComment] = useState('');
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
    apiClient.get('clients/', { params: { page_size: 500 } }).then((r) => setClients(r.data?.items || [])).catch(() => setClients([]));
    getDefectsSelectSources()
      .then((res) => {
        const data = res.data || {};
        setReturnLines(Array.isArray(data.return_lines) ? data.return_lines : []);
        setWarehouseDefectBatches(Array.isArray(data.warehouse_defect_batches) ? data.warehouse_defect_batches : []);
      })
      .catch(() => {
        setReturnLines([]);
        setWarehouseDefectBatches([]);
      });
  }, []);

  const onSubmitDefect = async (payload) => {
    setSubmitError('');
    try {
      if (modalDefect?.id) await updateDefect(modalDefect.id, payload);
      else await createDefect(payload);
      setModalDefect(null);
      refetch();
      toast.show('Запись брака сохранена');
    } catch (e) {
      setSubmitError(getApiErrorMessage(e, 'Ошибка сохранения записи брака'));
    }
  };

  return (
    <div className="page commercial-page">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start">
          <Select
            value={queryState.status}
            onChange={(v) => setQueryState((p) => ({ ...p, status: v, page: 1 }))}
            options={[{ value: '', label: 'Все статусы' }, ...STATUS_OPTIONS]}
            placeholder="Статус"
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
            <table className="data-table data-table--fixed data-table--row-actions">
            <thead>
              <tr>
                <th>Продукт</th>
                <th className="data-table__cell--num">Количество</th>
                <th>Источник</th>
                <th>Статус</th>
                <th>Причина</th>
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
                      label: 'Отправить в переделку',
                      onClick: () => {
                        setSendReworkTarget(d);
                        setSendReworkQty(String(defectAvailablePcs(d)));
                        setSubmitError('');
                      },
                    },
                    {
                      label: 'Списать',
                      danger: true,
                      onClick: () => {
                        setWriteoffTarget(d);
                        setWriteoffReason('');
                        setWriteoffQty(String(defectAvailablePcs(d)));
                        setSubmitError('');
                      },
                    },
                    {
                      label: 'Продать как брак',
                      onClick: () => {
                        setSellTarget(d);
                        setSellQty(String(defectAvailablePcs(d)));
                        setSellClient('');
                        setSellPrice('');
                        setSellComment('');
                        setSubmitError('');
                      },
                    },
                  );
                }
                return (
                  <tr key={d.id}>
                    <td>
                      <button type="button" className="btn btn--ghost" onClick={() => setDetailDefectId(d.id)}>
                        {d.product || '—'}
                      </button>
                    </td>
                    <td className="data-table__cell--num">{defectQuantityLabel(d)}</td>
                    <td>{sourceLabel(d.source_type)}</td>
                    <td><Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></td>
                    <td>{d.defect_reason || d.writeoff_reason || '—'}</td>
                    <td>
                      {menuItems.length ? (
                        <ActionMenu ariaLabel="Действия" items={menuItems} />
                      ) : (
                        <span style={{ opacity: 0.5 }}>—</span>
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
          returnLines={returnLines}
          warehouseDefectBatches={warehouseDefectBatches}
          defectListItems={items}
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
          onEdit={(defect) => {
            setDetailDefectId(null);
            setModalDefect(defect);
          }}
          onSendToRework={(defect) => {
            setDetailDefectId(null);
            setSendReworkTarget(defect);
            setSendReworkQty(String(defectAvailablePcs(defect)));
            setSubmitError('');
          }}
          onSell={(defect) => {
            setDetailDefectId(null);
            setSellTarget(defect);
            setSellQty(String(defectAvailablePcs(defect)));
            setSellClient('');
            setSellPrice('');
            setSellComment('');
            setSubmitError('');
          }}
          onWriteoff={(defect) => {
            setDetailDefectId(null);
            setWriteoffTarget(defect);
            setWriteoffReason('');
            setWriteoffQty(String(defectAvailablePcs(defect)));
            setSubmitError('');
          }}
        />
      )}

      <ConfirmModal
        open={!!sendReworkTarget}
        title="Отправить в переделку"
        message={sendReworkTarget ? (
          <div className="defects-sell-fields">
            <p style={{ margin: 0 }}>Будет создан запрос на переделку. Доступно: {defectQuantityLabel(sendReworkTarget)}</p>
            <div>
              <label htmlFor="defect-send-rework-qty">Количество к отправке (шт) *</label>
              <input
                id="defect-send-rework-qty"
                value={sendReworkQty}
                onChange={(e) => { setSendReworkQty(e.target.value); setSubmitError(''); }}
                disabled={sendReworkBusy}
              />
            </div>
          </div>
        ) : null}
        confirmText="Отправить"
        confirmBusy={sendReworkBusy}
        onConfirm={async () => {
          if (!sendReworkTarget?.id || sendReworkBusy) return;
          const avail = defectAvailablePcs(sendReworkTarget);
          const q = parseLocaleNumber(String(sendReworkQty).trim());
          if (!Number.isFinite(q) || q <= 0) {
            setSubmitError('Укажите количество');
            return;
          }
          if (q > avail) {
            setSubmitError('Количество не может превышать доступный остаток');
            return;
          }
          setSendReworkBusy(true);
          setSubmitError('');
          try {
            const body = Math.round(q) >= Math.round(avail) ? {} : { quantity: String(Math.round(q)) };
            await sendDefectToRework(sendReworkTarget.id, body);
            await refetch();
            bumpDefectDetail();
            setSendReworkTarget(null);
            setSendReworkQty('');
            toast.show('Брак отправлен в переделку');
            onSentToReworkSuccess?.();
          } catch (e) {
            setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
          } finally {
            setSendReworkBusy(false);
          }
        }}
        onCancel={() => { if (!sendReworkBusy) { setSendReworkTarget(null); setSendReworkQty(''); setSubmitError(''); } }}
        error={sendReworkTarget ? submitError : undefined}
      />

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
            setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
          } finally {
            setWriteoffBusy(false);
          }
        }}
        onCancel={() => { if (!writeoffBusy) { setWriteoffTarget(null); setWriteoffReason(''); setWriteoffQty(''); setSubmitError(''); } }}
        error={writeoffTarget ? submitError : undefined}
      />

      <ConfirmModal
        open={!!sellTarget}
        title="Продать как брак"
        message={(
          <div className="defects-sell-fields">
            <div>
              <label htmlFor="defect-sell-client">Клиент *</label>
              <Select
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
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', opacity: 0.85 }}>
                  Доступно: {defectQuantityLabel(sellTarget)}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="defect-sell-comment">Комментарий</label>
              <textarea id="defect-sell-comment" rows={2} value={sellComment} onChange={(e) => setSellComment(e.target.value)} placeholder="Необязательно" />
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
            const body = {
              client_id: cid,
              price: String(price),
              quantity: String(Math.round(qty)),
            };
            const c = sellComment.trim();
            if (c) body.comment = c;
            await sellDefect(sellTarget.id, body);
            await refetch();
            bumpDefectDetail();
            setSellTarget(null);
            setSellComment('');
            toast.show(Math.round(qty) >= Math.round(avail) ? 'Брак продан' : 'Часть брака продана');
          } catch (e) {
            setSubmitError(getApiErrorMessage(e, 'Ошибка операции'));
          } finally {
            setSellBusy(false);
          }
        }}
        onCancel={() => { if (!sellBusy) { setSellTarget(null); setSubmitError(''); setSellComment(''); } }}
        error={sellTarget ? submitError : undefined}
      />
    </div>
  );
};

const warehouseBatchSelectLabel = (x, defectBySourceId) => {
  const nested = x?.warehouse_batch && typeof x.warehouse_batch === 'object' ? x.warehouse_batch : null;
  const id = x?.id ?? nested?.id;
  const keyRow = id != null ? String(id) : '';
  const keyBatch = nested?.id != null ? String(nested.id) : '';
  const fromDefect = (keyRow && defectBySourceId?.get(keyRow))
    || (keyBatch && defectBySourceId?.get(keyBatch));
  const name = (
    String(
      x?.product_name
      || x?.product
      || nested?.product_name
      || nested?.product?.name
      || (typeof nested?.product === 'string' ? nested.product : '')
      || fromDefect?.product
      || '',
    ).trim() || '—'
  );
  const q = x?.quantity_pcs ?? x?.quantity ?? nested?.quantity_pcs ?? nested?.available_quantity
    ?? fromDefect?.available_quantity_pcs ?? fromDefect?.quantity_pcs;
  const r = (
    readWarehouseDefectReason(x)
    || readWarehouseDefectReason(nested)
    || String(fromDefect?.defect_reason || '').trim()
    || '—'
  );
  const qs = q != null && q !== '' ? `${formatQuantityDisplay(q)} шт` : '—';
  const idDisp = id != null ? id : '—';
  return `#${idDisp} — ${name} — ${qs} — ${r}`;
};

const DefectModal = ({
  defect,
  returnLines,
  warehouseDefectBatches,
  defectListItems,
  defectByWarehouseSourceId,
  onClose,
  onSubmit,
  error,
}) => {
  const [localError, setLocalError] = useState('');
  const [sourceType, setSourceType] = useState(defect?.source_type || 'return');
  const [sourceId, setSourceId] = useState(defect?.source_id != null ? String(defect.source_id) : '');
  const [product, setProduct] = useState(defect?.product || '');
  const [quantityPcs, setQuantityPcs] = useState(defect?.quantity_pcs != null ? String(defect.quantity_pcs) : '');
  const [kgCoeff, setKgCoeff] = useState(defect?.kg_coefficient != null ? String(defect.kg_coefficient) : '');
  const [reason, setReason] = useState(defect?.defect_reason || '');
  const [comment, setComment] = useState(defect?.comment || '');

  useEffect(() => {
    if (sourceType === 'return') {
      const src = returnLines.find((x) => String(x.id) === String(sourceId));
      if (!src) return;
      setProduct(src.product || '');
      if (src.quantity != null && src.quantity !== '') setQuantityPcs(String(src.quantity));
    }
    if (sourceType === 'warehouse') {
      const wb = warehouseDefectBatches.find((x) => String(x.id) === String(sourceId));
      if (!wb) return;
      const nested = wb.warehouse_batch && typeof wb.warehouse_batch === 'object' ? wb.warehouse_batch : null;
      const fd = defectByWarehouseSourceId?.get(String(sourceId))
        || (nested?.id != null ? defectByWarehouseSourceId?.get(String(nested.id)) : null);
      const label = (
        wb.product_name
        || wb.product
        || nested?.product_name
        || nested?.product?.name
        || (typeof nested?.product === 'string' ? nested.product : '')
        || fd?.product
        || ''
      );
      setProduct(String(label).trim());
      const q = wb.quantity_pcs ?? wb.quantity ?? nested?.quantity_pcs ?? nested?.available_quantity
        ?? fd?.available_quantity_pcs ?? fd?.quantity_pcs;
      if (q != null && q !== '') setQuantityPcs(String(q));
      const rs = readWarehouseDefectReason(wb) || readWarehouseDefectReason(nested) || (fd?.defect_reason || '');
      setReason(String(rs).trim());
    }
  }, [sourceId, sourceType, returnLines, warehouseDefectBatches, defectByWarehouseSourceId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{defect ? 'Брак' : 'Новая запись брака'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLocalError('');
            if (!defect && sourceType === 'warehouse' && sourceId) {
              const sid = Number(sourceId);
              if (defectListItems.some((row) => row.source_type === 'warehouse' && Number(row.source_id) === sid)) {
                setLocalError('Этот брак уже есть в списке. Откройте запись через меню «…» у строки в таблице.');
                return;
              }
              try {
                const res = await getDefects({ page_size: 500, source_type: 'warehouse' });
                const list = Array.isArray(res.data?.items) ? res.data.items : [];
                if (list.some((row) => Number(row.source_id) === sid)) {
                  setLocalError('Этот брак уже есть в списке. Откройте запись через меню «…» у строки в таблице.');
                  return;
                }
              } catch {
                setLocalError('Не удалось проверить список брака');
                return;
              }
            }
            onSubmit({
              source_type: sourceType,
              source_id: Number(sourceId),
              product: product.trim() || undefined,
              quantity_pcs: parseLocaleNumber(quantityPcs) || undefined,
              ...(kgCoeff ? { kg_coefficient: parseLocaleNumber(kgCoeff) } : {}),
              defect_reason: reason.trim() || undefined,
              comment: comment.trim() || undefined,
            });
          }}
        >
          <label>Источник</label>
          <Select
            value={sourceType}
            onChange={(v) => { setSourceType(v); setSourceId(''); }}
            options={[
              { value: 'return', label: 'Возврат клиента' },
              { value: 'warehouse', label: 'Склад (партия брака)' },
            ]}
          />
          {sourceType === 'return' && (
            <>
              <label>Строка возврата *</label>
              <Select
                value={sourceId}
                onChange={setSourceId}
                options={[
                  { value: '', label: 'Выберите строку возврата' },
                  ...returnLines.map((x) => ({ value: String(x.id), label: x.label || x.product || `Строка #${x.id}` })),
                ]}
              />
            </>
          )}
          {sourceType === 'warehouse' && (
            <>
              <label>Партия брака на складе *</label>
              <Select
                value={sourceId}
                onChange={setSourceId}
                options={[
                  { value: '', label: 'Выберите партию' },
                  ...warehouseDefectBatches.map((x) => ({
                    value: String(x.id),
                    label: warehouseBatchSelectLabel(x, defectByWarehouseSourceId),
                  })),
                ]}
              />
            </>
          )}
          <label>Продукт</label>
          <input value={product} readOnly />
          <label>Количество</label>
          <input value={quantityPcs ? `${formatQuantityDisplay(quantityPcs)} шт` : ''} readOnly />
          <label>Коэффициент кг/ед.</label>
          <input value={kgCoeff} onChange={(e) => setKgCoeff(e.target.value)} />
          {sourceType === 'warehouse' && sourceId ? (
            <>
              <label>Источник</label>
              <input value="Склад" readOnly />
            </>
          ) : null}
          <label>Причина</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} readOnly={sourceType === 'warehouse' && Boolean(sourceId)} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
          {(error || localError) && <p className="modal__error">{localError || error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
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
  onEdit,
  onSendToRework,
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
        const res = await apiClient.get(`defects/${defectId}/`);
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
  const hideDefectEdit = defect && ['warehouse', 'qc', 'otk', 'return'].includes(String(defect.source_type));
  const isClosed = st === 'closed';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка брака</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && defect && (
          <div style={{ padding: '0 1.5rem 1.5rem' }}>
            <section className="card" style={{ padding: 12, marginBottom: 12 }}>
              <h4>Данные</h4>
              <p><strong>Источник:</strong> {sourceLabel(defect.source_type)}</p>
              <p><strong>Брак / продукт:</strong> {defect.product || '—'}</p>
              {isClosed ? (
                <>
                  <p><strong>Статус:</strong> <Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></p>
                  <p><strong>Количество:</strong> 0 шт</p>
                  {defectCounterPcsLine('Всего поступило:', defect.original_quantity_pcs)}
                  {defectCounterPcsLine('Продано:', defect.sold_quantity_pcs)}
                  {defectCounterPcsLine('Списано:', defect.written_off_quantity_pcs)}
                  {defectCounterPcsLine('Передано в переделку:', defect.sent_to_rework_quantity_pcs)}
                </>
              ) : (
                <>
                  <p><strong>Количество:</strong> {defectQuantityLabel(defect)}</p>
                  {defect.original_quantity_pcs != null && defect.original_quantity_pcs !== '' ? (
                    <p><strong>Всего поступило:</strong> {`${formatQuantityDisplay(defect.original_quantity_pcs)} шт`}</p>
                  ) : null}
                  <p><strong>Статус:</strong> <Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></p>
                </>
              )}
              <p><strong>Причина:</strong> {defect.defect_reason || defect.writeoff_reason || '—'}</p>
              {defect.comment ? <p><strong>Комментарий:</strong> {defect.comment}</p> : null}
            </section>
            <div className="modal__actions">
              {canEditDefect(st) && !hideDefectEdit ? <button type="button" className="btn btn--secondary" onClick={() => onEdit(defect)}>Редактировать</button> : null}
              {canMutateDefectStock(defect) ? (
                <>
                  <button type="button" className="btn btn--secondary" onClick={() => onSendToRework(defect)}>Отправить в переделку</button>
                  <button type="button" className="btn btn--secondary" onClick={() => onSell(defect)}>Продать как брак</button>
                  <button type="button" className="btn btn--danger" onClick={() => onWriteoff(defect)}>Списать</button>
                </>
              ) : null}
              {st === 'sent_to_rework' && !isClosed ? (
                <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.85 }}>
                  Завершение — во вкладке «Переделка», кнопка «Завершить» у запроса.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DefectsPage;
