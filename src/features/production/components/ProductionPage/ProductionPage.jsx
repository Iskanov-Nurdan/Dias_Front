import React, { useMemo, useState } from 'react';
import {
  useServerQuery,
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import {
  Loading,
  EmptyState,
  ErrorState,
  useToast,
  ClientDateFilter,
  CompactList,
  RecordDetailsModal,
  DetailFields,
  ProductLineTabs,
} from '../../../../shared/ui';
import { useProductLine, PRODUCT_LINE } from '../../../../shared/hooks';
import { useOperationalRefetch, WS_PRODUCTION } from '../../../../shared/realtime';
import ProduceBlankModal from '../ProduceBlankModal/ProduceBlankModal';
import { mapBlankProductionRunFromApi } from '../../../chemistry/api/blankWorkshopApi';
import { resolveUsedKgForRun } from '../../../chemistry/lib/workshopRunUtils';
import ProductionFoamTab from '../ProductionFoamTab/ProductionFoamTab';
import './ProductionPage.scss';

const formatRunDateTime = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};

const PRODUCED_COLUMNS = [
  { key: 'blank', label: 'Заготовка', width: '1.4fr' },
  { key: 'kg', label: 'Кг', width: '0.65fr', className: 'compact-list__cell--num' },
  { key: 'date', label: 'Дата', width: '0.85fr' },
];

const blankRunsQuery = { page: 1, page_size: 200, ordering: '-created_at' };

const ProductionPage = () => {
  const toast = useToast();
  const [line, setLine] = useProductLine();
  const [produceBlankOpen, setProduceBlankOpen] = useState(false);
  const [clientDateFilter, setClientDateFilter] = useState('');
  const [viewRun, setViewRun] = useState(null);

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

  const visibleRuns = useMemo(() => {
    const list = mappedRuns || [];
    if (!clientDateFilter) return list;
    return list.filter((run) =>
      matchesClientDateFilter(clientDateFilter, pickFirstIsoDate(run, ['createdAt'])),
    );
  }, [mappedRuns, clientDateFilter]);

  useOperationalRefetch(WS_PRODUCTION, refetchBlankRuns, true);

  if (line === PRODUCT_LINE.FOAM) {
    return (
      <div className="page page--production">
        <ProductLineTabs value={line} onChange={setLine} />
        <ProductionFoamTab />
      </div>
    );
  }

  return (
    <div className="page page--production">
      <ProductLineTabs value={line} onChange={setLine} />
      <div className="production-page__date-row">
        <ClientDateFilter
          value={clientDateFilter}
          onChange={setClientDateFilter}
          id="production-page-date-filter"
        />
      </div>

      <div className="production-card production-card--produced">
        <div className="production-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <h2 className="production-card__title">Выпуски заготовки</h2>
          </div>
          <div className="ds-toolbar__end production-card__toolbar-actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setProduceBlankOpen(true)}
            >
              Произвести
            </button>
          </div>
        </div>

        {runsLoading && <Loading />}
        {runsError && <ErrorState error={runsError} onRetry={refetchBlankRuns} />}
        {!runsLoading && !runsError && mappedRuns.length === 0 && (
          <EmptyState title="Пока нет выпусков" description="Нажмите «Произвести» — заготовка уйдёт в ОТК." />
        )}
        {!runsLoading && !runsError && mappedRuns.length > 0 && visibleRuns.length === 0 && (
          <EmptyState title="На эту дату записей нет" />
        )}
        {!runsLoading && !runsError && visibleRuns.length > 0 && (
          <CompactList
            columns={PRODUCED_COLUMNS}
            items={visibleRuns}
            getRowKey={(r) => r.id}
            renderCell={(run, key) => {
              if (key === 'blank') return run.blankName || '—';
              if (key === 'kg') return `${formatNumberForInput(resolveUsedKgForRun(run))} кг`;
              if (key === 'date') return formatRunDateTime(run.createdAt);
              return '—';
            }}
            onDetails={(run) => setViewRun(run)}
          />
        )}
      </div>

      {produceBlankOpen && (
        <ProduceBlankModal
          onClose={() => setProduceBlankOpen(false)}
          onSaved={() => {
            toast.success('Выпуск отправлен в ОТК');
            refetchBlankRuns();
          }}
        />
      )}

      {viewRun ? (
        <RecordDetailsModal
          open
          onClose={() => setViewRun(null)}
          title={viewRun.blankName || 'Выпуск'}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setViewRun(null)}>
              Закрыть
            </button>
          )}
        >
          <DetailFields
            rows={[
              { label: 'Заготовка', value: viewRun.blankName || '—' },
              { label: 'Кг', value: `${formatNumberForInput(resolveUsedKgForRun(viewRun))} кг` },
              { label: 'Дата', value: formatRunDateTime(viewRun.createdAt) },
            ]}
          />
        </RecordDetailsModal>
      ) : null}
    </div>
  );
};

export default ProductionPage;
