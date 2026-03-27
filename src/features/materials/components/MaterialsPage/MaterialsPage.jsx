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
  deleteIncoming,
  deleteRawMaterial,
  updateRawMaterial,
} from '../../api/materialsApi';
import { apiClient } from '../../../../shared/api';
import { useOperationalRefetch } from '../../../../shared/realtime';
import './MaterialsPage.scss';

const UNITS = [
  { value: 'кг', label: 'кг' },
  { value: 'л', label: 'л' },
  { value: 'г', label: 'г' },
  { value: 'мл', label: 'мл' },
];

const BALANCE_FILTER = {
  ALL: 'all',
  LOW: 'low',
  OK: 'ok',
};

const normName = (s) => String(s ?? '').trim().toLowerCase();

const getMaterialId = (b) => b?.id ?? b?.material_id ?? b?.raw_material_id;

const isLowStock = (b) => {
  const min = b?.min_balance;
  if (min === null || min === undefined || min === '') return false;
  const minN = Number(min);
  if (Number.isNaN(minN)) return false;
  return Number(b.balance) <= minN;
};

const MaterialsPage = () => {
  const toast = useToast();
  const [incomingModal, setIncomingModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [historyModal, setHistoryModal] = useState(null);
  const [replenishModal, setReplenishModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesSearch, setBalancesSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState(BALANCE_FILTER.ALL);

  useEffect(() => {
    setBalancesLoading(true);
    apiClient.get('materials/balances/').then((res) => {
      setBalances(res.data?.items || []);
    }).catch(() => setBalances([])).finally(() => setBalancesLoading(false));
  }, []);

  const refetchBalances = useCallback(() => {
    setBalancesLoading(true);
    apiClient.get('materials/balances/').then((res) => {
      setBalances(res.data?.items || []);
    }).catch(() => setBalances([])).finally(() => setBalancesLoading(false));
  }, []);

  useOperationalRefetch(
    ['raw_material', 'incoming', 'material_balance', 'material_writeoff'],
    refetchBalances,
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

  const handleIncomingSubmit = async (data) => {
    setSubmitError('');
    try {
      await createIncoming(data);
      setIncomingModal(null);
      refetchBalances();
      toast.show('Успешно добавлено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleEditSubmit = async (id, data) => {
    setSubmitError('');
    try {
      await updateRawMaterial(id, data);
      setEditModal(null);
      refetchBalances();
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
      refetchBalances();
      setHistoryRefreshKey((k) => k + 1);
      toast.show('Успешно пополнено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    const { mode, id, name } = deleteTarget;
    try {
      if (mode === 'raw') {
        await deleteRawMaterial(id);
        setHistoryModal((h) => (h && getMaterialId(h) === id ? null : h));
        toast.show(`Сырьё «${name}» удалено`);
      } else {
        await deleteIncoming(id);
        setHistoryRefreshKey((k) => k + 1);
        toast.show('Успешно удалено');
      }
      setDeleteTarget(null);
      refetchBalances();
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

  const openHistory = (b) => setHistoryModal(b);

  const rowClick = (e, b) => {
    if (e.target.closest('button') || e.target.closest('.materials-table__actions')) return;
    openHistory(b);
  };

  const displayName = (b) => b.name || b.material_name || '—';

  const lowStockCount = useMemo(() => balances.filter(isLowStock).length, [balances]);

  return (
    <div className="page page--materials">
      <div className="materials-card">
        <div className="materials-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start materials-card__head-main">
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
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => setIncomingModal(true)}>
              Добавить
            </button>
          </div>
        </div>
        {balancesLoading && <Loading />}
        {!balancesLoading && (
          balancesFiltered.length === 0 ? (
            <EmptyState title="Нет данных" />
          ) : (
            <div className="materials-table-wrap">
            <div className="materials-table materials-table--balances">
              <div className="materials-table__header">
                <span className="materials-table__th">Название</span>
                <span className="materials-table__th">Остаток</span>
                <span className="materials-table__th materials-table__th--min">Мин.</span>
                <span className="materials-table__th materials-table__th--actions">Действия</span>
              </div>
              {balancesFiltered.map((b, idx) => {
                const low = isLowStock(b);
                const mid = getMaterialId(b);
                return (
                  <div
                    key={mid != null ? String(mid) : `row-${idx}-${displayName(b)}`}
                    className={`materials-table__row materials-table__row--clickable ${low ? 'materials-table__row--low-stock' : ''}`}
                    onClick={(e) => rowClick(e, b)}
                    onKeyDown={(e) => e.key === 'Enter' && openHistory(b)}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="materials-table__name">{displayName(b)}</span>
                    <span className={`materials-table__balance${low ? ' materials-table__balance--low' : ''}`}>
                      {formatQuantityDisplay(b.balance)} {b.unit || 'кг'}
                    </span>
                    <span className="materials-table__min">
                      {b.min_balance != null && b.min_balance !== ''
                        ? `${formatQuantityDisplay(b.min_balance)} ${b.unit || 'кг'}`
                        : '—'}
                    </span>
                    <div className="materials-table__actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setReplenishModal({
                          ...(mid != null ? { material_id: mid } : {}),
                          name: displayName(b),
                          unit: b.unit || 'кг',
                          supplier: b.supplier,
                        })}
                      >
                        Пополнить
                      </button>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => setEditModal(b)}
                        disabled={mid == null}
                        title={mid == null ? 'Нет ID сырья — обновите бэкенд' : undefined}
                      >
                        Изменить
                      </button>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => mid != null && setDeleteTarget({ mode: 'raw', id: mid, name: displayName(b) })}
                        disabled={mid == null}
                        title={mid == null ? 'Нет ID сырья — обновите бэкенд' : undefined}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )
        )}
      </div>

      {incomingModal && (
        <AddMaterialModal
          units={UNITS}
          onSubmit={handleIncomingSubmit}
          onClose={() => { setIncomingModal(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      {editModal && getMaterialId(editModal) != null && (
        <EditMaterialModal
          materialId={getMaterialId(editModal)}
          initial={{
            name: displayName(editModal),
            unit: editModal.unit || 'кг',
            min_balance: editModal.min_balance ?? '',
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

      {historyModal && (
        <HistoryModal
          balance={historyModal}
          refreshKey={historyRefreshKey}
          onClose={() => setHistoryModal(null)}
          formatDate={formatDate}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={
          deleteTarget
            ? (deleteTarget.mode === 'raw'
              ? `Удалить сырьё «${deleteTarget.name}»? Остатки и история поступлений будут затронуты.`
              : `Удалить запись «${deleteTarget.name}»?`)
            : ''
        }
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const HistoryModal = ({ balance, refreshKey, onClose, formatDate }) => {
  const materialName = balance?.name || balance?.material_name || '';
  const materialId = getMaterialId(balance);

  const query = useMemo(() => ({
    page: 1,
    page_size: 500,
    ...(materialId != null ? { material_id: materialId } : { search: materialName }),
    _refresh: refreshKey,
  }), [materialId, materialName, refreshKey]);

  const canFetchHistory = materialId != null || normName(materialName).length > 0;

  const { items: historyList, loading, error, refetch } = useServerQuery(
    'incoming/',
    query,
    { enabled: canFetchHistory }
  );

  const filteredHistory = useMemo(() => {
    const target = normName(materialName);
    return historyList.filter((i) => {
      if (materialId != null) return Number(i.material_id) === Number(materialId);
      return normName(i.name) === target;
    });
  }, [historyList, materialName, materialId]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>История пополнений: {materialName}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <div className="modal__body" style={{ padding: '1rem' }}>
          <p className="materials-history__hint">Здесь только приходы (пополнения). Списания отображаются в производственных операциях.</p>
          {loading && <Loading />}
          {error && <ErrorState error={error} onRetry={refetch} />}
          {!loading && !error && (
            filteredHistory.length === 0 ? (
              <EmptyState title="Нет записей" />
            ) : (
              <div className="materials-table materials-table--history">
                <div className="materials-table__header">
                  <span className="materials-table__th">Дата</span>
                  <span className="materials-table__th">Количество</span>
                  <span className="materials-table__th">Цена</span>
                  <span className="materials-table__th">Поставщик</span>
                </div>
                {filteredHistory.map((i) => (
                  <div key={i.id} className="materials-table__row">
                    <span className="materials-table__date">{formatDate(i.date)}</span>
                    <span>{formatQuantityDisplay(i.quantity)} {i.unit || 'кг'}</span>
                    <span>{i.price_per_unit != null && i.price_per_unit !== '' ? `${formatQuantityDisplay(i.price_per_unit)} сом` : '—'}</span>
                    <span>{i.supplier || '—'}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};

const AddMaterialModal = ({ units, onSubmit, onClose, error }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('кг');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [minBalance, setMinBalance] = useState('');

  const isDirty = useDirtyFromBaseline('add-material', false, {
    name: name.trim(),
    unit,
    quantity: String(quantity ?? '').trim(),
    pricePerUnit: String(pricePerUnit ?? '').trim(),
    supplier: supplier.trim(),
    minBalance: String(minBalance ?? '').trim(),
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
          <h3>Добавить Сырьё</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const qty = parseLocaleNumber(quantity);
            const price = parseLocaleNumber(pricePerUnit);
            if (!(qty > 0) || price < 0 || Number.isNaN(price)) return;
            const minB = minBalance === '' ? undefined : parseLocaleNumber(minBalance);
            if (minBalance !== '' && (!Number.isFinite(minB) || minB < 0)) return;
            onSubmit({
              name,
              unit,
              quantity: qty,
              price_per_unit: price,
              supplier: supplier || undefined,
              date: new Date().toISOString().slice(0, 10),
              ...(minB !== undefined ? { min_balance: minB } : {}),
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
          <label>Количество *</label>
          <DecimalInput min={0} value={quantity} onChange={setQuantity} required placeholder="Напр. 10 или 0,5" />
          <label>Мин. остаток</label>
          <DecimalInput min={0} value={minBalance} onChange={setMinBalance} placeholder="Порог предупреждения" />
          <label>Цена за единицу (сом) *</label>
          <DecimalInput min={0} value={pricePerUnit} onChange={setPricePerUnit} required placeholder="0 или 12,5" />
          <label>Поставщик</label>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Название поставщика" />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Добавить</button>
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EditMaterialModal = ({ materialId, initial, onSubmit, onClose, error }) => {
  const [name, setName] = useState(initial.name);
  const [unit, setUnit] = useState(initial.unit);
  const [minBalance, setMinBalance] = useState(
    initial.min_balance === null || initial.min_balance === undefined
      ? ''
      : formatNumberForInput(initial.min_balance),
  );

  const isDirty = useDirtyFromBaseline(String(materialId), false, {
    name: name.trim(),
    unit,
    minBalance: String(minBalance ?? '').trim(),
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
          <h3>Изменить сырьё</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const minB = minBalance === '' ? null : parseLocaleNumber(minBalance);
            if (minBalance !== '' && (!Number.isFinite(minB) || minB < 0)) return;
            onSubmit(materialId, {
              name: name.trim(),
              unit,
              ...(minB === null ? { min_balance: null } : { min_balance: minB }),
            });
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>Единица измерения *</label>
          <Select
            value={unit}
            onChange={setUnit}
            options={UNITS.map((u) => ({ value: u.value, label: u.label }))}
          />
          <label>Мин. остаток</label>
          <DecimalInput min={0} value={minBalance} onChange={setMinBalance} placeholder="Порог предупреждения" />
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

const ReplenishModal = ({ material, onSubmit, onClose, error }) => {
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const mname = material.name || material.material_name || '';

  const isDirty = useDirtyFromBaseline(
    material.material_id != null ? String(material.material_id) : `name:${mname}`,
    false,
    {
      quantity: String(quantity ?? '').trim(),
      pricePerUnit: String(pricePerUnit ?? '').trim(),
      date,
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
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Пополнить: {mname}</h3>
          <button type="button" className="modal__close" onClick={requestClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const qty = parseLocaleNumber(quantity);
            const price = parseLocaleNumber(pricePerUnit);
            if (!(qty > 0) || price < 0 || Number.isNaN(price)) return;
            const base = {
              quantity: qty,
              price_per_unit: price,
              supplier: material.supplier,
              date,
            };
            if (material.material_id != null) {
              onSubmit({
                material_id: material.material_id,
                ...base,
              });
            } else {
              onSubmit({
                name: mname,
                unit: material.unit,
                ...base,
              });
            }
          }}
        >
          <label>Количество *</label>
          <DecimalInput min={0} value={quantity} onChange={setQuantity} required placeholder="Напр. 10 или 0,5" />
          <label>Цена за единицу (сом) *</label>
          <DecimalInput min={0} value={pricePerUnit} onChange={setPricePerUnit} required />
          <label>Дата *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Пополнить</button>
            <button type="button" className="btn btn--secondary" onClick={requestClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialsPage;
