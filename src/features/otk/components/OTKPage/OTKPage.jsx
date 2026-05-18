import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { EmptyState, useToast, DecimalInput, Loading, ErrorState, ClientDateFilter } from '../../../../shared/ui';
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

const formatDateTime = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  if (s.length >= 19) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 19)}`;
  return s.slice(0, 10);
};

const resolveRunTotals = (run) => {
  if (!run) {
    return {
      recipeKg: null,
      usedKg: 0,
      vatKg: DEMO_PRODUCTION_VAT_MAX_KG,
    };
  }
  let recipe = run.blankTotalKg != null ? Number(run.blankTotalKg) : NaN;
  let used = run.blankUsedInProductionKg != null ? Number(run.blankUsedInProductionKg) : NaN;
  if (!Number.isFinite(used)) {
    used = Number.isFinite(recipe) ? recipe : 0;
  }
  if (!Number.isFinite(recipe)) {
    recipe = Number.isFinite(used) ? used : null;
  }
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
  return '—';
};

const gpFlowStatus = (run) => {
  if (run.gpAcceptedAt) return 'Принято складом ГП';
  if (isBlankRunOtkRecorded(run)) return 'Ожидает склад ГП';
  return '—';
};

const BlankRunOtkDetailModal = ({ run, onClose, onSaved }) => {
  const toast = useToast();
  const { recipeKg, usedKg, vatKg } = useMemo(() => resolveRunTotals(run), [run]);

  const [defectDraft, setDefectDraft] = useState('');
  const [saving, setSaving] = useState(false);

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
      toast.show('Укажите брак, кг (≥ 0). Можно 0, если брака нет');
      return;
    }
    if (noMass && defectNum > 0) {
      toast.show('Нет массы заготовки в записи — оформите выпуск заново на производстве');
      return;
    }
    if (overUsed) {
      toast.show(`Брак не больше ${formatNumberForInput(usedKg)} кг`);
      return;
    }
    setSaving(true);
    try {
      await postWorkshopRunOtkDefect(run.id, { defect_kg: defectNum });
      toast.show(
        'Сохранено. Строка на склад ГП; возврат брака в заготовку выполняет сервер (см. API).',
      );
      onSaved?.();
      onClose();
    } catch (err) {
      toast.show(getApiErrorMessage(err, 'Не удалось сохранить'));
    } finally {
      setSaving(false);
    }
  };

  if (!run) return null;

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div
        className="modal modal--wide otk-blank-detail-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="otk-blank-detail-heading"
      >
        <div className="modal__head">
          <h3 id="otk-blank-detail-heading">Учёт: {run.productName || 'Товар'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <form className="modal__body otk-blank-detail-modal__body" onSubmit={handleSave}>
          <p className="otk-blank-detail-modal__lede">
            Укажите брак в килограммах; если брака нет — 0. После сохранения масса брака должна
            вернуться в остаток заготовки в цехе; годный объём и штуки — на складе ГП.
          </p>
          <div className="otk-modal-summary otk-blank-detail-modal__summary">
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Заготовка по составу (рецепт)</span>
              <span className="otk-modal-summary__value">
                {recipeKg != null ? `${formatNumberForInput(recipeKg)} кг` : '—'}
              </span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Ёмкость партии (демо, макс.)</span>
              <span className="otk-modal-summary__value">до {formatNumberForInput(vatKg)} кг</span>
            </div>
            <div className="otk-modal-summary__item">
              <span className="otk-modal-summary__label">Заготовка ушла в производство</span>
              <span className="otk-modal-summary__value">
                {usedKg > 0 ? `${formatNumberForInput(usedKg)} кг` : '—'}
              </span>
            </div>
          </div>

          <div className="otk-blank-detail-modal__field">
            <label htmlFor="otk-defect-kg">Брак, кг (можно 0)</label>
            <DecimalInput
              id="otk-defect-kg"
              min={0}
              value={defectDraft}
              onChange={setDefectDraft}
              placeholder="0"
            />
          </div>

          {noMass ? (
            <p className="modal__error otk-blank-detail-modal__hint">
              В записи нет массы заготовки. Создайте выпуск через «Произвести».
            </p>
          ) : null}
          {overUsed ? (
            <p className="modal__error">Брак не может превысить массу, ушедшую в производство.</p>
          ) : null}

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={overUsed || saving}>
              {saving ? '…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const runsQuery = { page: 1, page_size: 200, ordering: '-created_at' };

const BlankProductionOtkPanel = () => {
  const [detailRun, setDetailRun] = useState(null);
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

  const handleSaved = useCallback(() => {
    refetch();
  }, [refetch]);

  return (
    <div className="otk-card">
      <div className="otk-card__toolbar">
        <h2 className="otk-card__title">Заявки</h2>
        <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="otk-date-filter" />
      </div>
      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={refetch} />}
      {!loading && !error && runs.length === 0 && (
        <EmptyState title="Пока нет записей — на производстве нажмите «Произвести»" />
      )}
      {!loading && !error && runs.length > 0 && visibleRuns.length === 0 && (
        <EmptyState title="На выбранную дату записей нет" />
      )}
      {!loading && !error && visibleRuns.length > 0 && (
        <div className="otk-table otk-table--blank-runs">
          <div className="otk-table__header">
            <span className="otk-table__th">Товар</span>
            <span className="otk-table__th">Заготовка</span>
            <span className="otk-table__th">Дата</span>
            <span className="otk-table__th otk-table__th--narrow">Брак</span>
            <span className="otk-table__th">Статус ГП</span>
            <span className="otk-table__th otk-table__th--actions" aria-hidden="true" />
          </div>
          {visibleRuns.map((run) => (
            <div key={run.id} className="otk-table__row">
              <span className="otk-table__cell-clip">{run.productName || '—'}</span>
              <span className="otk-table__cell-clip">{run.blankName || '—'}</span>
              <span>{formatDateTime(run.createdAt)}</span>
              <span className="otk-table__num-like">{defectKgDisplay(run)}</span>
              <span className="otk-table__muted">{gpFlowStatus(run)}</span>
              <span className="otk-table__actions-cell">
                {isBlankRunOtkRecorded(run) ? (
                  <span className="otk-table__muted">—</span>
                ) : (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={() => setDetailRun(run)}
                  >
                    Товар
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {detailRun ? (
        <BlankRunOtkDetailModal
          run={detailRun}
          onClose={() => setDetailRun(null)}
          onSaved={handleSaved}
        />
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
