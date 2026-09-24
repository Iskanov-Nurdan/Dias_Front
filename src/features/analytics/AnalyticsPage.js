import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Layers, Box, CloudSnow, Plus, Download, LayoutDashboard, ReceiptText,
} from 'lucide-react';
import { PrimaryTabs, Subtabs, Fab, ErrorState, Skeleton } from '../../shared/ui';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import { fetchDashboard, fetchCategories } from './api';
import { presetRange, exportDashboard, exportEntries, dateRu } from './format';
import Overview from './components/Overview';
import EntriesTab from './components/EntriesTab';
import EntryFormModal from './components/EntryFormModal';
import KpiDetailsModal from './components/KpiDetailsModal';
import PeriodPresetFilter from './components/PeriodPresetFilter';
import './AnalyticsPage.scss';

const LINE_ITEMS = [
  { id: 'all', label: 'Все линии', shortLabel: 'Все', icon: Layers },
  { id: 'profile', label: 'Пластиковый профиль', shortLabel: 'Профиль', icon: Box },
  { id: 'foam', label: 'Пенополистирол', shortLabel: 'Пенопласт', icon: CloudSnow },
];

const OverviewSkeleton = () => (
  <div className="an-overview" aria-busy="true">
    <div className="an-kpis">
      {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} variant="card" className="an-kpi-skel" />)}
    </div>
    <Skeleton variant="card" className="an-chart-skel" />
    <div className="an-grid">
      <Skeleton variant="card" className="an-chart-skel" />
      <Skeleton variant="card" className="an-chart-skel" />
    </div>
  </div>
);

/**
 * Аналитика. Все цифры считает сервер (GET /analytics/dashboard/) — фронт
 * только показывает и даёт расшифровку каждой цифры. Финансовый блок
 * (маржа/прибыль/расходы/реестр) — только при ключе analytics_finance: сервер
 * сам отдаёт эти поля null, а data.finance_access говорит, что рисовать.
 *
 * Верх страницы — как в остальных разделах: PrimaryTabs (линия) + главное
 * действие в той же строке (на мобиле — Fab), ниже одна строка: Subtabs
 * слева, период и выгрузка справа.
 */
const AnalyticsPage = () => {
  const [line, setLine] = useState('all');
  const [preset, setPreset] = useState('month');
  const [custom, setCustom] = useState(() => presetRange('month'));
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState([]);
  const [entryModal, setEntryModal] = useState(null); // { entry|null }
  const [kpiOpen, setKpiOpen] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [entriesVisible, setEntriesVisible] = useState([]);

  const range = useMemo(
    () => (preset === 'custom' ? custom : presetRange(preset)),
    [preset, custom],
  );
  const query = useMemo(() => ({ ...range, line }), [range, line]);
  const finance = Boolean(data?.finance_access);

  const load = useCallback((signal) => {
    setLoading(true);
    setError(null);
    return fetchDashboard(query, signal)
      .then(setData)
      .catch((err) => { if (err.name !== 'CanceledError') setError(getApiErrorMessage(err)); })
      .finally(() => setLoading(false));
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, reloadKey]);

  useEffect(() => {
    if (!finance) return undefined;
    const controller = new AbortController();
    fetchCategories(controller.signal).then(setCategories).catch(() => {});
    return () => controller.abort();
  }, [finance]);

  useEffect(() => { if (data && !finance && tab === 'entries') setTab('overview'); }, [data, finance, tab]);

  const openNewEntry = () => setEntryModal({ entry: null });
  const applyPeriod = (nextPreset, nextCustom) => {
    setPreset(nextPreset);
    if (nextPreset === 'custom') setCustom(nextCustom);
  };
  const canExport = tab === 'entries' ? entriesVisible.length > 0 : Boolean(data) && !loading;
  const runExport = () => (tab === 'entries' ? exportEntries(entriesVisible, range) : exportDashboard(data));

  const tabs = [{ id: 'overview', label: 'Обзор', icon: LayoutDashboard }];
  if (finance) tabs.push({ id: 'entries', label: 'Расходы и доходы', icon: ReceiptText });

  return (
    <div className="an-page">
      <PrimaryTabs
        items={LINE_ITEMS}
        activeId={line}
        onChange={setLine}
        action={finance && (
          <button type="button" className="an-page__add" onClick={openNewEntry}>
            <Plus size={16} /> Расход / доход
          </button>
        )}
      />

      <div className={`an-page__bar${tabs.length > 1 ? '' : ' an-page__bar--solo'}`}>
        {tabs.length > 1 && (
          <div className="an-page__bar-tabs">
            <Subtabs items={tabs} activeId={tab} onChange={setTab} />
          </div>
        )}
        <div className="an-page__bar-tools">
          <PeriodPresetFilter preset={preset} custom={custom} onApply={applyPeriod} />
          <button
            type="button"
            className="an-page__ghost an-page__export"
            onClick={runExport}
            disabled={!canExport}
            aria-label="Выгрузить в Excel"
            title="Выгрузить в Excel"
          >
            <Download size={16} /><span className="an-page__export-label">Excel</span>
          </button>
        </div>
      </div>

      {tab === 'overview' && (
        <>
          {error && <ErrorState message={error} onRetry={() => load(null)} />}
          {!error && !data && <OverviewSkeleton />}
          {!error && data && (
            <div className={loading ? 'an-page__stale' : ''}>
              <p className="an-page__compare">
                Сравнение с {dateRu(data.period.previous_from)} — {dateRu(data.period.previous_to)}
              </p>
              <Overview data={data} onOpenKpi={setKpiOpen} showLineTags={line === 'all'} />
            </div>
          )}
        </>
      )}

      {tab === 'entries' && finance && (
        <EntriesTab
          range={range}
          reloadKey={reloadKey}
          onEdit={(entry) => setEntryModal({ entry })}
          onChanged={() => setReloadKey((k) => k + 1)}
          onVisibleChange={setEntriesVisible}
        />
      )}

      {finance && <Fab onClick={openNewEntry} label="Добавить расход или доход" />}

      {entryModal && (
        <EntryFormModal
          entry={entryModal.entry}
          categories={categories}
          onClose={() => setEntryModal(null)}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}

      {kpiOpen && <KpiDetailsModal kpi={kpiOpen} range={query} onClose={() => setKpiOpen(null)} />}
    </div>
  );
};

export default AnalyticsPage;
