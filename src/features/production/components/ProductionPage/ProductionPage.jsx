import React, { useState, useMemo, useCallback } from 'react';
import {
  useServerQuery,
  formatQuantityDisplay,
  parseLocaleNumber,
  formatNumberForInput,
  otkResultStatusRu,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, useToast } from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
import ProductionBatchModal from '../../../lines/components/ProductionBatchModal';
import './ProductionPage.scss';

const formatDt = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 16);
};

const lineLabel = (b) => b.line_name || b.line?.name || (b.line_id != null ? `#${b.line_id}` : '—');

const profileLabel = (b) =>
  b.profile?.name
  || b.profile_name
  || b.profile?.code
  || (b.profile_id != null ? `#${b.profile_id}` : '—');

const recipeLabel = (b) =>
  b.recipe?.recipe || b.recipe?.name || b.recipe_name || (b.recipe_id != null ? `#${b.recipe_id}` : '—');

const batchTotalMeters = (b) => {
  const tm = parseLocaleNumber(b.total_meters);
  if (Number.isFinite(tm) && tm > 0) return tm;
  const pcs = Number(b.pieces ?? b.quantity);
  const len = parseLocaleNumber(b.length_per_piece);
  if (Number.isFinite(pcs) && Number.isFinite(len) && pcs > 0 && len > 0) return pcs * len;
  return null;
};

const ProductionPage = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const query = useMemo(
    () => ({ page: 1, page_size: 100, ordering: '-created_at' }),
    [],
  );

  const { items, loading, error, refetch } = useServerQuery('batches/', query, { enabled: true });

  useOperationalRefetch(['production_batch', 'batch', 'line', 'shift'], refetch, true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items || [];
    return (items || []).filter((b) => {
      const blob = [
        lineLabel(b),
        profileLabel(b),
        recipeLabel(b),
        b.id,
        b.comment,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [items, search]);

  const onCreated = useCallback(() => {
    refetch();
    toast.show('Партия создана');
  }, [refetch, toast]);

  return (
    <div className="page page--production">
      <div className="production-card">
        <div className="production-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <input
              type="search"
              className="production-card__search"
              placeholder="Поиск по линии, профилю, рецепту…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => setModalOpen(true)}>
              Новая партия
            </button>
          </div>
        </div>

        <p className="production-card__lede">
          Партии производства (ProductionBatch): штуки и длина одной штуки — метраж считает сервер.
        </p>

        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState title="Нет партий" />
        ) : !loading && !error ? (
          <div className="production-table">
            <div className="production-table__header">
              <span className="production-table__th">Дата</span>
              <span className="production-table__th">Линия</span>
              <span className="production-table__th">Профиль</span>
              <span className="production-table__th">Рецепт</span>
              <span className="production-table__th production-table__th--num">Шт</span>
              <span className="production-table__th production-table__th--num">Длина, м</span>
              <span className="production-table__th production-table__th--num">Метраж</span>
              <span className="production-table__th">ОТК</span>
            </div>
            {filtered.map((b) => {
              const tm = batchTotalMeters(b);
              const pcs = b.pieces ?? b.quantity;
              const lp = b.length_per_piece;
              const otk = otkResultStatusRu(b);
              return (
                <div key={b.id} className="production-table__row">
                  <span className="production-table__cell-clip">{formatDt(b.created_at)}</span>
                  <span className="production-table__cell-clip">{lineLabel(b)}</span>
                  <span className="production-table__cell-clip">{profileLabel(b)}</span>
                  <span className="production-table__cell-clip">{recipeLabel(b)}</span>
                  <span className="production-table__num">{pcs != null ? formatQuantityDisplay(pcs) : '—'}</span>
                  <span className="production-table__num">
                    {lp != null ? formatNumberForInput(parseLocaleNumber(lp)) : '—'}
                  </span>
                  <span className="production-table__num">
                    {tm != null ? formatNumberForInput(tm) : '—'}
                  </span>
                  <span className="production-table__cell-clip">{otk?.label ?? '—'}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {modalOpen && (
        <ProductionBatchModal
          onClose={() => setModalOpen(false)}
          onSuccess={onCreated}
        />
      )}
    </div>
  );
};

export default ProductionPage;
