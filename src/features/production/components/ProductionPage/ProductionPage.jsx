import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  useServerQuery,
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
  extractOrderLines,
  lineProfileLabel,
  lineQuantityLabel,
} from '../../../../shared/lib';
import {
  Loading,
  EmptyState,
  ErrorState,
  useToast,
  ClientDateFilter,
  SearchableSelect,
  CompactList,
  RecordDetailsModal,
  DetailFields,
} from '../../../../shared/ui';
import { useOperationalRefetch, WS_PRODUCTION } from '../../../../shared/realtime';
import ProduceBlankModal from '../ProduceBlankModal/ProduceBlankModal';
import { getOrder, getOrderSelectSources } from '../../../orders/api/ordersApi';
import { orderLineKey, orderLineApiId } from '../../lib/orderLineKeys';
import { getMyShift } from '../../../shifts/api/shiftsApi';
import { isPersonalShiftOpen, parseMyShiftFromResponse } from '../../../../shared/lib/auditShiftSync';
import { startProductionRequest } from '../../api/productionApi';
import { getProductionStartErrorMessage } from '../../lib/productionStartError';
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

/** allowed_blank_ids на позиции или на всей заявке. */
const readAllowedBlankIds = (order, line) => {
  const lineRaw = line?.allowed_blank_ids ?? line?.allowedBlankIds;
  if (Array.isArray(lineRaw)) return lineRaw.map((x) => String(x));
  const raw = order?.allowed_blank_ids ?? order?.allowedBlankIds;
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0) return [];
  return raw.map((x) => String(x));
};

const buildLineBlankSelectOptions = (catalogOptions, order, line) => {
  const data = (catalogOptions || []).filter((o) => o.value);
  const allowed = readAllowedBlankIds(order, line);
  let picked = data;
  if (allowed !== null) {
    if (allowed.length === 0) picked = [];
    else {
      const set = new Set(allowed);
      picked = data.filter((o) => set.has(String(o.value)));
      const matchedIds = new Set(picked.map((o) => String(o.value)));
      const fallbacks = allowed
        .filter((id) => !matchedIds.has(id))
        .map((id) => ({ value: id, label: `Заготовка #${id}` }));
      picked = [...picked, ...fallbacks];
    }
  }
  return [{ value: '', label: '—' }, ...picked];
};

const ProductionClientRequestsPanel = ({ queryEnabled, clientDateFilter }) => {
  const toast = useToast();
  /** `${orderId}:${lineKey}` → blank id */
  const [blankByLineKey, setBlankByLineKey] = useState({});
  const [orderDetailById, setOrderDetailById] = useState({});
  const [startBusy, setStartBusy] = useState(null);
  const [lineModal, setLineModal] = useState(null);
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

  useOperationalRefetch(WS_PRODUCTION, () => {
    refetch();
    refetchBlanks();
  }, queryEnabled);

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

  const orderWithLines = useCallback(
    (o) => {
      const detailed = orderDetailById[o?.id];
      const fromDetail = extractOrderLines(detailed);
      const fromList = extractOrderLines(o);
      return fromDetail.length > fromList.length ? detailed || o : o;
    },
    [orderDetailById],
  );

  useEffect(() => {
    let cancelled = false;
    const needDetail = (visibleItems || []).filter((o) => {
      if (o?.id == null) return false;
      if (orderDetailById[o.id]) return false;
      return extractOrderLines(o).length <= 1;
    });
    if (!needDetail.length) return undefined;
    Promise.all(
      needDetail.map((o) =>
        getOrder(o.id)
          .then((res) => [o.id, res.data])
          .catch(() => [o.id, null]),
      ),
    ).then((pairs) => {
      if (cancelled) return;
      setOrderDetailById((prev) => {
        const next = { ...prev };
        pairs.forEach(([id, data]) => {
          if (data && extractOrderLines(data).length) next[id] = data;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [visibleItems, orderDetailById]);

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

  const blankCatalogOptions = useMemo(() => {
    const list = (blankItems || []).map(mapWorkshopBlankFromApi).filter(Boolean);
    return list.map((b) => ({
      value: b.id,
      label: b.name || `Заготовка ${b.id}`,
    }));
  }, [blankItems]);

  useEffect(() => {
    if (!items?.length) return;
    setBlankByLineKey((prev) => {
      let next = { ...prev };
      let changed = false;
      for (const o of items) {
        const displayOrder = orderDetailById[o.id] || o;
        const lines = extractOrderLines(displayOrder);
        lines.forEach((ln, idx) => {
          const sk = `${o.id}:${orderLineKey(ln, idx)}`;
          const opts = buildLineBlankSelectOptions(blankCatalogOptions, o, ln).filter((x) => x.value);
          const validSet = new Set(opts.map((x) => String(x.value)));
          const cur = prev[sk] != null ? String(prev[sk]) : '';
          if (cur && !validSet.has(cur)) {
            delete next[sk];
            changed = true;
          }
          if (!next[sk] && opts.length === 1) {
            next[sk] = opts[0].value;
            changed = true;
          }
        });
      }
      return changed ? next : prev;
    });
  }, [items, blankCatalogOptions, orderDetailById]);

  const lineRows = useMemo(() => {
    const rows = [];
    for (const o of visibleItems) {
      const displayOrder = orderWithLines(o);
      const lines = extractOrderLines(displayOrder);
      const clientLabel = rqClient(o, srcClients);
      if (!lines.length) {
        rows.push({
          id: `order-${o.id}`,
          order: o,
          line: null,
          idx: 0,
          stateKey: `${o.id}:empty`,
          clientLabel,
        });
        continue;
      }
      lines.forEach((ln, idx) => {
        rows.push({
          id: `${o.id}:${orderLineKey(ln, idx)}`,
          order: o,
          line: ln,
          idx,
          stateKey: `${o.id}:${orderLineKey(ln, idx)}`,
          clientLabel,
        });
      });
    }
    return rows;
  }, [visibleItems, orderWithLines, srcClients]);

  const runStart = async (row, blankId) => {
    const orderId = row.order?.id;
    if (orderId == null || !row.line) return;
    const blankRaw = blankId ?? blankByLineKey[row.stateKey];
    if (!blankRaw) {
      toast.warning('Выберите заготовку');
      return;
    }
    setStartBusy(orderId);
    try {
      const shiftRes = await getMyShift();
      const shift = parseMyShiftFromResponse(shiftRes.data);
      if (!isPersonalShiftOpen(shift)) {
        toast.warning('Откройте смену в «Моя смена»');
        return;
      }
    } catch {
      /* бэк вернёт код */
    }
    try {
      await startProductionRequest(orderId, [
        {
          orderLineId: orderLineApiId(row.line),
          profileId: row.line.profile_id != null ? Number(row.line.profile_id) : null,
          blankId: Number(blankRaw),
        },
      ]);
      await refetch();
      setBlankByLineKey((prev) => {
        const next = { ...prev };
        delete next[row.stateKey];
        return next;
      });
      setLineModal(null);
      toast.success('Запущено в ОТК');
    } catch (e) {
      toast.error(getProductionStartErrorMessage(e, 'Ошибка'));
    } finally {
      setStartBusy(null);
    }
  };

  const REQUEST_COLUMNS = [
    { key: 'client', label: 'Клиент', width: '1.1fr' },
    { key: 'profile', label: 'Профиль', width: '1.2fr' },
    { key: 'qty', label: 'Кол-во', width: '0.55fr', className: 'compact-list__cell--num' },
  ];

  return (
    <>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (!items || items.length === 0) && <EmptyState title="Нет заявок" />}
      {!loading && !error && items && items.length > 0 && visibleItems.length === 0 && (
        <EmptyState title="На выбранную дату заявок нет" />
      )}
      {!loading && !error && visibleItems.length > 0 && (
        <CompactList
          columns={REQUEST_COLUMNS}
          items={lineRows}
          getRowKey={(r) => r.id}
          renderCell={(row, key) => {
            if (key === 'client') return row.clientLabel || '—';
            if (key === 'profile') {
              return row.line ? lineProfileLabel(row.line, srcProfiles) : '—';
            }
            if (key === 'qty') {
              return row.line ? lineQuantityLabel(row.line) : '—';
            }
            return '—';
          }}
          onDetails={(row) => row.line && setLineModal(row)}
          showDetails={(row) => Boolean(row.line)}
        />
      )}
      {lineModal?.line ? (
        <RecordDetailsModal
          open
          onClose={() => setLineModal(null)}
          title={lineProfileLabel(lineModal.line, srcProfiles)}
          lead={`Клиент: ${lineModal.clientLabel || '—'}`}
          footer={(
            <>
              <button type="button" className="btn btn--secondary" onClick={() => setLineModal(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={startBusy === lineModal.order?.id}
                onClick={() => runStart(lineModal)}
              >
                {startBusy === lineModal.order?.id ? '…' : 'Запустить'}
              </button>
            </>
          )}
        >
          <DetailFields
            rows={[
              { label: 'Клиент', value: lineModal.clientLabel || '—' },
              { label: 'Кол-во', value: lineQuantityLabel(lineModal.line) },
            ]}
          />
          <div className="production-line-modal__field">
            <label className="production-line-modal__label">Заготовка</label>
            <SearchableSelect
              value={
                blankByLineKey[lineModal.stateKey] != null
                  ? String(blankByLineKey[lineModal.stateKey])
                  : ''
              }
              onChange={(v) =>
                setBlankByLineKey((prev) => ({
                  ...prev,
                  [lineModal.stateKey]: v != null ? String(v) : '',
                }))
              }
              options={buildLineBlankSelectOptions(
                blankCatalogOptions,
                lineModal.order,
                lineModal.line,
              )}
              placeholder="Выберите заготовку"
              disabled={startBusy === lineModal.order?.id}
            />
          </div>
        </RecordDetailsModal>
      ) : null}
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

const PRODUCED_COLUMNS = [
  { key: 'product', label: 'Товар', width: '1.4fr' },
  { key: 'defect', label: 'Вес', width: '0.65fr', className: 'compact-list__cell--num' },
  { key: 'date', label: 'Дата', width: '0.85fr' },
];

const ProductionProducedPanel = ({ runs, loading, error, onRetry, clientDateFilter }) => {
  const [viewRun, setViewRun] = useState(null);
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
        <EmptyState title="Пока нет выпусков" description="Запустите заявку во вкладке «В работе»." />
      )}
      {!loading && !error && runs && runs.length > 0 && visibleRuns.length === 0 && (
        <EmptyState title="На эту дату записей нет" />
      )}
      {!loading && !error && visibleRuns.length > 0 && (
        <CompactList
          columns={PRODUCED_COLUMNS}
          items={visibleRuns}
          getRowKey={(r) => r.id}
          renderCell={(run, key) => {
            if (key === 'product') return run.productName || '—';
            if (key === 'defect') return producedDefectLabel(run);
            if (key === 'date') return formatRunDateTime(run.createdAt);
            return '—';
          }}
          onDetails={(run) => setViewRun(run)}
        />
      )}
      {viewRun ? (
        <RecordDetailsModal
          open
          onClose={() => setViewRun(null)}
          title={viewRun.productName || 'Выпуск'}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setViewRun(null)}>
              Закрыть
            </button>
          )}
        >
          <DetailFields
            rows={[
              { label: 'Заготовка', value: viewRun.blankName || '—' },
              { label: 'Дата', value: formatRunDateTime(viewRun.createdAt) },
              { label: 'Брак', value: producedDefectLabel(viewRun) },
            ]}
          />
        </RecordDetailsModal>
      ) : null}
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
          В работе
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mainTab === 'produced'}
          className={`production-main-tabs__btn${mainTab === 'produced' ? ' production-main-tabs__btn--active' : ''}`}
          onClick={() => setMainTab('produced')}
        >
          Выпуск
        </button>
      </div>
      <div className="production-page__date-row">
        <ClientDateFilter
          value={clientDateFilter}
          onChange={setClientDateFilter}
          id="production-page-date-filter"
        />
      </div>
      <div className={`production-card production-card--client-requests production-card--${isRequests ? 'requests' : 'produced'}`}>
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
            toast.success('Сохранено');
            refetchBlankRuns();
          }}
        />
      )}
    </div>
  );
};

export default ProductionPage;
