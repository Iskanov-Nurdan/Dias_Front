import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  useServerQuery,
  formatQuantityDisplay,
  parseLocaleNumber,
  formatNumberForInput,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, useToast, ConfirmModal, ActionMenu } from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
import ProductionBatchModal from '../../../lines/components/ProductionBatchModal';
import ProductionBatchDetailModal from '../ProductionBatchDetailModal/ProductionBatchDetailModal';
import { submitProductionBatchForOtk } from '../../api/productionApi';
import {
  batchProductionLifecycleRu,
  canSendProductionBatchToOtk,
  costPerMeterFromBatch,
  costPerPieceFromBatch,
  batchTotalMetersDisplay,
} from '../../lib/batchMeta';
import './ProductionPage.scss';

const formatDt = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 16);
};

const lineLabel = (b) => b.line_name || b.line?.name || '—';

const profileLabel = (b) =>
  b.profile?.name || b.profile_name || '—';

const recipeLabel = (b) =>
  b.recipe?.recipe || b.recipe?.name || b.recipe_name || '—';

const moneyCell = (n) => {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${formatNumberForInput(n)}`;
};

const ProductionPage = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [otkTarget, setOtkTarget] = useState(null);
  const [otkError, setOtkError] = useState('');
  const [otkBusy, setOtkBusy] = useState(false);
  const otkSubmitLock = useRef(false);

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

  const handleOtkConfirm = useCallback(async () => {
    if (!otkTarget?.id || otkSubmitLock.current) return;
    otkSubmitLock.current = true;
    setOtkError('');
    setOtkBusy(true);
    try {
      await submitProductionBatchForOtk(otkTarget.id);
      toast.show('Партия передана в ОТК');
      setOtkTarget(null);
      refetch();
    } catch (e) {
      setOtkError(getApiErrorMessage(e, 'Не удалось передать в ОТК'));
    } finally {
      setOtkBusy(false);
      otkSubmitLock.current = false;
    }
  }, [otkTarget, refetch, toast]);

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
          <div className="ds-toolbar__end production-card__toolbar-actions">
            <button type="button" className="btn btn--primary" onClick={() => setModalOpen(true)}>
              Новая партия
            </button>
          </div>
        </div>

        {loading && <Loading />}
        {error && <ErrorState error={error} onRetry={refetch} />}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState title="Нет партий" />
        ) : !loading && !error ? (
          <div className="production-table-wrap">
            <div className="production-table">
              <div className="production-table__header">
                <span className="production-table__th">Создано</span>
                <span className="production-table__th">Профиль</span>
                <span className="production-table__th">Рецепт</span>
                <span className="production-table__th">Линия</span>
                <span className="production-table__th production-table__th--num">Шт</span>
                <span className="production-table__th production-table__th--num">Длина, м</span>
                <span className="production-table__th production-table__th--num">Метры</span>
                <span className="production-table__th production-table__th--num">Сом/м</span>
                <span className="production-table__th production-table__th--num">Сом/шт</span>
                <span className="production-table__th">Статус</span>
                <span className="production-table__th production-table__th--actions">Действия</span>
              </div>
              {filtered.map((b) => {
                const tm = batchTotalMetersDisplay(b);
                const pcs = b.pieces ?? b.quantity;
                const lp = b.length_per_piece;
                const life = batchProductionLifecycleRu(b);
                const cpm = costPerMeterFromBatch(b);
                const cpp = costPerPieceFromBatch(b);
                const canOtk = canSendProductionBatchToOtk(b);
                return (
                  <div key={b.id} className="production-table__row">
                    <span className="production-table__cell-clip production-table__cell--muted">
                      {formatDt(b.created_at)}
                    </span>
                    <span className="production-table__cell-clip">{profileLabel(b)}</span>
                    <span className="production-table__cell-clip">{recipeLabel(b)}</span>
                    <span className="production-table__cell-clip">{lineLabel(b)}</span>
                    <span className="production-table__num">{pcs != null ? formatQuantityDisplay(pcs) : '—'}</span>
                    <span className="production-table__num">
                      {lp != null ? formatNumberForInput(parseLocaleNumber(lp)) : '—'}
                    </span>
                    <span className="production-table__num">
                      {tm != null ? formatNumberForInput(tm) : '—'}
                    </span>
                    <span className="production-table__num">{moneyCell(cpm)}</span>
                    <span className="production-table__num">{moneyCell(cpp)}</span>
                    <span className="production-table__cell-clip">{life.label}</span>
                    <span className="production-table__actions">
                      {canOtk ? (
                        <button
                          type="button"
                          className="btn btn--primary btn--sm production-table__otk-btn"
                          onClick={() => {
                            setOtkError('');
                            setOtkTarget(b);
                          }}
                        >
                          В ОТК
                        </button>
                      ) : null}
                      <ActionMenu
                        items={[
                          { label: 'Детали', onClick: () => setDetailId(b.id) },
                        ]}
                      />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {modalOpen && (
        <ProductionBatchModal
          onClose={() => setModalOpen(false)}
          onSuccess={onCreated}
        />
      )}

      {detailId != null && (
        <ProductionBatchDetailModal
          batchId={detailId}
          onClose={() => setDetailId(null)}
          onSaved={refetch}
        />
      )}

      <ConfirmModal
        open={otkTarget != null}
        title="Передать партию в ОТК?"
        message={otkTarget ? `Передать в ОТК: ${profileLabel(otkTarget)} · ${recipeLabel(otkTarget)}` : ''}
        confirmText={otkBusy ? 'Отправка…' : 'Отправить'}
        onCancel={() => {
          if (!otkBusy) {
            setOtkTarget(null);
            setOtkError('');
          }
        }}
        onConfirm={handleOtkConfirm}
        error={otkError}
      />
    </div>
  );
};

export default ProductionPage;
