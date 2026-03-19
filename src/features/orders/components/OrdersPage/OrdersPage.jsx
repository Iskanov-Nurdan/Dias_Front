import React, { useState, useEffect } from 'react';
import { useServerQuery } from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, ConfirmModal, useToast } from '../../../../shared/ui';
import Select from '../../../../shared/ui/Select/Select';
import { createOrder, updateOrder, deleteOrder, getOrder } from '../../api/ordersApi';
import { getRecipeAvailability } from '../../../recipes/api/recipesApi';
import { apiClient } from '../../../../shared/api';
import './OrdersPage.scss';

const STATUSES = [
  { value: 'created', label: 'СОЗДАН', color: 'gray' },
  { value: 'in_progress', label: 'В РАБОТЕ', color: 'orange' },
  { value: 'done', label: 'ВЫПОЛНЕН', color: 'green' },
];

const OrdersPage = () => {
  const toast = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [query] = useState({ page: 1, page_size: 50 });
  const [modalOpen, setModalOpen] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitError, setSubmitError] = useState('');
  const [lineFilterInProgress, setLineFilterInProgress] = useState('');

  const [lines, setLines] = useState([]);
  const [recipes, setRecipes] = useState([]);

  const queryWithStatus = statusFilter ? { ...query, status: statusFilter } : query;
  const { items: orders, loading, error, refetch } = useServerQuery(
    'orders/',
    queryWithStatus,
    { enabled: true }
  );

  useEffect(() => {
    apiClient.get('lines/', { params: { page_size: 500 } })
      .then((res) => setLines(res.data?.items || []))
      .catch(() => setLines([]));
  }, []);
  useEffect(() => {
    apiClient.get('recipes/', { params: { page_size: 500 } })
      .then((res) => setRecipes(res.data?.items || []))
      .catch(() => setRecipes([]));
  }, []);

  const ordersInProgress = orders.filter((o) =>
    (o.status === 'in_progress' || o.status === 'В РАБОТЕ')
  );
  const ordersInProgressByLine = lineFilterInProgress
    ? ordersInProgress.filter((o) => String(o.line?.id ?? o.line_id ?? o.line) === String(lineFilterInProgress))
    : ordersInProgress;

  const handleSubmit = async (data) => {
    setSubmitError('');
    try {
      if (modalOpen?.id) {
        await updateOrder(modalOpen.id, data);
      } else {
        await createOrder(data);
      }
      setModalOpen(null);
      refetch();
      toast.show('Успешно сохранено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || err.response?.data?.details || 'Ошибка');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitError('');
    try {
      await deleteOrder(deleteTarget.id);
      setDeleteTarget(null);
      refetch();
      toast.show('Успешно удалено');
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ошибка удаления');
    }
  };

  const canDelete = (o) => {
    const s = String(o?.status || '').toLowerCase();
    return s !== 'in_progress' && s !== 'в работе';
  };

  const statusLabel = (s) => {
    const v = (s || '').toLowerCase();
    if (v === 'created' || v === 'создан') return 'СОЗДАН';
    if (v === 'in_progress' || v === 'в работе') return 'В РАБОТЕ';
    if (v === 'done' || v === 'выполнен' || v === 'принято') return 'ВЫПОЛНЕН';
    return s || '—';
  };

  const statusColor = (s) => {
    const v = (s || '').toLowerCase();
    if (v === 'created' || v === 'создан') return 'gray';
    if (v === 'in_progress' || v === 'в работе') return 'orange';
    if (v === 'done' || v === 'выполнен' || v === 'принято') return 'green';
    return 'gray';
  };

  const productName = (o) => o.product_name || o.product?.name || o.product || o.recipe?.name || o.recipe_name || o.recipe || '—';
  const recipeName = (o) => o.recipe_name || o.recipe?.name || o.recipe || '—';
  const lineName = (o) => o.line?.name || o.line_name || o.line || '—';
  const formatDate = (d) => (d ? (typeof d === 'string' ? d.slice(0, 10) : d) : '—');

  return (
    <div className="page page--orders">
      <div className="orders-tabs">
        <button
          type="button"
          className={`orders-tabs__tab ${statusFilter === '' ? 'orders-tabs__tab--active' : ''}`}
          onClick={() => setStatusFilter('')}
        >
          Все
        </button>
        {STATUSES.map((st) => (
          <button
            key={st.value}
            type="button"
            className={`orders-tabs__tab orders-tabs__tab--${st.color} ${statusFilter === st.value ? 'orders-tabs__tab--active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === st.value ? '' : st.value)}
          >
            {st.label}
          </button>
        ))}
      </div>


      {loading && <Loading />}
      {error && error.status !== 404 && <ErrorState error={error} onRetry={refetch} />}

      {!loading && (!error || error.status === 404) && (
        <>
          <div className="orders-card">
            <div className="orders-card__head">
              <h2 className="orders-card__title">Заказы в работе</h2>
              <Select
                className="orders-card__line-select"
                value={lineFilterInProgress}
                placeholder="Все линии"
                options={[
                  { value: '', label: 'Все линии' },
                  ...lines.map((l) => ({ value: String(l.id), label: l.name })),
                ]}
                onChange={(val) => setLineFilterInProgress(val)}
              />
            </div>
            {ordersInProgressByLine.length === 0 ? (
              <EmptyState title="Нет заказов в работе" />
            ) : (
              <div className="orders-table orders-table--in-progress">
                <div className="orders-table__header">
                  <span className="orders-table__th">СТАТУС</span>
                  <span className="orders-table__th">ПРОДУКТ</span>
                  <span className="orders-table__th">ВЫПУЩЕНО</span>
                  <span className="orders-table__th orders-table__th--actions">ДЕЙСТВИЯ</span>
                </div>
                {ordersInProgressByLine.map((o) => (
                  <div key={o.id} className="orders-table__row">
                    <span>{o.batch || o.batch_id || `#${o.id}`}</span>
                    <span>{productName(o)}</span>
                    <span>{o.quantity ?? o.produced ?? o.released ?? '—'}</span>
                    <div className="orders-table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModalOpen(o)}>Редактировать</button>
                      {canDelete(o) && (
                        <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget({ id: o.id, name: productName(o) })}>Удалить</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="orders-card">
            <div className="orders-card__head">
              <h2 className="orders-card__title">Заказы</h2>
              <button type="button" className="btn btn--primary" onClick={() => setModalOpen({})}>
                Создать
              </button>
            </div>
            {orders.length === 0 ? (
              <EmptyState title="Нет данных" />
            ) : (
              <div className="orders-table orders-table--main">
                <div className="orders-table__header">
                  <span className="orders-table__th">СТАТУС</span>
                  <span className="orders-table__th">ПРОДУКТ</span>
                  <span className="orders-table__th">РЕЦЕПТ</span>
                  <span className="orders-table__th">ЛИНИЯ</span>
                  <span className="orders-table__th">ДАТА</span>
                  <span className="orders-table__th orders-table__th--actions">ДЕЙСТВИЯ</span>
                </div>
                {orders.map((o) => (
                  <div key={o.id} className="orders-table__row">
                    <span className={`orders-table__status orders-table__status--${statusColor(o.status)}`}>
                      {statusLabel(o.status)}
                    </span>
                    <span>{productName(o)}</span>
                    <span>{recipeName(o)}</span>
                    <span>{lineName(o)}</span>
                    <span>{formatDate(o.date || o.created_at)}</span>
                    <div className="orders-table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setModalOpen(o)}>Редактировать</button>
                      {canDelete(o) && (
                        <button type="button" className="btn btn--danger btn--sm" onClick={() => setDeleteTarget({ id: o.id, name: productName(o) })}>Удалить</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {modalOpen !== null && (
        <OrderModal
          order={modalOpen?.id ? modalOpen : null}
          onFetchOrder={modalOpen?.id ? getOrder : undefined}
          lines={lines}
          recipes={recipes}
          onSubmit={handleSubmit}
          onClose={() => { setModalOpen(null); setSubmitError(''); }}
          error={submitError}
        />
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Удалить?"
        message={deleteTarget ? `Удалить заказ "${deleteTarget.name}"?` : ''}
        confirmText="Удалить"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

const OrderModal = ({ order, onFetchOrder, lines, recipes, onSubmit, onClose, error }) => {
  const isEdit = !!order?.id;
  const [recipeId, setRecipeId] = useState('');
  const [lineId, setLineId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState(null);

  useEffect(() => {
    const init = (o) => {
      setRecipeId(o?.recipe_id ?? o?.recipe?.id ?? o?.recipe ?? '');
      setLineId(o?.line_id ?? o?.line?.id ?? o?.line ?? '');
      setQuantity(o?.quantity ?? '');
    };
    if (order?.id && onFetchOrder) {
      setLoading(true);
      onFetchOrder(order.id)
        .then((res) => init(res.data))
        .catch(() => init(order))
        .finally(() => setLoading(false));
    } else {
      init(order || {});
    }
  }, [order, order?.id, onFetchOrder]);

  useEffect(() => {
    if (!recipeId) {
      setAvailability(null);
      return;
    }
    getRecipeAvailability(Number(recipeId))
      .then((res) => setAvailability(res.data))
      .catch(() => setAvailability(null));
  }, [recipeId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      recipe_id: recipeId ? Number(recipeId) : undefined,
      line_id: lineId ? Number(lineId) : undefined,
      quantity: quantity ? Number(quantity) : undefined,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h3>{isEdit ? 'Редактировать' : 'Создать'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        {loading ? (
          <Loading />
        ) : (
          <form onSubmit={handleSubmit}>
            <label>Рецепт</label>
            <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} required>
              <option value="">— Выберите —</option>
              {recipes.map((r) => (
                <option key={r.id} value={r.id}>{r.recipe || r.recipe_name || r.product || r.name || r.id}</option>
              ))}
            </select>
            <div className="orders-modal-banner">
              Доступны только подтверждённые рецепты.
            </div>
            {availability && !availability.available && availability.missing?.length > 0 && (
              <div className="orders-modal-warning">
                Риск нехватки: {availability.missing.map((m) =>
                  `${m.component}: требуется ${m.required}, доступно ${m.available ?? 0} ${m.unit || ''}`
                ).join('; ')}
              </div>
            )}
            <label>Линия</label>
            <select value={lineId} onChange={(e) => setLineId(e.target.value)} required>
              <option value="">— Выберите —</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <label>Кол-во</label>
            <input
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
            {error && <p className="modal__error">{error}</p>}
            <div className="modal__actions">
              <button type="submit" className="btn btn--primary">{isEdit ? 'Сохранить' : 'Создать'}</button>
              <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
