import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useOperationalRefetch, WS_OTK } from '../../../../shared/realtime';
import {
  EmptyState,
  useToast,
  DecimalInput,
  Loading,
  ErrorState,
  ClientDateFilter,
  CompactList,
  RecordDetailsModal,
  DetailFields,
  Badge,
} from '../../../../shared/ui';
import {
  parseLocaleNumber,
  formatNumberForInput,
  useServerQuery,
  getApiErrorMessage,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { DEMO_PRODUCTION_VAT_MAX_KG } from '../../../chemistry/lib/blankRecipeShared';
import {
  mapBlankProductionRunFromApi,
  postWorkshopRunOtkDefect,
} from '../../../chemistry/api/blankWorkshopApi';
import { isBlankRunOtkRecorded } from '../../../chemistry/lib/workshopRunUtils';
import './OTKPage.scss';

const formatDateShort = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

const resolveRunTotals = (run) => {
  if (!run) {
    return { recipeKg: null, usedKg: 0, vatKg: DEMO_PRODUCTION_VAT_MAX_KG };
  }
  let recipe = run.blankTotalKg != null ? Number(run.blankTotalKg) : NaN;
  let used = run.blankUsedInProductionKg != null ? Number(run.blankUsedInProductionKg) : NaN;
  if (!Number.isFinite(used)) used = Number.isFinite(recipe) ? recipe : 0;
  if (!Number.isFinite(recipe)) recipe = Number.isFinite(used) ? used : null;
  const vat = Number(run.vatMaxKgDemo);
  const vatKg = Number.isFinite(vat) && vat > 0 ? vat : DEMO_PRODUCTION_VAT_MAX_KG;
  return {
    recipeKg: Number.isFinite(recipe) ? recipe : null,
    usedKg: Number.isFinite(used) ? used : 0,
    vatKg,
  };
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

const defectKgDisplay = (run) => {
  if (run.defectKg != null && Number.isFinite(Number(run.defectKg))) {
    return `${formatNumberForInput(run.defectKg)} кг`;
  }
  const leg = legacyDefectSumKg(run);
  if (leg != null) return `${formatNumberForInput(leg)} кг`;
  return '0 кг';
};

const gpFlowStatus = (run) => {
  if (run.gpAcceptedAt) return 'На складе';
  if (isBlankRunOtkRecorded(run)) return 'Ждёт склад';
  return 'Нужен учёт';
};

const OTK_COLUMNS = [
  { key: 'product', label: 'Изделие', width: '1.4fr' },
  { key: 'defect', label: 'Брак', width: '0.7fr', className: 'compact-list__cell--num' },
  { key: 'status', label: 'Статус', width: '0.9fr' },
];

const BlankRunOtkDetailModal = ({ run, onClose, onSaved }) => {
  const toast = useToast();
  const { recipeKg, usedKg, vatKg } = useMemo(() => resolveRunTotals(run), [run]);
  const [defectDraft, setDefectDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const needsOtk = run && !isBlankRunOtkRecorded(run);

  useEffect(() => {
    if (!run) return;
    if (run.defectKg != null && Number.isFinite(Number(run.defectKg))) {
      setDefectDraft(formatNumberForInput(Number(run.defectKg)));
    } else {
      const leg = legacyDefectSumKg(run);
      setDefectDraft(leg != null ? formatNumberForInput(leg) : '');
    }
  }, [run?.id, run?.defectKg]);

  const trimmed = String(defectDraft ?? '').trim();
  const defectNum = trimmed === '' ? 0 : parseLocaleNumber(defectDraft);
  const defectInputOk = trimmed === '' || Number.isFinite(defectNum);
  const overUsed =
    defectInputOk && Number.isFinite(defectNum) && usedKg > 0 && defectNum > usedKg;
  const noMass = usedKg <= 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!run?.id) return;
    if (!defectInputOk || !Number.isFinite(defectNum) || defectNum < 0) {
      toast.warning('Укажите брак в кг (можно 0)');
      return;
    }
    if (noMass && defectNum > 0) {
      toast.warning('Нет массы заготовки — оформите выпуск в производстве');
      return;
    }
    if (overUsed) {
      toast.warning(`Брак не больше ${formatNumberForInput(usedKg)} кг`);
      return;
    }
    setSaving(true);
    try {
      await postWorkshopRunOtkDefect(run.id, { defect_kg: defectNum });
      toast.success('Сохранено');
      onSaved?.();
      onClose();
    } catch (err) {
      toast.apiError(err, 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!run) return null;

  const footer = needsOtk ? (
    <>
      <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
        Закрыть
      </button>
      <button
        type="submit"
        form="otk-defect-form"
        className="btn btn--primary"
        disabled={overUsed || saving}
      >
        {saving ? '…' : 'Сохранить'}
      </button>
    </>
  ) : (
    <button type="button" className="btn btn--secondary" onClick={onClose}>
      Закрыть
    </button>
  );

  return (
    <RecordDetailsModal
      open
      onClose={onClose}
      title={run.productName || 'Изделие'}
      lead={needsOtk ? 'Укажите брак в кг. Если брака нет — 0.' : null}
      footer={footer}
      wide
    >
      <DetailFields
        rows={[
          { label: 'Заготовка', value: run.blankName || '—' },
          { label: 'Дата', value: formatDateShort(run.createdAt) },
          { label: 'Статус', value: gpFlowStatus(run) },
          { label: 'По рецепту', value: recipeKg != null ? `${formatNumberForInput(recipeKg)} кг` : '—' },
          { label: 'В производстве', value: usedKg > 0 ? `${formatNumberForInput(usedKg)} кг` : '—' },
          { label: 'Ёмкость (макс.)', value: `до ${formatNumberForInput(vatKg)} кг` },
        ]}
      />
      {needsOtk ? (
        <form id="otk-defect-form" className="otk-defect-form" onSubmit={handleSave}>
          <label htmlFor="otk-defect-kg" className="otk-defect-form__label">
            Брак, кг
          </label>
          <DecimalInput
            id="otk-defect-kg"
            min={0}
            value={defectDraft}
            onChange={setDefectDraft}
            placeholder="0"
          />
          {noMass ? (
            <p className="otk-defect-form__hint">Сначала оформите выпуск в разделе «Производство».</p>
          ) : null}
          {overUsed ? (
            <p className="modal__error">Брак не больше массы в производстве.</p>
          ) : null}
        </form>
      ) : null}
    </RecordDetailsModal>
  );
};

const runsQuery = { page: 1, page_size: 200, ordering: '-created_at' };

const BlankProductionOtkPanel = () => {
  const [detailRun, setDetailRun] = useState(null);
  const [viewRun, setViewRun] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');
  const { items, loading, error, refetch } = useServerQuery(
    'workshop/blank-production-runs/',
    runsQuery,
    { enabled: true },
  );
  const runs = useMemo(
    () => (items || []).map(mapBlankProductionRunFromApi).filter(Boolean),
    [items],
  );

  const visibleRuns = useMemo(() => {
    if (!dateFilterIso) return runs;
    return runs.filter((run) =>
      matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(run, ['createdAt'])),
    );
  }, [runs, dateFilterIso]);

  const sortedRuns = useMemo(() => {
    return [...visibleRuns].sort((a, b) => {
      const pendingA = !isBlankRunOtkRecorded(a) ? 0 : 1;
      const pendingB = !isBlankRunOtkRecorded(b) ? 0 : 1;
      if (pendingA !== pendingB) return pendingA - pendingB;
      const da = pickFirstIsoDate(a, ['createdAt']) || '';
      const db = pickFirstIsoDate(b, ['createdAt']) || '';
      return db.localeCompare(da);
    });
  }, [visibleRuns]);

  const handleSaved = useCallback(() => {
    refetch();
  }, [refetch]);

  useOperationalRefetch(WS_OTK, refetch, true);

  const openDetails = (run) => {
    if (!isBlankRunOtkRecorded(run)) {
      setDetailRun(run);
      setViewRun(null);
    } else {
      setViewRun(run);
      setDetailRun(null);
    }
  };

  return (
    <div className="otk-card">
      <div className="otk-card__toolbar">
        <h2 className="otk-card__title">Проверки</h2>
        <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="otk-date-filter" />
      </div>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && runs.length === 0 && (
        <EmptyState title="Пока нет выпусков" description="Оформите выпуск в «Производство»." />
      )}
      {!loading && !error && runs.length > 0 && visibleRuns.length === 0 && (
        <EmptyState title="На эту дату записей нет" />
      )}
      {!loading && !error && visibleRuns.length > 0 && (
        <CompactList
          columns={OTK_COLUMNS}
          items={sortedRuns}
          getRowKey={(r) => r.id}
          rowClassName={(run) =>
            (!isBlankRunOtkRecorded(run) ? 'compact-list__row--attention' : '')
          }
          renderCell={(run, key) => {
            if (key === 'product') return run.productName || '—';
            if (key === 'defect') return defectKgDisplay(run);
            if (key === 'status') {
              const label = gpFlowStatus(run);
              if (!isBlankRunOtkRecorded(run)) {
                return <Badge variant="warning">{label}</Badge>;
              }
              if (run.gpAcceptedAt) {
                return <Badge variant="success">{label}</Badge>;
              }
              return <span className="compact-list__status-muted">{label}</span>;
            }
            return '—';
          }}
          detailsLabel={(run) => (!isBlankRunOtkRecorded(run) ? 'Учесть' : 'Подробнее')}
          onDetails={openDetails}
        />
      )}
      {detailRun ? (
        <BlankRunOtkDetailModal
          run={detailRun}
          onClose={() => setDetailRun(null)}
          onSaved={handleSaved}
        />
      ) : null}
      {viewRun ? (
        <RecordDetailsModal
          open
          onClose={() => setViewRun(null)}
          title={viewRun.productName || 'Изделие'}
          footer={(
            <button type="button" className="btn btn--secondary" onClick={() => setViewRun(null)}>
              Закрыть
            </button>
          )}
        >
          <DetailFields
            rows={[
              { label: 'Заготовка', value: viewRun.blankName || '—' },
              { label: 'Дата', value: formatDateShort(viewRun.createdAt) },
              { label: 'Брак', value: defectKgDisplay(viewRun) },
              { label: 'Статус', value: gpFlowStatus(viewRun) },
            ]}
          />
        </RecordDetailsModal>
      ) : null}
    </div>
  );
};

const OTKPage = () => (
  <div className="page page--otk">
    <BlankProductionOtkPanel />
  </div>
);

export default OTKPage;
