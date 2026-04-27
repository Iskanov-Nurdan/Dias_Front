import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
import { getLines } from '../../../lines/api/linesApi';
import { getOrderSelectSources } from '../../../orders/api/ordersApi';
import { submitProductionBatchForOtk, startProductionRequest } from '../../api/productionApi';
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

const pickCl = (c) => {
  if (!c) return '';
  if (c.label != null) {
    const lab = String(c.label).trim();
    if (lab && !/^клиент$/i.test(lab)) return lab;
  }
  const n =
    (typeof c.name === 'string' && c.name.trim()) ||
    (typeof c.title === 'string' && c.title.trim()) ||
    (typeof c.client_name === 'string' && c.client_name.trim());
  if (n) return n;
  return '';
};

const pickPr = (p) => {
  if (!p) return '';
  if (p.label != null) {
    const lab = String(p.label).trim();
    if (lab) return lab;
  }
  const n =
    (typeof p.name === 'string' && p.name.trim()) ||
    (typeof p.title === 'string' && p.title.trim()) ||
    (typeof p.code === 'string' && p.code.trim());
  if (n) return n;
  return '';
};

const rqClient = (o, list) => {
  if (o?.client && typeof o.client === 'object') {
    const t = pickCl(o.client);
    if (t) return t;
  }
  if (o?.client_name && String(o.client_name).trim()) return String(o.client_name).trim();
  let rid = o?.client_id;
  if (rid == null && o?.client != null && typeof o.client !== 'object') rid = o.client;
  if (rid != null && Array.isArray(list)) {
    const row = list.find((c) => String(c.id) === String(rid));
    if (row) return pickCl(row);
  }
  if (rid != null) return '—';
  return '—';
};

const rqProfile = (o, list) => {
  if (o?.profile && typeof o.profile === 'object') {
    const t = pickPr(o.profile);
    if (t) return t;
  }
  if (o?.profile_name && String(o.profile_name).trim()) return String(o.profile_name).trim();
  let rid = o?.profile_id;
  if (rid == null && o?.profile != null && typeof o.profile !== 'object') rid = o.profile;
  if (rid != null && Array.isArray(list)) {
    const row = list.find((p) => String(p.id) === String(rid));
    if (row) return pickPr(row);
  }
  if (rid != null) return '—';
  return '—';
};

const ProductionClientRequestsPanel = () => {
  const toast = useToast();
  const [lines, setLines] = useState([]);
  const [lineByOrder, setLineByOrder] = useState({});
  const [startBusy, setStartBusy] = useState(null);
  const [srcClients, setSrcClients] = useState([]);
  const [srcProfiles, setSrcProfiles] = useState([]);

  const q = useMemo(() => ({ page: 1, page_size: 200 }), []);
  const { items, loading, error, refetch } = useServerQuery('production/requests/', q, { enabled: true });

  useOperationalRefetch(['order', 'batch', 'production_batch'], refetch, true);

  useEffect(() => {
    getLines({ page_size: 200 })
      .then((res) => {
        const list = res.data?.items ?? (Array.isArray(res.data) ? res.data : []);
        setLines(Array.isArray(list) ? list : []);
      })
      .catch(() => setLines([]));
  }, []);

  useEffect(() => {
    getOrderSelectSources()
      .then((res) => {
        const data = res.data || {};
        setSrcClients(Array.isArray(data.clients) ? data.clients : []);
        setSrcProfiles(Array.isArray(data.profiles) ? data.profiles : []);
      })
      .catch(() => {
        setSrcClients([]);
        setSrcProfiles([]);
      });
  }, []);

  const onStart = async (orderId) => {
    const lineVal = lineByOrder[orderId];
    if (!lineVal) {
      toast.show('Выберите линию');
      return;
    }
    setStartBusy(orderId);
    try {
      await startProductionRequest(orderId, Number(lineVal));
      await refetch();
      toast.show('Старт');
    } catch (e) {
      toast.show(getApiErrorMessage(e, 'Ошибка'));
    } finally {
      setStartBusy(null);
    }
  };

  return (
    <div className="production-card production-card--client-requests">
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (!items || items.length === 0) && <EmptyState title="Нет заявок" />}
      {!loading && !error && items && items.length > 0 && (
        <div className="production-table-wrap">
          <div className="production-table production-table--client-rq">
            <div className="production-table__header">
              <span className="production-table__th">Клиент</span>
              <span className="production-table__th">Профиль</span>
              <span className="production-table__th production-table__th--num">Длина, м</span>
              <span className="production-table__th production-table__th--num">Кол-во</span>
              <span className="production-table__th production-table__th--num">Всего, м</span>
              <span className="production-table__th">Линия</span>
              <span className="production-table__th production-table__th--actions"> </span>
            </div>
            {items.map((o) => {
              const lineVal = lineByOrder[o.id] != null ? String(lineByOrder[o.id]) : '';
              return (
                <div key={o.id} className="production-table__row">
                  <span className="production-table__cell-clip">{rqClient(o, srcClients)}</span>
                  <span className="production-table__cell-clip">{rqProfile(o, srcProfiles)}</span>
                  <span className="production-table__num">
                    {o.length != null && o.length !== '' ? String(o.length) : '—'}
                  </span>
                  <span className="production-table__num">
                    {o.quantity != null && o.quantity !== '' ? formatQuantityDisplay(o.quantity) : '—'}
                  </span>
                  <span className="production-table__num">
                    {o.total_meters != null && o.total_meters !== '' ? String(o.total_meters) : '—'}
                  </span>
                  <span className="production-table__cell-clip">
                    <select
                      className="production-client-rq__select"
                      value={lineVal}
                      onChange={(e) => setLineByOrder((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      disabled={startBusy === o.id}
                    >
                      <option value="">—</option>
                      {lines.map((ln) => (
                        <option key={ln.id} value={String(ln.id)}>
                          {ln.name || `Линия ${ln.id}`}
                        </option>
                      ))}
                    </select>
                  </span>
                  <span className="production-table__actions">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={startBusy === o.id}
                      onClick={() => onStart(o.id)}
                    >
                      {startBusy === o.id ? '…' : 'Старт'}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ProductionPage = () => {
  const toast = useToast();
  const [mainTab, setMainTab] = useState('batches');
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
      <div className="production-main-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'batches'}
          className={`production-main-tabs__btn${mainTab === 'batches' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('batches')}
        >
          Партии
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'requests'}
          className={`production-main-tabs__btn${mainTab === 'requests' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('requests')}
        >
          Заявки
        </button>
      </div>

      {mainTab === 'requests' && <ProductionClientRequestsPanel />}

      {mainTab === 'batches' && (
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
      )}

      {mainTab === 'batches' && modalOpen && (
        <ProductionBatchModal
          onClose={() => setModalOpen(false)}
          onSuccess={onCreated}
        />
      )}

      {mainTab === 'batches' && detailId != null && (
        <ProductionBatchDetailModal
          batchId={detailId}
          onClose={() => setDetailId(null)}
          onSaved={refetch}
        />
      )}

      {mainTab === 'batches' && (
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
      )}
    </div>
  );
};

export default ProductionPage;
