import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './ReworkRequestsPage.scss';
import { useOperationalRefetch } from '../../../../shared/realtime';
import { apiClient } from '../../../../shared/api';
import { useServerQuery, formatQuantityDisplay, getApiErrorMessage, parseApiListResponse, parseLocaleNumber } from '../../../../shared/lib';
import { EmptyState, ErrorState, Loading, Pagination, SearchableSelect, useToast } from '../../../../shared/ui';
import {
  createReworkRequest,
  getReworkRequest,
  getReworkSelectSources,
  updateReworkRequest,
} from '../../api/reworkRequestsApi';

const reworkSelectSourcesBucket = (res) => {
  const bucket = res.data?.items;
  if (bucket != null && typeof bucket === 'object' && !Array.isArray(bucket)) return bucket;
  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) return res.data;
  return {};
};

const REWORK_DEFECT_SOURCE_LABELS = {
  warehouse: 'Склад',
  return: 'Возврат',
  otk: 'ОТК',
  qc: 'Контроль качества',
  manual: 'Вручную',
};

/** Доступно шт для новой переделки (как в списке брака). */
const defectReworkAvailablePcs = (d) => {
  if (!d || typeof d !== 'object') return 0;
  if (d.available_quantity_pcs != null && d.available_quantity_pcs !== '') {
    const n = Number(d.available_quantity_pcs);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const q = Number(d.quantity_pcs ?? 0);
  if (Number.isFinite(q) && q > 0) return q;
  const orig = Number(d.original_quantity_pcs ?? NaN);
  return Number.isFinite(orig) && orig > 0 ? orig : 0;
};

const isDefectSelectableForRework = (d) => {
  if (!d || typeof d !== 'object') return false;
  const st = String(d.status || '');
  if (['closed', 'sold', 'written_off', 'sent_to_rework', 'reworked'].includes(st)) return false;
  if (Array.isArray(d.rework_requests) && d.rework_requests.length > 0) return false;
  if (d.rework_request || d.active_rework_request || d.active_rework) return false;
  const sentQty = Number(d.sent_to_rework_quantity_pcs ?? 0);
  if (Number.isFinite(sentQty) && sentQty > 0) return false;
  return defectReworkAvailablePcs(d) > 0;
};

const defectRecordSelectLabel = (d) => {
  if (!d) return '';
  const name = (d.product || d.profile_name || '').trim() || '—';
  const reason = (d.defect_reason || '').trim() || '—';
  const src = REWORK_DEFECT_SOURCE_LABELS[d.source_type] || d.source_type || '—';
  const pcs = defectReworkAvailablePcs(d);
  if (pcs > 0) {
    return `${name} — ${formatQuantityDisplay(pcs)} шт — ${reason} — ${src}`;
  }
  if (d.quantity_kg != null && d.quantity_kg !== '') {
    return `${name} — ${formatQuantityDisplay(d.quantity_kg)} — ${reason} — ${src}`;
  }
  return `${name} — ${reason} — ${src}`;
};

const reworkErrorMessage = (e, fallback) => {
  const code = String(e?.response?.data?.code || '').toLowerCase();
  const map = {
    missing_defect: 'Не указан брак.',
    no_defect: 'Брак не найден.',
    missing_quantity: 'Укажите количество.',
    invalid_quantity: 'Укажите корректное количество.',
    negative_quantity: 'Количество не может быть отрицательным.',
    invalid_status: 'Недопустимый статус.',
    invalid_transition: 'Недопустимый переход статуса.',
    defect_already_exists: 'Запись брака уже существует.',
    defect_not_available: 'Этот брак недоступен для операции.',
    missing_client: 'Выберите клиента.',
    inactive_client: 'Клиент неактивен.',
    missing_price: 'Укажите цену.',
    invalid_price: 'Укажите корректную цену.',
    missing_reason: 'Укажите причину.',
    warehouse_apply: 'Ошибка складской операции.',
    warehouse_rollback: 'Ошибка отката складской операции.',
    rework_active: 'По этому браку уже есть активная переделка.',
    rework_already_completed: 'Переделка уже завершена.',
    rework_already_canceled: 'Переделка уже отменена.',
    rework_complete_forbidden: 'Переделку в этом статусе завершить нельзя.',
    rework_cancel_forbidden: 'Переделку в этом статусе отменить нельзя.',
    use_rework_complete: 'Завершайте переделку через вкладку Переделка.',
    defect_update_forbidden: 'Редактирование брака в этом состоянии запрещено.',
    quantity_exceeded: 'Выход + потери не могут превышать количество переделки.',
    qty_too_high: 'Выход + потери не могут превышать количество переделки.',
    rework_update_forbidden: 'Изменение статуса через редактирование запрещено.',
    delete_disabled: 'Удаление отключено.',
  };
  if (map[code]) return map[code];
  return getApiErrorMessage(e, fallback);
};

const warehouseBatchShortLabel = (b) => {
  if (!b || typeof b !== 'object') return '—';
  const name = b.product_name || b.product?.name;
  const form = b.inventory_form;
  const parts = [name, form].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
};

const reworkResultLabel = (row, batchById) => {
  const nested = row.result_warehouse_batch;
  if (nested && typeof nested === 'object') {
    const name = nested.product_name || nested.product?.name;
    const form = nested.inventory_form;
    const qty = nested.available_quantity != null ? formatQuantityDisplay(nested.available_quantity) : null;
    const parts = [name, form, qty ? `остаток ${qty}` : null].filter(Boolean);
    if (parts.length) return parts.join(' · ');
  }
  const bid = row.result_warehouse_batch_id;
  if (bid != null && batchById?.has(String(bid))) {
    return warehouseBatchShortLabel(batchById.get(String(bid)));
  }
  return '—';
};

const reworkDisplayName = (r) => (
  r.result_name
  || r.rework_name
  || r.output_name
  || r.product
  || r.result_warehouse_batch?.product_name
  || r.result_warehouse_batch?.product?.name
  || '—'
);

const positiveQuantity = (v) => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseLocaleNumber(String(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

/** Масса в кг из одной строки (например «12,5»). */
const reworkMassKgFromInput = (massStr) => {
  const raw = parseLocaleNumber(String(massStr ?? '').trim());
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.round(raw * 100000) / 100000;
};

const massKgSplitHint = (totalKg) => {
  if (!Number.isFinite(totalKg) || totalKg <= 0) return '';
  const whole = Math.floor(totalKg + 1e-9);
  const grams = Math.round((totalKg - whole) * 1000);
  if (grams <= 0) return `${whole} кг`;
  return `${whole} кг ${grams} г`;
};

const resolveReworkDefectRef = (r, defectById) => {
  if (r.defect_record && typeof r.defect_record === 'object') return r.defect_record;
  const id = r.defect_record_id;
  if (id != null && defectById?.has(String(id))) return defectById.get(String(id));
  return null;
};

/** Итоговая масса переделанного сырья: в кг/граммах, не в штуках. */
const reworkMassLabel = (r) => {
  const qKg = positiveQuantity(r.quantity_kg);
  if (qKg != null) {
    return `${formatQuantityDisplay(qKg)} кг (${massKgSplitHint(qKg)})`;
  }
  const def = resolveReworkDefectRef(r, null);
  const defKg = positiveQuantity(def?.quantity_kg);
  if (defKg != null) return `${formatQuantityDisplay(defKg)} кг (${massKgSplitHint(defKg)})`;
  return '—';
};

const ReworkRequestsPage = ({ onAfterMutation }) => {
  const toast = useToast();
  const [queryState, setQueryState] = useState({ page: 1, page_size: 20, search: '' });
  const [modalDoc, setModalDoc] = useState(null);
  const [detailDocId, setDetailDocId] = useState(null);
  const [warehouseBatches, setWarehouseBatches] = useState([]);
  const [defectsList, setDefectsList] = useState([]);
  const [submitError, setSubmitError] = useState('');
  const { items, meta, raw, loading, error, refetch } = useServerQuery('rework-requests/', queryState, { enabled: true });
  useOperationalRefetch(['rework_request', 'defect_record', 'warehouse_batch'], refetch, true);

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

  const batchById = useMemo(() => {
    const m = new Map();
    warehouseBatches.forEach((b) => {
      if (b?.id != null) m.set(String(b.id), b);
    });
    return m;
  }, [warehouseBatches]);

  const defectByIdForReworkQty = useMemo(() => {
    const m = new Map();
    defectsList.forEach((d) => {
      if (d?.id != null) m.set(String(d.id), d);
    });
    return m;
  }, [defectsList]);

  const loadRefs = useCallback(() => {
    getReworkSelectSources()
      .then((res) => {
        const data = reworkSelectSourcesBucket(res);
        const wb = Array.isArray(data.result_warehouse_batches) ? data.result_warehouse_batches : [];
        const defects = Array.isArray(data.defect_records) ? data.defect_records : [];
        setWarehouseBatches(wb);
        if (defects.length > 0) {
          setDefectsList(defects);
          return;
        }
        return apiClient.get('defects/', { params: { page_size: 500 } }).then((r2) => {
          setDefectsList(parseApiListResponse(r2.data));
        });
      })
      .catch(() => {
        setWarehouseBatches([]);
        setDefectsList([]);
      });
  }, []);

  useEffect(() => { loadRefs(); }, [loadRefs]);

  const onSubmit = async (payload) => {
    setSubmitError('');
    try {
      if (modalDoc?.id) {
        await updateReworkRequest(modalDoc.id, payload);
      } else if (Array.isArray(payload)) {
        for (const p of payload) {
          await createReworkRequest(p);
        }
      } else {
        await createReworkRequest(payload);
      }
      const n = Array.isArray(payload) ? payload.length : 0;
      const editing = Boolean(modalDoc?.id);
      setModalDoc(null);
      await refetch();
      loadRefs();
      onAfterMutation?.();
      toast.show(editing ? 'Запись обновлена' : (n > 1 ? `Переделок: ${n}` : 'Переделка выполнена'));
    } catch (e) {
      setSubmitError(reworkErrorMessage(e, 'Ошибка сохранения'));
    }
  };

  return (
    <div className="page commercial-page page--rework">
      <div className="ds-toolbar ds-toolbar--stack-mobile commercial-toolbar">
        <div className="ds-toolbar__start commercial-toolbar__filters">
          <input
            type="text"
            className="ds-toolbar__search"
            placeholder="Поиск"
            value={queryState.search || ''}
            onChange={(e) => setQueryState((p) => ({ ...p, search: e.target.value, page: 1 }))}
          />
        </div>
        <div className="ds-toolbar__end">
          <button type="button" className="btn btn--primary" onClick={() => setModalDoc({})}>Создать переделку</button>
        </div>
      </div>

      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}
      {!loading && (!error || error.status === 404) && items.length === 0 && <EmptyState title="Нет запросов переделки" />}
      {!loading && (!error || error.status === 404) && items.length > 0 && (
        <>
          <div className="commercial-table-wrap">
            <table className="data-table data-table--fixed data-table--rework">
            <thead>
              <tr>
                <th>Номер переделки</th>
                <th>Название</th>
                <th className="data-table__cell--num">Масса</th>
                <th>Состояние</th>
                <th>Результат</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button type="button" className="btn btn--ghost" onClick={() => setDetailDocId(r.id)}>
                        {r.rework_number || '—'}
                      </button>
                    </td>
                    <td>{reworkDisplayName(r)}</td>
                    <td className="data-table__cell--num">{reworkMassLabel(r, defectByIdForReworkQty)}</td>
                    <td>Сделано</td>
                    <td>{reworkResultLabel(r, batchById)}</td>
                  </tr>
              ))}
            </tbody>
            </table>
          </div>
          <Pagination meta={listMeta} onPageChange={(nextPage) => setQueryState((p) => ({ ...p, page: nextPage }))} />
        </>
      )}

      {modalDoc && (
        <ReworkModal
          defectsList={defectsList}
          onSubmit={onSubmit}
          onClose={() => { setModalDoc(null); setSubmitError(''); }}
          error={submitError}
        />
      )}
      {detailDocId && (
        <ReworkDetailModal
          reworkId={detailDocId}
          batchById={batchById}
          onClose={() => setDetailDocId(null)}
        />
      )}
    </div>
  );
};

const newReworkCartLine = () => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  result_name: '',
  defect_record: '',
  quantity_pcs: '',
  mass_kg: '',
});

const ReworkModal = ({
  defectsList,
  onSubmit,
  onClose,
  error,
}) => {
  const [activeLineIdx, setActiveLineIdx] = useState(0);
  const [lines, setLines] = useState(() => [newReworkCartLine()]);
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    setActiveLineIdx((i) => (lines.length === 0 ? 0 : Math.min(i, lines.length - 1)));
  }, [lines.length]);

  const defectById = useMemo(() => {
    const m = new Map();
    defectsList.forEach((d) => {
      if (d?.id != null) m.set(String(d.id), d);
    });
    return m;
  }, [defectsList]);

  const defectOptions = useMemo(() => defectsList
    .filter(isDefectSelectableForRework)
    .map((d) => ({
      value: String(d.id),
      label: defectRecordSelectLabel(d),
    })), [defectsList]);

  const selectedLine = lines.length > 0
    ? lines[Math.min(activeLineIdx, Math.max(0, lines.length - 1))]
    : null;

  const submitForm = async (e) => {
    e.preventDefault();
    setLocalError('');
    const seen = new Set();
    const payloads = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.defect_record) {
        setLocalError(`Позиция ${i + 1}: выберите запись брака.`);
        setActiveLineIdx(i);
        return;
      }
      const id = Number(line.defect_record);
      if (seen.has(id)) {
        setLocalError('Одну запись брака нельзя добавить дважды.');
        setActiveLineIdx(i);
        return;
      }
      seen.add(id);
      const dRow = defectById.get(String(id));
      if (!isDefectSelectableForRework(dRow)) {
        setLocalError(`Позиция ${i + 1}: брак недоступен для переделки.`);
        setActiveLineIdx(i);
        return;
      }
      const cap = defectReworkAvailablePcs(dRow);
      const q = parseLocaleNumber(String(line.quantity_pcs ?? '').trim());
      if (!Number.isFinite(q) || q <= 0) {
        setLocalError(`Позиция ${i + 1}: укажите количество брака (шт).`);
        setActiveLineIdx(i);
        return;
      }
      if (Math.round(q) > Math.round(cap)) {
        setLocalError(`Позиция ${i + 1}: не больше ${formatQuantityDisplay(cap)} шт.`);
        setActiveLineIdx(i);
        return;
      }
      const mass = reworkMassKgFromInput(line.mass_kg);
      if (!(mass > 0)) {
        setLocalError(`Позиция ${i + 1}: укажите массу сырья на переделку (кг), например 12,5.`);
        setActiveLineIdx(i);
        return;
      }
      if (!line.result_name.trim()) {
        setLocalError(`Позиция ${i + 1}: укажите название переделанного сырья.`);
        setActiveLineIdx(i);
        return;
      }
      payloads.push({
        defect_record: id,
        result_name: line.result_name.trim(),
        quantity_pcs: String(Math.round(q)),
        quantity_kg: String(mass),
      });
    }
    if (payloads.length === 0) {
      setLocalError('Добавьте хотя бы одну позицию.');
      return;
    }
    await onSubmit(payloads);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide rework-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Новая переделка</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <p className="rework-modal__intro">
          Укажите название переделанного сырья, выберите брак и массу в килограммах
          (например <strong>12,5</strong> кг — это 12 кг и 500 г). На склад переделанных уходит масса в кг.
        </p>
        <form className="rework-modal__form" onSubmit={submitForm}>
          <div className="rework-modal__scroll">
            <div className="rework-modal__cart-layout">
              <div className="rework-modal__cart-panel">
                <div className="rework-modal__cart-head">
                  <span>Позиции</span>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => {
                      setLines((prev) => {
                        const next = [...prev, newReworkCartLine()];
                        setActiveLineIdx(next.length - 1);
                        return next;
                      });
                    }}
                  >
                    + Добавить
                  </button>
                </div>
                <div className="rework-modal__cart-list">
                  {lines.map((line, idx) => {
                    const dRow = line.defect_record ? defectById.get(String(line.defect_record)) : null;
                    const title = dRow
                      ? `${line.result_name.trim() || (dRow.product || dRow.profile_name || '').trim() || 'Брак'}`
                      : `Позиция ${idx + 1}`;
                    const m = reworkMassKgFromInput(line.mass_kg);
                    const q = parseLocaleNumber(String(line.quantity_pcs ?? '').trim());
                    const qtyPart = Number.isFinite(q) && q > 0 ? `${formatQuantityDisplay(q)} шт` : '…';
                    const massPart = m > 0 ? `${formatQuantityDisplay(m)} кг` : '…';
                    return (
                      <button
                        key={line.key}
                        type="button"
                        className={`rework-modal__cart-item${activeLineIdx === idx ? ' is-active' : ''}`}
                        onClick={() => setActiveLineIdx(idx)}
                      >
                        <span className="rework-modal__cart-item-title">{title}</span>
                        <span className="rework-modal__cart-item-meta">{qtyPart} · {massPart}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedLine ? (() => {
                const idx = Math.min(activeLineIdx, lines.length - 1);
                const line = lines[idx];
                const picked = line.defect_record ? defectById.get(String(line.defect_record)) : null;
                return (
                  <div className="rework-modal__line-detail">
                    <div className="rework-modal__line-detail-head">
                      <span>Позиция {idx + 1}</span>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => {
                            setLines((prev) => {
                              const next = prev.filter((_, i) => i !== idx);
                              setActiveLineIdx((cur) => {
                                if (next.length === 0) return 0;
                                if (cur >= idx && cur > 0) return cur - 1;
                                return Math.min(cur, next.length - 1);
                              });
                              return next.length > 0 ? next : [newReworkCartLine()];
                            });
                          }}
                        >
                          Удалить
                        </button>
                      ) : null}
                    </div>
                    <label>Название переделанного сырья *</label>
                    <input
                      value={line.result_name}
                      onChange={(e) => setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, result_name: e.target.value } : row)))}
                      placeholder="Например: Переделанный профиль X"
                    />
                    <label>Запись брака *</label>
                    <SearchableSelect
                      value={line.defect_record}
                      onChange={(v) => {
                        setLines((prev) => prev.map((row, i) => {
                          if (i !== idx) return row;
                          const next = { ...row, defect_record: v };
                          if (!v) return next;
                          const dr = defectById.get(String(v));
                          const cap = dr ? defectReworkAvailablePcs(dr) : 0;
                          const cur = parseLocaleNumber(String(row.quantity_pcs ?? '').trim());
                          if (Number.isFinite(cap) && cap > 0 && (!Number.isFinite(cur) || cur > cap)) {
                            next.quantity_pcs = String(Math.round(cap));
                          }
                          return next;
                        }));
                      }}
                      placeholder="Выберите запись брака"
                      options={defectOptions.length > 0
                        ? [{ value: '', label: 'Выберите запись брака' }, ...defectOptions]
                        : [{ value: '', label: 'Нет доступных записей брака' }]}
                    />
                    {picked ? (
                      <>
                        <label>Доступно</label>
                        <div className="rework-modal__readonly">{`${formatQuantityDisplay(defectReworkAvailablePcs(picked))} шт`}</div>
                      </>
                    ) : null}
                    <label>Количество брака (шт) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Сколько шт с этой записи"
                      value={line.quantity_pcs}
                      onChange={(e) => setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, quantity_pcs: e.target.value } : row)))}
                      disabled={!picked}
                    />
                    <label>Масса сырья на переделку (кг) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Например 12,5"
                      value={line.mass_kg}
                      onChange={(e) => setLines((prev) => prev.map((row, i) => (i === idx ? { ...row, mass_kg: e.target.value } : row)))}
                      disabled={!picked}
                    />
                    <p className="rework-modal__mass-sum">
                      {(() => {
                        const t = reworkMassKgFromInput(line.mass_kg);
                        if (!(t > 0)) return 'Итого: —';
                        return `Итого: ${formatQuantityDisplay(t)} кг (${massKgSplitHint(t)})`;
                      })()}
                    </p>
                  </div>
                );
              })() : null}
            </div>
            {(localError || error) && <p className="modal__error">{localError || error}</p>}
          </div>
          <div className="modal__actions rework-modal__footer">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ReworkDetailModal = ({
  reworkId,
  batchById,
  onClose,
}) => {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getReworkRequest(reworkId);
        if (!alive) return;
        setDoc(res.data || null);
      } catch (e) {
        if (!alive) return;
        setError(reworkErrorMessage(e, 'Не удалось загрузить карточку переделки'));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [reworkId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide rework-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>Карточка переделки</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading && <Loading />}
        {!loading && error && <p className="modal__error">{error}</p>}
        {!loading && !error && doc && (
          <>
            <div className="rework-detail-modal__scroll">
              <section className="rework-detail-modal__section">
                <h4>Документ</h4>
                <p><strong>№ переделки:</strong> {doc.rework_number || '—'}</p>
                <p><strong>Состояние:</strong> Сделано</p>
                <p><strong>Дата создания:</strong> {doc.created_at || '—'}</p>
              </section>
              <section className="rework-detail-modal__section">
                <h4>Исходный брак</h4>
                <p><strong>Название переделанного сырья:</strong> {reworkDisplayName(doc)}</p>
                <p><strong>defect_product_name:</strong> {doc.defect_product_name || doc.product || '—'}</p>
                <p><strong>defect_reason:</strong> {doc.defect_reason || '—'}</p>
                <p><strong>defect_source_label:</strong> {doc.defect_source_label || '—'}</p>
                <p><strong>defect_source_type:</strong> {REWORK_DEFECT_SOURCE_LABELS[doc.defect_source_type] || doc.defect_source_type || '—'}</p>
              </section>
              <section className="rework-detail-modal__section">
                <h4>Масса</h4>
                <p><strong>Переделано:</strong> {reworkMassLabel(doc)}</p>
                <p><strong>Брак списан:</strong> {doc.quantity_pcs != null ? `${formatQuantityDisplay(doc.quantity_pcs)} шт` : '—'}</p>
              </section>
              <section className="rework-detail-modal__section">
                <h4>Результат</h4>
                <p><strong>output_quantity:</strong> {doc.output_quantity ?? '—'}</p>
                <p><strong>output_quantity_kg:</strong> {doc.output_quantity_kg ?? '—'}</p>
                <p><strong>loss_quantity:</strong> {doc.loss_quantity ?? '—'}</p>
                <p><strong>loss_quantity_kg:</strong> {doc.loss_quantity_kg ?? '—'}</p>
                <p><strong>quality:</strong> {doc.quality === 'good' ? 'Годный' : doc.quality === 'defect' ? 'Брак' : '—'}</p>
                <p><strong>result_warehouse_batch:</strong> {reworkResultLabel(doc, batchById)}</p>
                <p><strong>conversion_rate:</strong> {doc.conversion_rate ?? '—'}</p>
              </section>
              <section className="rework-detail-modal__section">
                <h4>Связи</h4>
                <ul className="rework-detail-modal__links">
                  {doc.defect_record ? <li><strong>defect_record:</strong> {typeof doc.defect_record === 'object' ? (doc.defect_record.label || doc.defect_record.id || '—') : doc.defect_record}</li> : null}
                  {doc.return_doc ? <li><strong>return_doc:</strong> {typeof doc.return_doc === 'object' ? (doc.return_doc.return_number || doc.return_doc.id || '—') : doc.return_doc}</li> : null}
                  {doc.original_sale ? <li><strong>original_sale:</strong> {typeof doc.original_sale === 'object' ? (doc.original_sale.sale_number || doc.original_sale.id || '—') : doc.original_sale}</li> : null}
                  {doc.result_warehouse_batch ? <li><strong>result_warehouse_batch:</strong> {reworkResultLabel(doc, batchById)}</li> : null}
                  {Array.isArray(doc.linked_entities) && doc.linked_entities.length > 0 ? (
                    <li><strong>linked_entities:</strong> {doc.linked_entities.map((x) => x.label || x.id || '—').join(', ')}</li>
                  ) : null}
                </ul>
                {!doc.defect_record && !doc.return_doc && !doc.original_sale && !doc.result_warehouse_batch && !(Array.isArray(doc.linked_entities) && doc.linked_entities.length > 0) ? (
                  <p>Связей пока нет.</p>
                ) : null}
              </section>
            </div>
            <div className="modal__actions rework-detail-modal__footer">
              <button type="button" className="btn btn--secondary" onClick={onClose}>Закрыть</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReworkRequestsPage;
