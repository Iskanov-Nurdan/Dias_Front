import React, { useState, useMemo, useEffect, useSyncExternalStore } from 'react';
import {
  useServerQuery,
  formatQuantityDisplay,
  formatNumberForInput,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { Loading, EmptyState, ErrorState, useToast, SearchableSelect } from '../../../../shared/ui';
import { useOperationalRefetch } from '../../../../shared/realtime';
import ProduceBlankModal from '../ProduceBlankModal/ProduceBlankModal';
import { getLines } from '../../../lines/api/linesApi';
import { getOrderSelectSources } from '../../../orders/api/ordersApi';
import { startProductionRequest } from '../../api/productionApi';
import {
  subscribeBlankRuns,
  getBlankRunsSnapshot,
  loadBlankProductionRuns,
} from '../../../chemistry/lib/localBlankStore';
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

const pickRc = (r) => {
  if (!r) return '';
  if (r.label != null) {
    const lab = String(r.label).trim();
    if (lab) return lab;
  }
  const n =
    (typeof r.recipe === 'string' && r.recipe.trim())
    || (typeof r.recipe_name === 'string' && r.recipe_name.trim())
    || (typeof r.name === 'string' && r.name.trim())
    || (typeof r.product_name === 'string' && r.product_name.trim())
    || (typeof r.product === 'string' && r.product.trim());
  if (n) return n;
  return '';
};

const rqRecipe = (o, list) => {
  if (o?.recipe && typeof o.recipe === 'object') {
    const t = pickRc(o.recipe);
    if (t) return t;
  }
  if (o?.recipe_name && String(o.recipe_name).trim()) return String(o.recipe_name).trim();
  let rid = o?.recipe_id;
  if (rid == null && o?.recipe != null && typeof o.recipe !== 'object') rid = o.recipe;
  if (rid != null && Array.isArray(list)) {
    const row = list.find((r) => String(r.id) === String(rid));
    if (row) return pickRc(row);
  }
  if (rid != null) return '—';
  return '—';
};

const ProductionClientRequestsPanel = ({ queryEnabled }) => {
  const toast = useToast();
  const [lines, setLines] = useState([]);
  const [lineByOrder, setLineByOrder] = useState({});
  const [startBusy, setStartBusy] = useState(null);
  const [srcClients, setSrcClients] = useState([]);
  const [srcProfiles, setSrcProfiles] = useState([]);
  const [srcRecipes, setSrcRecipes] = useState([]);

  const q = useMemo(() => ({ page: 1, page_size: 200 }), []);
  const { items, loading, error, refetch } = useServerQuery('production/requests/', q, {
    enabled: queryEnabled,
  });

  useOperationalRefetch(['order', 'production_batch'], refetch, queryEnabled);

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
        setSrcRecipes(Array.isArray(data.recipes) ? data.recipes : []);
      })
      .catch(() => {
        setSrcClients([]);
        setSrcProfiles([]);
        setSrcRecipes([]);
      });
  }, []);

  const lineOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...lines.map((ln) => ({ value: String(ln.id), label: ln.name || `Линия ${ln.id}` })),
    ],
    [lines],
  );

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
    <>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && (!items || items.length === 0) && <EmptyState title="Нет заявок" />}
      {!loading && !error && items && items.length > 0 && (
        <div className="production-table-wrap">
          <div className="production-table production-table--client-rq">
            <div className="production-table__header">
              <span className="production-table__th">Клиент</span>
              <span className="production-table__th">Профиль</span>
              <span className="production-table__th">Рецепт</span>
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
                  <span className="production-table__cell-clip">{rqRecipe(o, srcRecipes)}</span>
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
                    <SearchableSelect
                      value={lineVal}
                      onChange={(v) => setLineByOrder((prev) => ({ ...prev, [o.id]: v != null ? String(v) : '' }))}
                      options={lineOptions}
                      placeholder="—"
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

const ProductionProducedPanel = () => {
  useSyncExternalStore(subscribeBlankRuns, getBlankRunsSnapshot, getBlankRunsSnapshot);
  const runs = loadBlankProductionRuns();

  return (
    <>
      {runs.length === 0 && (
        <EmptyState title="Пока нет записей — нажмите «Произвести» во вкладке «Заявки»" />
      )}
      {runs.length > 0 && (
        <div className="production-table-wrap">
          <div className="production-table production-table--produced-local">
            <div className="production-table__header">
              <span className="production-table__th">Товар</span>
              <span className="production-table__th">Заготовка</span>
              <span className="production-table__th">Дата</span>
              <span className="production-table__th production-table__th--num">Брак</span>
            </div>
            {runs.map((run) => (
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

const ProductionPage = () => {
  const toast = useToast();
  const [mainTab, setMainTab] = useState('requests');
  const [produceBlankOpen, setProduceBlankOpen] = useState(false);
  const isRequests = mainTab === 'requests';

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
        {isRequests ? <ProductionClientRequestsPanel queryEnabled /> : null}
        {mainTab === 'produced' ? <ProductionProducedPanel /> : null}
      </div>
      {produceBlankOpen && (
        <ProduceBlankModal
          onClose={() => setProduceBlankOpen(false)}
          onSaved={() => toast.show('Сохранено')}
        />
      )}
    </div>
  );
};

export default ProductionPage;
