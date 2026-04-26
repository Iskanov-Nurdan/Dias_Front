import React, { useEffect, useMemo, useState } from 'react';
import './DefectsPage.scss';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseLocaleNumber, readWarehouseDefectReason } from '../../../../shared/lib';
import { ActionMenu, Badge, ConfirmModal, EmptyState, ErrorState, Loading, Pagination, SearchableSelect, useToast } from '../../../../shared/ui';
import {
  createDefect,
  getDefect,
  getDefectSelectSources,
  sellDefect,
  sendDefectToRework,
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

const DefectsPage = ({ onSentToReworkSuccess }) => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, status: '', source_type: '', search: '' });
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
    getPaymentSelectSources()
      .then((r) => {
        const list = Array.isArray(r.data?.clients) ? r.data.clients : [];
        setClients(
          list.filter((client) => client?.is_active === true || String(client?.status || '').toLowerCase() === 'active'),
        );
      })
      .catch(() => setClients([]));
    getDefectSelectSources()
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
                      label: 'Отправить в переделку',
                      onClick: () => {
                        setSendReworkTarget(d);
                        setSendReworkQty('');
                        setSubmitError('');
                      },
                    },
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
                        {`Брак #${d.id}`}
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
          onSendToRework={(defect) => {
            setDetailDefectId(null);
            setSendReworkTarget(defect);
            setSendReworkQty('');
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
            setWriteoffQty('');
            setSubmitError('');
          }}
        />
      )}

      <ConfirmModal
        open={!!sendReworkTarget}
        title="Отправить в переделку"
        message={sendReworkTarget ? (
          <div className="defects-sell-fields">
            <p className="defects-inline-note">Будет создан запрос на переделку. Доступно: {defectQuantityLabel(sendReworkTarget)}</p>
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
          const raw = String(sendReworkQty).trim();
          const q = raw === '' ? avail : parseLocaleNumber(raw);
          if (!Number.isFinite(q) || q <= 0) {
            setSubmitError('Укажите корректное количество');
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
            setSubmitError(defectErrorMessage(e, 'Ошибка операции'));
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
            setSubmitError(defectErrorMessage(e, 'Ошибка операции'));
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
      <div className="modal modal--wide defects-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{defect ? 'Брак' : 'Новая запись брака'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          className="defects-modal__form"
          onSubmit={async (e) => {
            e.preventDefault();
            setLocalError('');
            if (!defect && sourceType === 'warehouse' && sourceId) {
              const sid = Number(sourceId);
              if (defectListItems.some((row) => row.source_type === 'warehouse' && Number(row.source_id) === sid)) {
                setLocalError('Этот брак уже есть в списке.');
                return;
              }
            }
            if (!sourceType) {
              setLocalError('Выберите источник брака.');
              return;
            }
            if ((sourceType === 'warehouse' || sourceType === 'return') && !sourceId) {
              setLocalError('Выберите источник.');
              return;
            }
            if (sourceType === 'manual' || sourceType === 'otk') {
              const qty = parseLocaleNumber(quantityPcs);
              if (!product.trim()) {
                setLocalError('Укажите товар.');
                return;
              }
              if (!Number.isFinite(qty) || qty <= 0) {
                setLocalError('Количество должно быть больше 0.');
                return;
              }
            }
            if (!reason.trim()) {
              setLocalError('Укажите причину брака.');
              return;
            }
            onSubmit({
              source_type: sourceType,
              ...(sourceType === 'warehouse' ? { warehouse_batch: Number(sourceId) } : {}),
              ...(sourceType === 'return' ? { source_id: Number(sourceId) } : {}),
              ...((sourceType === 'manual' || sourceType === 'otk')
                ? { product: product.trim(), quantity_pcs: String(Math.round(parseLocaleNumber(quantityPcs))) }
                : {}),
              defect_reason: reason.trim(),
              comment: comment.trim() || undefined,
            });
          }}
        >
          <div className="defects-modal__scroll">
            <label>Источник брака *</label>
            <SearchableSelect
              value={sourceType}
              onChange={(v) => { setSourceType(v); setSourceId(''); }}
              options={[
                { value: 'manual', label: 'Вручную' },
                { value: 'warehouse', label: 'Склад' },
                { value: 'return', label: 'Возврат' },
                { value: 'otk', label: 'ОТК' },
              ]}
            />
          {sourceType === 'return' && (
            <>
              <label>Строка возврата *</label>
              <SearchableSelect
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
              <SearchableSelect
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
          <label>Товар{sourceType === 'manual' || sourceType === 'otk' ? ' *' : ''}</label>
          <input
            value={product}
            readOnly={!(sourceType === 'manual' || sourceType === 'otk')}
            onChange={(e) => setProduct(e.target.value)}
          />
          <label>Количество{sourceType === 'manual' || sourceType === 'otk' ? ' *' : ''}</label>
          <input
            value={(sourceType === 'manual' || sourceType === 'otk')
              ? quantityPcs
              : (quantityPcs ? `${formatQuantityDisplay(quantityPcs)} шт` : '')}
            readOnly={!(sourceType === 'manual' || sourceType === 'otk')}
            onChange={(e) => setQuantityPcs(e.target.value)}
          />
          {sourceType === 'warehouse' && sourceId ? (
            <>
              <label>Источник</label>
              <input value="Склад" readOnly />
            </>
          ) : null}
          <label>Причина брака *</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
          <label>Комментарий</label>
          <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
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
};

const DefectDetailModal = ({
  defectId,
  reloadKey = 0,
  onClose,
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
                <p><strong>№ брака:</strong> {`Брак #${defect.id}`}</p>
                <p><strong>Брак / продукт:</strong> {defect.product || defect.product_name || '—'}</p>
                <p><strong>Источник:</strong> {defect.source_label || sourceLabel(defect.source_type)}</p>
                <p><strong>Причина:</strong> {defect.defect_reason || defect.writeoff_reason || '—'}</p>
                <p><strong>Статус:</strong> <Badge variant={statusVariant(st)}>{statusLabel(st)}</Badge></p>
                <p><strong>Комментарий:</strong> {defect.comment || '—'}</p>
              </section>

              <section className="defects-detail-modal__section">
                <h4>Количество</h4>
                <p><strong>display_quantity_label:</strong> {defect.display_quantity_label || '—'}</p>
                <p><strong>Всего поступило:</strong> {`${formatQuantityDisplay(defect.original_quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Доступно:</strong> {`${formatQuantityDisplay(defect.available_quantity_pcs ?? defect.quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Продано:</strong> {`${formatQuantityDisplay(defect.sold_quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Списано:</strong> {`${formatQuantityDisplay(defect.written_off_quantity_pcs ?? 0)} шт`}</p>
                <p><strong>Отправлено в переделку:</strong> {`${formatQuantityDisplay(defect.sent_to_rework_quantity_pcs ?? 0)} шт`}</p>
              </section>

              <section className="defects-detail-modal__section">
                <h4>Связи</h4>
                <ul className="defects-detail-modal__links">
                  {defect.warehouse_batch ? <li><strong>warehouse_batch:</strong> {typeof defect.warehouse_batch === 'object' ? (defect.warehouse_batch.label || defect.warehouse_batch.id || '—') : defect.warehouse_batch}</li> : null}
                  {defect.source_type === 'return' || defect.source_id != null ? <li><strong>return source:</strong> {defect.source_label || defect.source_id || '—'}</li> : null}
                  {defect.sale ? <li><strong>sale defect:</strong> {typeof defect.sale === 'object' ? (defect.sale.sale_number || defect.sale.id || '—') : defect.sale}</li> : null}
                  {Array.isArray(defect.rework_requests) && defect.rework_requests.length > 0 ? (
                    <li>
                      <strong>rework requests:</strong> {defect.rework_requests.map((x) => x.rework_number || x.id || '—').join(', ')}
                    </li>
                  ) : null}
                  {Array.isArray(defect.linked_entities) && defect.linked_entities.length > 0 ? (
                    <li><strong>linked_entities:</strong> {defect.linked_entities.map((x) => x.label || x.id || '—').join(', ')}</li>
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
                  <button type="button" className="btn btn--secondary" onClick={() => onSendToRework(defect)}>Отправить в переделку</button>
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
