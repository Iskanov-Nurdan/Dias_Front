import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useDiscardOnClose, useDirtyFromBaseline } from '../../../../shared/hooks';
import {
  useServerQuery,
  formatNumberForInput,
  formatQuantityDisplay,
  parseLocaleNumber,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast, DecimalInput, Select } from '../../../../shared/ui';
import {
  createIncoming,
  createRawMaterial,
  deleteRawMaterial,
  updateRawMaterial,
} from '../../api/materialsApi';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './MaterialsPage.scss';

/** Значения для API: kg / g (канон бэкенда). */
const UNITS = [
  { value: 'kg', label: 'кг' },
  { value: 'g', label: 'г' },
];

const MAIN_TAB = {
  CATALOG: 'catalog',
  STOCK: 'stock',
  BATCHES: 'batches',
  MOVEMENTS: 'movements',
};

const unitLabelRu = (u) => {
  const s = String(u ?? '').toLowerCase();
  if (s === 'kg' || s === 'кг') return 'кг';
  if (s === 'g' || s === 'г') return 'г';
  return u || 'кг';
};

const BALANCE_FILTER = {
  ALL: 'all',
  LOW: 'low',
  OK: 'ok',
};

const normName = (s) => String(s ?? '').trim().toLowerCase();

/** ID сырья в справочнике (остатки: material_id; старый API: id). */
const getMaterialId = (b) => b?.material_id ?? b?.id ?? b?.raw_material_id;

const minBalanceValue = (b) => b?.min_balance ?? b?.min_stock;

const getComment = (b) => b?.comment ?? b?.note ?? b?.notes ?? '';

const isUnitLocked = (b) => {
  if (b?.unit_locked === true || b?.unit_change_allowed === false) return true;
  if (b?.has_receipts === true || b?.has_movements === true) return true;
  if (Number(b?.incoming_count) > 0 || Number(b?.movement_count) > 0) return true;
  return false;
};

/** Удаление только по флагу бэкенда (учёт химии/рецептов/партий). */
const canDeleteMaterial = (b) => b?.deletable === true;

const isLowStock = (b) => {
  const min = minBalanceValue(b);
  if (min === null || min === undefined || min === '') return false;
  const minN = Number(min);
  if (Number.isNaN(minN)) return false;
  return Number(b.balance) <= minN;
};

/** Для вкладки «Остатки»: норма / мало / нет в наличии */
const getStockLevelKey = (b) => {
  const bal = Number(b.balance);
  if (!Number.isFinite(bal) || bal <= 0) return 'empty';
  if (isLowStock(b)) return 'low';
  return 'ok';
};

const STOCK_LEVEL_LABEL = {
  ok: 'норма',
  low: 'мало',
  empty: 'нет в наличии',
};

const MaterialsPage = () => {
  const toast = useToast();
  const [mainTab, setMainTab] = useState(MAIN_TAB.CATALOG);
  const [catalogModal, setCatalogModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [replenishModal, setReplenishModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesSearch, setBalancesSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState(BALANCE_FILTER.ALL);

  const refetchBalances = useCallback(() => {
    setBalancesLoading(true);
    apiClient.get('materials/balances/').then((res) => {
      setBalances(res.data?.items || []);
    }).catch(() => setBalances([])).finally(() => setBalancesLoading(false));
  }, []);

  useEffect(() => {
    refetchBalances();
  }, [refetchBalances]);

  const incomingQuery = useMemo(() => ({
    page: 1,
    page_size: 500,
    ordering: '-received_at',
  }), []);

  const {
    items: incomingList,
    loading: incomingLoading,
    error: incomingError,
    refetch: refetchIncoming,
  } = useServerQuery('incoming/', incomingQuery, { enabled: mainTab === MAIN_TAB.BATCHES });

  const movementsFetcher = useCallback(async (q, signal) => {
    const params = { ...q };
    Object.keys(params).forEach((k) => {
      if (k.startsWith('_')) delete params[k];
    });
    try {
      const res = await apiClient.get('materials/movements/', { params, signal });
      return res.data;
    } catch (e) {
      if (e.response?.status === 404) return { items: [] };
      throw e;
    }
  }, []);

  const movementsQuery = useMemo(() => ({
    page: 1,
    page_size: 500,
    ordering: '-occurred_at',
  }), []);

  const {
    items: movementList,
    loading: movementsLoading,
    error: movementsError,
    refetch: refetchMovements,
  } = useServerQuery(
    'materials/movements/',
    movementsQuery,
    { enabled: mainTab === MAIN_TAB.MOVEMENTS, fetcher: movementsFetcher },
  );

  const refetchAll = useCallback(() => {
    refetchBalances();
    refetchIncoming();
    refetchMovements();
  }, [refetchBalances, refetchIncoming, refetchMovements]);

  useOperationalRefetch(
    ['raw_material', 'incoming', 'material_balance', 'material_writeoff', 'material_movement'],
    refetchAll,
    true,
  );

  const balancesFiltered = useMemo(() => {
    let list = balances;
    const q = balancesSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => normName(b.material_name || b.name).includes(q));
    }
    if (balanceFilter === BALANCE_FILTER.LOW) {
      list = list.filter(isLowStock);
    } else if (balanceFilter === BALANCE_FILTER.OK) {
      list = list.filter((b) => !isLowStock(b));
    }
    return list;
  }, [balances, balancesSearch, balanceFilter]);

  const handleCreateCatalogSubmit = async (data) => {
    setSubmitError('');
    try {
      await createRawMaterial(data);
      setCatalogModal(null);
      refetchAll();
      toast.show('Сырьё добавлено в справочник');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleEditSubmit = async (id, data) => {
    setSubmitError('');
    try {
      await updateRawMaterial(id, data);
      setEditModal(null);
      refetchAll();
      toast.show('Сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleReplenishSubmit = async (data) => {
    setSubmitError('');
    try {
      await createIncoming(data);
      setReplenishModal(null);
      refetchAll();
      toast.show('Приход оформлен');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setSubmitError('');
    const id = getMaterialId(deactivateTarget);
    const name = displayName(deactivateTarget);
    if (id == null) return;
    try {
      await updateRawMaterial(id, { is_active: false });
      setDeactivateTarget(null);
      refetchAll();
      toast.show(`«${name}» деактивировано`);
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    const { id, name } = deleteTarget;
    try {
      await deleteRawMaterial(id);
      toast.show(`Сырьё «${name}» удалено`);
      setDeleteTarget(null);
      refetchAll();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

  const displayName = (b) => b.name || b.material_name || '—';

  const lowStockCount = useMemo(() => balances.filter(isLowStock).length, [balances]);

  const openIncomingForRow = (b) => {
    const mid = getMaterialId(b);
    if (mid == null) return;
    setReplenishModal({
      material_id: mid,
      name: displayName(b),
      unit: b.unit || 'kg',
    });
  };

  return (
    <div className="page page--materials">
      <h1 className="page__title">Склад сырья</h1>

      <div className="materials-tabs" role="tablist" aria-label="Разделы склада сырья">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.CATALOG}
          className={`materials-tabs__tab${mainTab === MAIN_TAB.CATALOG ? ' materials-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.CATALOG)}
        >
          Справочник
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.STOCK}
          className={`materials-tabs__tab${mainTab === MAIN_TAB.STOCK ? ' materials-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.STOCK)}
        >
          Остатки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.BATCHES}
          className={`materials-tabs__tab${mainTab === MAIN_TAB.BATCHES ? ' materials-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.BATCHES)}
        >
          Партии
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === MAIN_TAB.MOVEMENTS}
          className={`materials-tabs__tab${mainTab === MAIN_TAB.MOVEMENTS ? ' materials-tabs__tab--active' : ''}`}
          onClick={() => setMainTab(MAIN_TAB.MOVEMENTS)}
        >
          История движения
        </button>
      </div>

      <div className="materials-card">
        <div className="materials-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start materials-card__head-main">
            {mainTab === MAIN_TAB.CATALOG && (
              <>
                <Select
                  className="materials-card__filter"
                  value={balanceFilter}
                  onChange={setBalanceFilter}
                  aria-label="Остаток"
                  options={[
                    { value: BALANCE_FILTER.ALL, label: 'Все' },
                    { value: BALANCE_FILTER.LOW, label: 'Ниже минимума' },
                    { value: BALANCE_FILTER.OK, label: 'Норма' },
                  ]}
                />
                <input
                  type="text"
                  className="materials-card__search"
                  placeholder="Поиск"
                  value={balancesSearch}
                  onChange={(e) => setBalancesSearch(e.target.value)}
                />
                {lowStockCount > 0 && (
                  <span className="materials-card__alert-pill" role="status">
                    Ниже минимума: {lowStockCount}
                  </span>
                )}
              </>
            )}
          </div>
          <div className="ds-toolbar__end materials-card__toolbar-actions">
            <button type="button" className="btn btn--primary" onClick={() => setCatalogModal(true)}>
              Добавить сырьё
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setReplenishModal({ pickMaterial: true })}
            >
              Оформить приход
            </button>
          </div>
        </div>

        {mainTab === MAIN_TAB.CATALOG && (
          <>
            {balancesLoading && <Loading />}
            {!balancesLoading && (
              balancesFiltered.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="materials-table-wrap">
                  <div className="materials-table materials-table--catalog">
                    <div className="materials-table__header">
                      <span className="materials-table__th">Название</span>
                      <span className="materials-table__th">Единица</span>
                      <span className="materials-table__th">Текущий остаток</span>
                      <span className="materials-table__th materials-table__th--min">Минимальный остаток</span>
                      <span className="materials-table__th">Статус</span>
                      <span className="materials-table__th">Комментарий</span>
                      <span className="materials-table__th materials-table__th--actions">Действия</span>
                    </div>
                    {balancesFiltered.map((b, idx) => {
                      const low = isLowStock(b);
                      const mid = getMaterialId(b);
                      const active = b.is_active !== false;
                      return (
                        <div
                          key={mid != null ? String(mid) : `row-${idx}-${displayName(b)}`}
                          className={`materials-table__row ${low ? 'materials-table__row--low-stock' : ''}`}
                        >
                          <span className="materials-table__name">{displayName(b)}</span>
                          <span className="materials-table__unit">{unitLabelRu(b.unit)}</span>
                          <span className={`materials-table__balance${low ? ' materials-table__balance--low' : ''}`}>
                            {formatQuantityDisplay(b.balance)} {unitLabelRu(b.unit)}
                          </span>
                          <span className="materials-table__min">
                            {minBalanceValue(b) != null && minBalanceValue(b) !== ''
                              ? `${formatQuantityDisplay(minBalanceValue(b))} ${unitLabelRu(b.unit)}`
                              : '—'}
                          </span>
                          <span className="materials-table__card-status">
                            {active ? 'активен' : 'неактивен'}
                          </span>
                          <span className="materials-table__comment" title={getComment(b)}>
                            {getComment(b) ? getComment(b) : '—'}
                          </span>
                          <div className="materials-table__actions">
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              disabled={mid == null}
                              onClick={() => openIncomingForRow(b)}
                            >
                              Оформить приход
                            </button>
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              onClick={() => setEditModal(b)}
                              disabled={mid == null}
                            >
                              Редактировать
                            </button>
                            {active && (
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                disabled={mid == null}
                                onClick={() => setDeactivateTarget(b)}
                              >
                                Деактивировать
                              </button>
                            )}
                            {canDeleteMaterial(b) && (
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() => mid != null && setDeleteTarget({ id: mid, name: displayName(b) })}
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}

        {mainTab === MAIN_TAB.STOCK && (
          <>
            {balancesLoading && <Loading />}
            {!balancesLoading && (
              balances.length === 0 ? (
                <EmptyState title="Нет данных" />
              ) : (
                <div className="materials-table-wrap">
                  <div className="materials-table materials-table--stock-view">
                    <div className="materials-table__header">
                      <span className="materials-table__th">Сырьё</span>
                      <span className="materials-table__th">Общий остаток</span>
                      <span className="materials-table__th">Единица</span>
                      <span className="materials-table__th materials-table__th--min">Минимальный остаток</span>
                      <span className="materials-table__th">Статус</span>
                    </div>
                    {balances.map((b, idx) => {
                      const sk = getStockLevelKey(b);
                      const low = sk === 'low';
                      const mid = getMaterialId(b);
                      return (
                        <div
                          key={mid != null ? String(mid) : `st-${idx}`}
                          className={`materials-table__row ${low || sk === 'empty' ? 'materials-table__row--low-stock' : ''}`}
                        >
                          <span className="materials-table__name">{displayName(b)}</span>
                          <span className={`materials-table__balance${low || sk === 'empty' ? ' materials-table__balance--low' : ''}`}>
                            {formatQuantityDisplay(b.balance)}
                          </span>
                          <span className="materials-table__unit">{unitLabelRu(b.unit)}</span>
                          <span className="materials-table__min">
                            {minBalanceValue(b) != null && minBalanceValue(b) !== ''
                              ? `${formatQuantityDisplay(minBalanceValue(b))} ${unitLabelRu(b.unit)}`
                              : '—'}
                          </span>
                          <span className={`materials-table__stock-status materials-table__stock-status--${sk}`}>
                            {STOCK_LEVEL_LABEL[sk]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}

        {mainTab === MAIN_TAB.BATCHES && (
          <>
            {incomingLoading && <Loading />}
            {incomingError && <ErrorState error={incomingError} onRetry={refetchIncoming} />}
            {!incomingLoading && !incomingError && (
              incomingList.length === 0 ? (
                <EmptyState title="Нет партий" />
              ) : (
                <div className="materials-table-wrap">
                  <div className="materials-table materials-table--batches-full">
                    <div className="materials-table__header">
                      <span className="materials-table__th">Дата</span>
                      <span className="materials-table__th">Сырьё</span>
                      <span className="materials-table__th">Пришло</span>
                      <span className="materials-table__th">Осталось</span>
                      <span className="materials-table__th">Цена за ед.</span>
                      <span className="materials-table__th">Сумма</span>
                      <span className="materials-table__th">Поставщик</span>
                      <span className="materials-table__th">Документ</span>
                      <span className="materials-table__th">Комментарий</span>
                    </div>
                    {incomingList.map((i) => {
                      const at = i.received_at || i.created_at || i.date;
                      const qIn = i.quantity_initial ?? i.quantity;
                      const qRem = i.quantity_remaining ?? i.quantity_remaining_kg;
                      const up = i.unit_price ?? i.price_per_unit;
                      const tot = i.total_price ?? i.total;
                      const uDisp = unitLabelRu(i.unit);
                      const doc = i.document_number ?? i.doc_number ?? i.supplier_batch_number ?? i.supplier_batch;
                      return (
                        <div key={i.id} className="materials-table__row">
                          <span className="materials-table__date" title={at && String(at).length > 12 ? String(at) : undefined}>
                            {typeof at === 'string' && at.length >= 16 ? at.slice(0, 16).replace('T', ' ') : formatDate(at)}
                          </span>
                          <span>{i.material_name ?? i.name ?? '—'}</span>
                          <span>{formatQuantityDisplay(qIn)} {uDisp}</span>
                          <span>{qRem != null && qRem !== '' ? `${formatQuantityDisplay(qRem)} ${uDisp}` : '—'}</span>
                          <span>{up != null && up !== '' ? `${formatQuantityDisplay(up)} сом` : '—'}</span>
                          <span>{tot != null && tot !== '' ? `${formatQuantityDisplay(tot)} сом` : '—'}</span>
                          <span>{i.supplier_name ?? i.supplier ?? '—'}</span>
                          <span>{doc ?? '—'}</span>
                          <span className="materials-table__comment">{i.comment ?? '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}

        {mainTab === MAIN_TAB.MOVEMENTS && (
          <>
            {movementsLoading && <Loading />}
            {movementsError && movementsError.status !== 404 && (
              <ErrorState error={movementsError} onRetry={refetchMovements} />
            )}
            {!movementsLoading && (!movementsError || movementsError.status === 404) && (
              movementList.length === 0 ? (
                <EmptyState title="Нет записей движения" description="Подключите GET materials/movements/ на бэкенде." />
              ) : (
                <div className="materials-table-wrap">
                  <div className="materials-table materials-table--movements">
                    <div className="materials-table__header">
                      <span className="materials-table__th">Дата</span>
                      <span className="materials-table__th">Сырьё</span>
                      <span className="materials-table__th">Тип</span>
                      <span className="materials-table__th">Количество</span>
                      <span className="materials-table__th">Ед.</span>
                      <span className="materials-table__th">Комментарий</span>
                    </div>
                    {movementList.map((m) => {
                      const at = m.occurred_at ?? m.created_at ?? m.date;
                      return (
                        <div key={m.id} className="materials-table__row">
                          <span className="materials-table__date">
                            {typeof at === 'string' && at.length >= 16 ? at.slice(0, 16).replace('T', ' ') : formatDate(at)}
                          </span>
                          <span>{m.material_name ?? m.name ?? '—'}</span>
                          <span>{m.movement_type ?? m.type ?? '—'}</span>
                          <span>{formatQuantityDisplay(m.quantity)}</span>
                          <span>{unitLabelRu(m.unit)}</span>
                          <span className="materials-table__comment">{m.comment ?? '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {catalogModal && (
        <AddCatalogMaterialModal
          units={UNITS}
          onSubmit={handleCreateCatalogSubmit}
          onClose={() => { setCatalogModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {editModal && getMaterialId(editModal) != null && (
        <EditMaterialModal
          materialId={getMaterialId(editModal)}
          unitLocked={isUnitLocked(editModal)}
          initial={{
            name: displayName(editModal),
            unit: (() => {
              const u = String(editModal.unit || 'kg').toLowerCase();
              if (u === 'g' || u === 'г') return 'g';
              return 'kg';
            })(),
            min_balance: minBalanceValue(editModal) ?? '',
            is_active: editModal.is_active !== false,
            comment: getComment(editModal),
          }}
          onSubmit={handleEditSubmit}
          onClose={() => { setEditModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {replenishModal && (
        <ReplenishModal
          material={replenishModal}
          onSubmit={handleReplenishSubmit}
          onClose={() => { setReplenishModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={
          deleteTarget
            ? `Удалить сырьё «${deleteTarget.name}»? Доступно только если не было приходов, партий, движений и использования в химии/рецептах.`
            : ''
        }
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!deactivateTarget}
        title="Деактивировать?"
        message={
          deactivateTarget
            ? `Снять с учёта «${displayName(deactivateTarget)}»? Остатки и история сохраняются.`
            : ''
        }
        confirmText="Деактивировать"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
};

const AddCatalogMaterialModal = ({ units, onSubmit, onClose, error }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [minBalance, setMinBalance] = useState('');
  const [comment, setComment] = useState('');
  const [statusActive, setStatusActive] = useState(true);

  const isDirty = useDirtyFromBaseline('add-catalog-material', false, {
    name: name.trim(),
    unit,
    minBalance: String(minBalance ?? '').trim(),
    comment: comment.trim(),
    statusActive,
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Добавить сырьё</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const minB = minBalance === '' ? undefined : parseLocaleNumber(minBalance);
            if (minBalance !== '' && (!Number.isFinite(minB) || minB < 0)) return;
            onSubmit({
              name: name.trim(),
              unit,
              is_active: statusActive,
              ...(minB !== undefined ? { min_balance: minB } : {}),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
            });
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Название сырья" />
          <label>Единица измерения *</label>
          <Select
            value={unit}
            onChange={setUnit}
            options={units.map((u) => ({ value: u.value, label: u.label }))}
          />
          <label>Минимальный остаток</label>
          <DecimalInput min={0} value={minBalance} onChange={setMinBalance} placeholder="Порог «мало»" />
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опционально" />
          <label>Статус *</label>
          <Select
            value={statusActive ? 'active' : 'inactive'}
            onChange={(v) => setStatusActive(v === 'active')}
            options={[
              { value: 'active', label: 'активен' },
              { value: 'inactive', label: 'неактивен' },
            ]}
          />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Сохранить</button>
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditMaterialModal = ({ materialId, initial, unitLocked, onSubmit, onClose, error }) => {
  const [name, setName] = useState(initial.name);
  const [unit, setUnit] = useState(initial.unit);
  const [minBalance, setMinBalance] = useState(
    initial.min_balance === null || initial.min_balance === undefined || initial.min_balance === ''
      ? ''
      : formatNumberForInput(initial.min_balance),
  );
  const [isActive, setIsActive] = useState(initial.is_active !== false);
  const [comment, setComment] = useState(initial.comment || '');

  const isDirty = useDirtyFromBaseline(String(materialId), false, {
    name: name.trim(),
    unit,
    minBalance: String(minBalance ?? '').trim(),
    isActive,
    comment: comment.trim(),
  });
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Редактировать сырьё</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const minB = minBalance === '' ? null : parseLocaleNumber(minBalance);
            if (minBalance !== '' && (!Number.isFinite(minB) || minB < 0)) return;
            const payload = {
              name: name.trim(),
              is_active: isActive,
              ...(minB === null ? { min_balance: null } : { min_balance: minB }),
              ...(comment.trim() ? { comment: comment.trim() } : { comment: '' }),
            };
            if (!unitLocked) payload.unit = unit;
            onSubmit(materialId, payload);
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Единица измерения *</label>
          <Select
            value={unit}
            onChange={setUnit}
            options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
            disabled={unitLocked}
            title={unitLocked ? 'Единица заблокирована после приходов' : undefined}
          />
          <label>Статус *</label>
          <Select
            value={isActive ? 'active' : 'inactive'}
            onChange={(v) => setIsActive(v === 'active')}
            options={[
              { value: 'active', label: 'активен' },
              { value: 'inactive', label: 'неактивен' },
            ]}
          />
          <label>Минимальный остаток</label>
          <DecimalInput min={0} value={minBalance} onChange={setMinBalance} placeholder="Порог «мало»" />
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опционально" />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Сохранить</button>
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const defaultReceivedAtLocal = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const ReplenishModal = ({ material, onSubmit, onClose, error }) => {
  const pickMode = Boolean(material?.pickMaterial);
  const [pickList, setPickList] = useState([]);
  const [pickLoading, setPickLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [receivedAt, setReceivedAt] = useState(defaultReceivedAtLocal);
  const [supplierName, setSupplierName] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [comment, setComment] = useState('');

  const fixedId = material.material_id;
  const selectedRm = useMemo(
    () => pickList.find((r) => String(r.id) === String(selectedId)),
    [pickList, selectedId],
  );

  const resolvedMaterial = pickMode && selectedRm
    ? {
      material_id: selectedRm.id,
      name: selectedRm.name,
      unit: selectedRm.unit || 'kg',
    }
    : pickMode
      ? null
      : {
        material_id: fixedId,
        name: material.name || material.material_name || '',
        unit: material.unit || 'kg',
      };

  useEffect(() => {
    if (!pickMode) return;
    setPickLoading(true);
    apiClient.get('raw-materials/', { params: { page_size: 500 } }).then((res) => {
      setPickList(res.data?.items || []);
    }).catch(() => setPickList([])).finally(() => setPickLoading(false));
  }, [pickMode]);

  const mname = resolvedMaterial?.name || '';
  const unitHint = unitLabelRu(resolvedMaterial?.unit);

  const qtyNum = parseLocaleNumber(quantity);
  const priceNum = parseLocaleNumber(pricePerUnit);
  const batchSum = (Number.isFinite(qtyNum) && Number.isFinite(priceNum)) ? qtyNum * priceNum : null;

  const isDirty = useDirtyFromBaseline(
    pickMode ? `pick-${selectedId}` : String(fixedId ?? 'replenish'),
    false,
    {
      selectedId,
      quantity: String(quantity ?? '').trim(),
      pricePerUnit: String(pricePerUnit ?? '').trim(),
      receivedAt,
      supplierName: supplierName.trim(),
      documentNumber: documentNumber.trim(),
      comment: comment.trim(),
    },
  );
  const {
    requestClose,
    discardConfirmOpen,
    confirmDiscardAndClose,
    cancelDiscard,
  } = useDiscardOnClose(onClose, isDirty);

  return (
    <div className="modal-overlay" onClick={requestClose}>
      <ConfirmModal
        open={discardConfirmOpen}
        title="Закрыть без сохранения?"
        message="Введённые данные не будут сохранены."
        confirmText="Закрыть"
        onConfirm={confirmDiscardAndClose}
        onCancel={cancelDiscard}
      />
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Приход сырья{!pickMode && mname ? `: ${mname}` : ''}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!resolvedMaterial?.material_id) return;
            const qty = parseLocaleNumber(quantity);
            const price = parseLocaleNumber(pricePerUnit);
            if (!(qty > 0) || price < 0 || Number.isNaN(price)) return;
            if (!receivedAt) return;
            const received_at = new Date(receivedAt).toISOString();
            onSubmit({
              material_id: resolvedMaterial.material_id,
              quantity: qty,
              unit_price: price,
              received_at,
              ...(supplierName.trim() ? { supplier_name: supplierName.trim() } : {}),
              ...(documentNumber.trim() ? { document_number: documentNumber.trim() } : {}),
              ...(comment.trim() ? { comment: comment.trim() } : {}),
            });
          }}
        >
          {pickMode && (
            <>
              <label>Сырьё *</label>
              {pickLoading ? <Loading /> : (
                <Select
                  value={selectedId}
                  onChange={setSelectedId}
                  options={[
                    { value: '', label: '— выберите —' },
                    ...pickList.map((r) => ({ value: String(r.id), label: r.name })),
                  ]}
                />
              )}
            </>
          )}
          {!pickMode && <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>{mname}</p>}
          <label>Количество *</label>
          <DecimalInput min={0} value={quantity} onChange={setQuantity} required placeholder="Напр. 10 или 0,5" />
          <label>Единица</label>
          <input readOnly value={unitHint} className="materials-input-readonly" />
          <label>Цена за единицу (сом) *</label>
          <DecimalInput min={0} value={pricePerUnit} onChange={setPricePerUnit} required />
          {batchSum != null && Number.isFinite(batchSum) && (
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>{formatQuantityDisplay(batchSum)} сом</p>
          )}
          <label>Дата прихода *</label>
          <input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            required
          />
          <label>Поставщик</label>
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Опционально" />
          <label>Номер документа</label>
          <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Опционально" />
          <label>Комментарий</label>
          <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Опционально" />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button
              type="submit"
              className="btn btn--primary"
              disabled={resolvedMaterial?.material_id == null}
            >
              Оформить приход
            </button>
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialsPage;
