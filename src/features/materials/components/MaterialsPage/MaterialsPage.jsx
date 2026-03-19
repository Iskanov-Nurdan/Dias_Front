import React, { useState, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast } from '../../../../shared/ui';
import {
  createIncoming,
  deleteIncoming,
} from '../../api/materialsApi';
import { apiClient } from '../../../../shared/api';
import './MaterialsPage.scss';

const UNITS = [
  { value: 'кг', label: 'КГ' },
  { value: 'л', label: 'Л' },
  { value: 'г', label: 'Г' },
  { value: 'мл', label: 'МЛ' },
];

const MaterialsPage = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('incoming');
  const [incomingQuery, setIncomingQuery] = useState({ page: 1, page_size: 20, search: '' });
  const [incomingModal, setIncomingModal] = useState(null);
  const [replenishModal, setReplenishModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');

  const { items: incomingList, loading: incLoading, error: incError, refetch: refetchIncoming } = useServerQuery(
    'incoming/',
    activeTab === 'incoming' ? incomingQuery : { page_size: 1 },
    { enabled: activeTab === 'incoming' }
  );

  const [balances, setBalances] = useState([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [balancesSearch, setBalancesSearch] = useState('');

  useEffect(() => {
    if (activeTab !== 'balances') return;
    setBalancesLoading(true);
    apiClient.get('materials/balances/').then((res) => {
      setBalances(res.data?.items || []);
    }).catch(() => setBalances([])).finally(() => setBalancesLoading(false));
  }, [activeTab]);

  const balancesFiltered = balancesSearch.trim()
    ? balances.filter((b) => (b.material_name || '').toLowerCase().includes(balancesSearch.trim().toLowerCase()))
    : balances;

  const handleIncomingSubmit = async (data) => {
    setSubmitError('');
    try {
      await createIncoming(data);
      setIncomingModal(null);
      refetchIncoming();
      toast.show('Успешно добавлено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleReplenishSubmit = async (data) => {
    setSubmitError('');
    try {
      await createIncoming(data);
      setReplenishModal(null);
      refetchIncoming();
      toast.show('Успешно пополнено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await deleteIncoming(deleteTarget.id);
      setDeleteTarget(null);
      refetchIncoming();
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

  return (
    <div className="page page--materials">
      <div className="materials-tabs">
        <button
          type="button"
          className={`materials-tabs__tab ${activeTab === 'incoming' ? 'materials-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('incoming')}
        >
          Товары
        </button>
        <button
          type="button"
          className={`materials-tabs__tab ${activeTab === 'balances' ? 'materials-tabs__tab--active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Остатки
        </button>
      </div>

      {activeTab === 'incoming' && (
        <div className="materials-card">
          <div className="materials-card__head">
            <h2 className="materials-card__title">Товары</h2>
            <div className="materials-card__actions">
              <input
                type="text"
                className="materials-card__search"
                placeholder="Поиск..."
                value={incomingQuery.search || ''}
                onChange={(e) => setIncomingQuery((p) => ({ ...p, search: e.target.value, page: 1 }))}
              />
              <button type="button" className="btn btn--primary" onClick={() => setIncomingModal(true)}>
                Добавить товар
              </button>
            </div>
          </div>
          {incLoading && <Loading />}
          {incError && <ErrorState error={incError} onRetry={refetchIncoming} />}
          {!incLoading && !incError && (
            incomingList.length === 0 ? (
              <EmptyState title="Нет данных" />
            ) : (
              <div className="materials-table materials-table--incoming">
                <div className="materials-table__header">
                  <span className="materials-table__th">ДАТА</span>
                  <span className="materials-table__th">НАЗВАНИЕ</span>
                  <span className="materials-table__th">КОЛИЧЕСТВО</span>
                  <span className="materials-table__th">ЦЕНА</span>
                  <span className="materials-table__th">ПОСТАВЩИК</span>
                  <span className="materials-table__th materials-table__th--actions">ДЕЙСТВИЯ</span>
                </div>
                {incomingList.map((i) => (
                  <div key={i.id} className="materials-table__row">
                    <span className="materials-table__date">{formatDate(i.date)}</span>
                    <span className="materials-table__name">{i.name}</span>
                    <span>{i.quantity} {i.unit || 'кг'}</span>
                    <span>{i.price_per_unit ? `${i.price_per_unit} сом` : '—'}</span>
                    <span>{i.supplier || '—'}</span>
                    <div className="materials-table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setReplenishModal(i)}>
                        Пополнить
                      </button>
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget({ id: i.id, name: i.name })}>
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div className="materials-card">
          <div className="materials-card__head">
            <h2 className="materials-card__title">Остатки</h2>
            <input
              type="text"
              className="materials-card__search"
              placeholder="Поиск..."
              value={balancesSearch}
              onChange={(e) => setBalancesSearch(e.target.value)}
            />
          </div>
          {balancesLoading && <Loading />}
          {!balancesLoading && (
            balancesFiltered.length === 0 ? (
              <EmptyState title="Нет данных" />
            ) : (
              <div className="materials-table materials-table--balances">
                <div className="materials-table__header">
                  <span className="materials-table__th">НАЗВАНИЕ</span>
                  <span className="materials-table__th">ОСТАТОК</span>
                </div>
                {balancesFiltered.map((b) => (
                  <div key={b.id} className="materials-table__row">
                    <span className="materials-table__name">{b.name}</span>
                    <span>{b.balance} {b.unit || 'кг'}</span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {incomingModal && (
        <AddMaterialModal
          units={UNITS}
          onSubmit={handleIncomingSubmit}
          onClose={() => { setIncomingModal(null); setSubmitError(''); }}
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
        message={deleteTarget ? `Удалить "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const AddMaterialModal = ({ units, onSubmit, onClose, error }) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('кг');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Добавить товар</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const qty = Number(quantity);
            const price = Number(pricePerUnit);
            if (qty <= 0 || price < 0) return;
            onSubmit({
              name,
              unit,
              quantity: qty,
              price_per_unit: price,
              supplier: supplier || undefined,
              date,
            });
          }}
        >
          <label>Название *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Название товара" />
          <label>Единица измерения *</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)} required>
            {units.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          <label>Количество *</label>
          <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          <label>Цена за единицу (сом) *</label>
          <input type="number" min="0" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} required />
          <label>Поставщик</label>
          <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Название поставщика" />
          <label>Дата *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Добавить</button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0 }}>
        <div className="modal__head">
          <h3>Пополнить: {material.name}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const qty = Number(quantity);
            const price = Number(pricePerUnit);
            if (qty <= 0 || price < 0) return;
            onSubmit({
              name: material.name,
              unit: material.unit,
              quantity: qty,
              price_per_unit: price,
              supplier: material.supplier,
              date,
            });
          }}
        >
          <label>Количество *</label>
          <input type="number" min="0" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required placeholder="Введите количество" />
          <label>Цена за единицу (сом) *</label>
          <input type="number" min="0" step="0.01" value={pricePerUnit} onChange={(e) => setPricePerUnit(e.target.value)} required />
          <label>Дата *</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="submit" className="btn btn--primary">Пополнить</button>
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaterialsPage;
