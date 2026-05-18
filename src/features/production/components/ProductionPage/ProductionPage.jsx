import React, { useState, useMemo, useEffect } from 'react';
import {
  useServerQuery,
  formatQuantityDisplay,
  formatNumberForInput,
  getApiErrorMessage,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, useToast, SearchableSelect, ClientDateFilter } from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
import ProduceBlankModal from '../ProduceBlankModal/ProduceBlankModal';
import { getOrderSelectSources } from '../../../orders/api/ordersApi';
import { startProductionRequest } from '../../api/productionApi';
import {
  mapBlankProductionRunFromApi,
  mapWorkshopBlankFromApi,
} from '../../../chemistry/api/blankWorkshopApi';
import './ProductionPage.scss';

const formatRunDateTime = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};

const legacyDefectSumKg = (run) => {
  const m = run.defectsKgByProduct;
  if (!m || typeof m !== 'object') return null;
  let s = 0;
  for (const v of Object.values(m)) {
    const x = Number(v);
    if (Number.isFinite(x)) s += x;
  }
  return s > 0 ? s : null;
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

/** Список ID заготовок, разрешённых для этой заявки (сериализатор production). */
const readAllowedBlankIds = (order) => {
  const raw = order?.allowed_blank_ids ?? order?.allowedBlankIds;
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return [];
  return raw.map((x) => String(x));
};

/**
 * Опции селекта заготовки: если бэк отдал allowed_blank_ids — только они (без «левых» заготовок).
 * Пустой массив с бэка = нет подходящих заготовок в каталоге.
 */
const filterBlankSelectOptions = (allWithPlaceholder, order) => {
  const allowed = readAllowedBlankIds(order);
  const data = allWithPlaceholder.filter((o) => o.value !== '');
  if (allowed === null) return allWithPlaceholder;
  if (allowed.length === 0) return [{ value: '', label: '—' }];
  const set = new Set(allowed);
  const filtered = data.filter((o) => set.has(String(o.value)));
  return [{ value: '', label: '—' }, ...filtered];
};

const ProductionClientRequestsPanel = ({ queryEnabled, clientDateFilter }) => {
  const toast = useToast();
  const [blankByOrder, setBlankByOrder] = useState({});
  const [startBusy, setStartBusy] = useState(null);
  const [srcClients, setSrcClients] = useState([]);
  const [srcProfiles, setSrcProfiles] = useState([]);

  const q = useMemo(() => ({ page: 1, page_size: 200 }), []);
  const { items, loading, error, refetch } = useServerQuery('production/requests/', q, {
    enabled: queryEnabled,
  });

  const blanksQ = useMemo(() => ({ page: 1, page_size: 500, ordering: 'name' }), []);
  const { items: blankItems, refetch: refetchBlanks } = useServerQuery('workshop/blanks/', blanksQ, {
    enabled: queryEnabled,
  });

  useOperationalRefetch(['order', 'production_batch', 'orders'], refetch, queryEnabled);
  useOperationalRefetch(['workshop_blank'], refetchBlanks, queryEnabled);

  const orderDateFields = useMemo(
    () => ['created_at', 'updated_at', 'date', 'order_date', 'requested_at'],
    [],
  );

  const visibleItems = useMemo(() => {
    const list = items || [];
    if (!clientDateFilter) return list;
    return list.filter((o) =>
      matchesClientDateFilter(clientDateFilter, pickFirstIsoDate(o, orderDateFields)),
    );
  }, [items, clientDateFilter, orderDateFields]);

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

  const blankOptions = useMemo(() => {
    const list = (blankItems || []).map(mapWorkshopBlankFromApi).filter(Boolean);
    return [
      { value: '', label: '—' },
      ...list.map((b) => ({
        value: b.id,
        label: b.name || `Заготовка ${b.id}`,
        searchText: [b.name, b.id].filter((x) => x != null && String(x).trim() !== '').join(' '),
      })),
    ];
  }, [blankItems]);

  useEffect(() => {
    if (!items?.length) return;
    setBlankByOrder((prev) => {
      let next = { ...prev };
      let changed = false;
      for (const o of items) {
        const rowOpts = filterBlankSelectOptions(blankOptions, o);
        const validSet = new Set(rowOpts.filter((x) => x.value).map((x) => String(x.value)));
        const cur = prev[o.id] != null ? String(prev[o.id]) : '';
        if (cur && !validSet.has(cur)) {
          delete next[o.id];
          changed = true;
        }
      }
      for (const o of items) {
        const onlyData = filterBlankSelectOptions(blankOptions, o).filter((x) => x.value);
        const cur = next[o.id] != null ? String(next[o.id]) : '';
        if (!cur && onlyData.length === 1) {
          next[o.id] = onlyData[0].value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items, blankOptions]);

  const onStart = async (orderId) => {
    const blankVal = blankByOrder[orderId];
    if (!blankVal) {
      toast.show('Выберите заготовку');
      return;
    }
    setStartBusy(orderId);
    try {
      await startProductionRequest(orderId, Number(blankVal));
      await refetch();
      toast.show('Старт');
    } catch (e) {
      toast.show(getApiErrorMessage(e, 'Ошибка'));
    } finally {
      setStartBusy(null);
    }
  };

  return (
    <>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (!items || items.length === 0) && <EmptyState title="Нет заявок" />}
      {!loading && !error && items && items.length > 0 && visibleItems.length === 0 && (
        <EmptyState title="На выбранную дату заявок нет" />
      )}
      {!loading && !error && visibleItems.length > 0 && (
        <div className="production-table-wrap">
          <div className="production-table production-table--client-rq">
            <div className="production-table__header">
              <span className="production-table__th">Клиент</span>
              <span className="production-table__th">Профиль</span>
              <span className="production-table__th production-table__th--num">Кол-во</span>
              <span className="production-table__th">Заготовка</span>
              <span className="production-table__th production-table__th--actions"> </span>
            </div>
            {visibleItems.map((o) => {
              const blankVal = blankByOrder[o.id] != null ? String(blankByOrder[o.id]) : '';
              const rowBlankOptions = filterBlankSelectOptions(blankOptions, o);
              return (
                <div key={o.id} className="production-table__row">
                  <span className="production-table__cell-clip">{rqClient(o, srcClients)}</span>
                  <span className="production-table__cell-clip">{rqProfile(o, srcProfiles)}</span>
                  <span className="production-table__num">
                    {o.quantity != null && o.quantity !== '' ? formatQuantityDisplay(o.quantity) : '—'}
                  </span>
                  <span className="production-table__cell-clip">
                    <SearchableSelect
                      value={blankVal}
                      onChange={(v) => setBlankByOrder((prev) => ({ ...prev, [o.id]: v != null ? String(v) : '' }))}
                      options={rowBlankOptions}
                      placeholder="Выберите"
                      disabled={startBusy === o.id}
                    />
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
    </>
  );
};

const producedDefectLabel = (run) => {
  if (run.defectKg != null && Number.isFinite(Number(run.defectKg))) {
    return `${formatNumberForInput(run.defectKg)} кг`;
  }
  const leg = legacyDefectSumKg(run);
  if (leg != null) return `${formatNumberForInput(leg)} кг`;
  return '—';
};

const ProductionProducedPanel = ({ runs, loading, error, onRetry, clientDateFilter }) => {
  const visibleRuns = useMemo(() => {
    const list = runs || [];
    if (!clientDateFilter) return list;
    return list.filter((run) =>
      matchesClientDateFilter(clientDateFilter, pickFirstIsoDate(run, ['createdAt'])),
    );
  }, [runs, clientDateFilter]);

  return (
    <>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={onRetry} />}
      {!loading && !error && (!runs || runs.length === 0) && (
        <EmptyState title="Пока нет записей — нажмите «Произвести» во вкладке «Заявки»" />
      )}
      {!loading && !error && runs && runs.length > 0 && visibleRuns.length === 0 && (
        <EmptyState title="На выбранную дату записей нет" />
      )}
      {!loading && !error && visibleRuns.length > 0 && (
        <div className="production-table-wrap">
          <div className="production-table production-table--produced-local">
            <div className="production-table__header">
              <span className="production-table__th">Товар</span>
              <span className="production-table__th">Заготовка</span>
              <span className="production-table__th">Дата</span>
              <span className="production-table__th production-table__th--num">Брак</span>
            </div>
            {visibleRuns.map((run) => (
              <div key={run.id} className="production-table__row">
                <span className="production-table__cell-clip">{run.productName || '—'}</span>
                <span className="production-table__cell-clip">{run.blankName || '—'}</span>
                <span className="production-table__cell-clip">{formatRunDateTime(run.createdAt)}</span>
                <span className="production-table__num">{producedDefectLabel(run)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

const blankRunsQuery = { page: 1, page_size: 200, ordering: '-created_at' };

const ProductionPage = () => {
  const toast = useToast();
  const [mainTab, setMainTab] = useState('requests');
  const [produceBlankOpen, setProduceBlankOpen] = useState(false);
  const [clientDateFilter, setClientDateFilter] = useState('');
  const isRequests = mainTab === 'requests';

  const {
    items: runItems,
    loading: runsLoading,
    error: runsError,
    refetch: refetchBlankRuns,
  } = useServerQuery('workshop/blank-production-runs/', blankRunsQuery, {
    enabled: true,
  });

  const mappedRuns = useMemo(
    () => (runItems || []).map(mapBlankProductionRunFromApi).filter(Boolean),
    [runItems],
  );

  return (
    <div className="page page--production">
      <div className="production-main-tabs" role="tablist" aria-label="Разделы производства">
        <button
          type="button"
          role="tab"
          aria-selected={isRequests}
          className={`production-main-tabs__btn${isRequests ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('requests')}
        >
          Заявки
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'produced'}
          className={`production-main-tabs__btn${mainTab === 'produced' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('produced')}
        >
          Произведённые
        </button>
      </div>
      <div className="production-page__date-row">
        <ClientDateFilter
          value={clientDateFilter}
          onChange={setClientDateFilter}
          id="production-page-date-filter"
        />
      </div>
      <div className="production-card production-card--client-requests">
        {isRequests ? (
          <div className="production-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start" />
            <div className="ds-toolbar__end production-card__toolbar-actions">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => setProduceBlankOpen(true)}
              >
                Произвести
              </button>
            </div>
          </div>
        ) : null}
        {isRequests ? <ProductionClientRequestsPanel queryEnabled clientDateFilter={clientDateFilter} /> : null}
        {mainTab === 'produced' ? (
          <ProductionProducedPanel
            runs={mappedRuns}
            loading={runsLoading}
            error={runsError}
            onRetry={refetchBlankRuns}
            clientDateFilter={clientDateFilter}
          />
        ) : null}
      </div>
      {produceBlankOpen && (
        <ProduceBlankModal
          onClose={() => setProduceBlankOpen(false)}
          onSaved={() => {
            toast.show('Сохранено');
            refetchBlankRuns();
          }}
        />
      )}
    </div>
  );
};

export default ProductionPage;
