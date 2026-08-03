import React, { useMemo, useState } from 'react';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { Badge, ClientDateFilter, EmptyState, useToast } from '../../../../shared/ui';
import { useAuth } from '../../../auth';
import {
  foamDensityToleranceFor,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamFormatParamsLabel,
} from '../../../foam/mockData';
import { useFoamStore, resolveOtkRun, reopenOtkRun } from '../../../foam/store';
import './OtkFoamTab.scss';

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

const STATUS_BADGE = {
  pending: { variant: 'warning', label: 'Ожидает проверки' },
  accepted: { variant: 'success', label: 'Принято' },
  rejected: { variant: 'danger', label: 'Брак' },
};

const MAX_DEFECT_PERCENT = 3;

const InspectModal = ({ item, grades, inspectorName, onClose, onSave }) => {
  const tolerance = foamDensityToleranceFor(item.gradeCode, grades);
  const [measuredDensity, setMeasuredDensity] = useState('');
  const [defectPercent, setDefectPercent] = useState('');

  const densityNum = Number(measuredDensity);
  const densityFilled = measuredDensity !== '' && Number.isFinite(densityNum);
  const densityOk = densityFilled && densityNum >= tolerance.min && densityNum <= tolerance.max;
  const defectFilled = defectPercent !== '' && Number.isFinite(Number(defectPercent));
  const defectNum = defectFilled ? Number(defectPercent) : 0;
  const defectOk = defectFilled && defectNum <= MAX_DEFECT_PERCENT;
  const canSubmit = densityFilled && defectFilled;
  const willAccept = densityOk && defectOk;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    resolveOtkRun(item.id, {
      measuredDensityKgM3: densityNum,
      defectPercent: defectNum,
      otkStatus: willAccept ? 'accepted' : 'rejected',
      inspector: inspectorName,
    });
    onSave(willAccept);
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Приёмка партии {item.lotNumber}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <p className="otk-foam-tab__norm">
            Формат: {foamOutputFormatLabel(item.outputFormat)} ({foamFormatParamsLabel(item)}), {item.outputQty} {foamOutputUnitLabel(item.outputFormat)}
          </p>
          <label>Замер плотности, кг/м³ (норма {tolerance.min}–{tolerance.max})</label>
          <input
            type="number"
            step="0.1"
            placeholder="Введите реальный замер"
            value={measuredDensity}
            onChange={(ev) => setMeasuredDensity(ev.target.value)}
            required
          />
          <label>Брак, % (допустимо ≤ {MAX_DEFECT_PERCENT})</label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="Введите % брака"
            value={defectPercent}
            onChange={(ev) => setDefectPercent(ev.target.value)}
            required
          />

          {(densityFilled || defectFilled) && (
            <div className="otk-foam-tab__checks">
              <span className={`otk-foam-tab__check-row otk-foam-tab__check-row--${densityOk ? 'ok' : 'fail'}`}>
                {densityOk ? '✓' : '✕'} Плотность {densityFilled ? formatNumberForInput(densityNum) : '—'} кг/м³ {densityFilled ? (densityOk ? 'в норме' : 'вне нормы') : ''}
              </span>
              <span className={`otk-foam-tab__check-row otk-foam-tab__check-row--${defectOk ? 'ok' : 'fail'}`}>
                {defectOk ? '✓' : '✕'} Брак {defectFilled ? `${formatNumberForInput(defectNum)}%` : '—'} {defectFilled ? (defectOk ? `в допуске (≤${MAX_DEFECT_PERCENT}%)` : `выше допуска (>${MAX_DEFECT_PERCENT}%)`) : ''}
              </span>
            </div>
          )}

          {canSubmit && (
            <p className={`otk-foam-tab__verdict otk-foam-tab__verdict--${willAccept ? 'ok' : 'fail'}`}>
              {willAccept
                ? 'Партия будет принята на склад'
                : 'Партия будет отмечена как брак (в остаток склада не попадёт)'}
            </p>
          )}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={!canSubmit}>Сохранить проверку</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const OtkFoamTab = () => {
  const toast = useToast();
  const { user } = useAuth();
  const { productionRuns, densityGrades } = useFoamStore();
  const [mainTab, setMainTab] = useState('pool');
  const [inspectTarget, setInspectTarget] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');

  const inspectorName = user?.name || user?.role_name || 'Инспектор ОТК';

  const pool = useMemo(() => productionRuns.filter((r) => r.otkStatus === 'pending'), [productionRuns]);
  const history = useMemo(() => productionRuns.filter((r) => r.otkStatus !== 'pending'), [productionRuns]);

  const stats = useMemo(() => {
    const accepted = history.filter((r) => r.otkStatus === 'accepted').length;
    const rejected = history.filter((r) => r.otkStatus === 'rejected').length;
    return { pending: pool.length, accepted, rejected };
  }, [pool, history]);

  const visiblePool = useMemo(() => {
    if (!dateFilterIso) return pool;
    return pool.filter((p) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(p, ['producedAt'])));
  }, [pool, dateFilterIso]);

  const visibleHistory = useMemo(() => {
    if (!dateFilterIso) return history;
    return history.filter((h) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(h, ['checkedAt'])));
  }, [history, dateFilterIso]);

  const handleSaved = (accepted) => {
    toast[accepted ? 'success' : 'error'](accepted ? 'Партия принята, склад пополнен' : 'Партия отмечена как брак');
  };

  const handleReopen = (run) => {
    reopenOtkRun(run.id);
    toast.success(`Партия ${run.lotNumber} возвращена на повторную проверку`);
  };

  return (
    <div className="otk-foam-tab">
      <div className="otk-foam-tab__stats">
        <div className="otk-foam-tab__stat">
          <span className="otk-foam-tab__stat-value">{stats.pending}</span>
          <span className="otk-foam-tab__stat-label">Ожидают проверки</span>
        </div>
        <div className="otk-foam-tab__stat">
          <span className="otk-foam-tab__stat-value">{stats.accepted}</span>
          <span className="otk-foam-tab__stat-label">Принято</span>
        </div>
        <div className="otk-foam-tab__stat">
          <span className="otk-foam-tab__stat-value">{stats.rejected}</span>
          <span className="otk-foam-tab__stat-label">Брак</span>
        </div>
      </div>

      <div className="otk-page__tabs production-main-tabs" role="tablist" aria-label="Разделы ОТК пенопласта">
        {[
          ['pool', 'Проверки'],
          ['history', 'История'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mainTab === key}
            className={`production-main-tabs__btn${mainTab === key ? ' production-main-tabs__btn--active' : ''}`}
            onClick={() => setMainTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="otk-card">
        <div className="otk-card__toolbar ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <h2 className="otk-card__title">{mainTab === 'pool' ? 'Партии пенопласта на приёмке' : 'История проверок'}</h2>
            <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="otk-foam-date" />
          </div>
        </div>

        {mainTab === 'pool' && (
          visiblePool.length === 0 ? (
            <EmptyState title="Нет партий, ожидающих ОТК" description="Партии появятся здесь после запуска производства." />
          ) : (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table otk-foam-tab__table">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Лот</span>
                  <span className="chemistry-table__th">Плотность</span>
                  <span className="chemistry-table__th">Формат</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Выход</span>
                  <span className="chemistry-table__th">Статус</span>
                  <span className="chemistry-table__th chemistry-table__th--actions"> </span>
                </div>
                {visiblePool.map((p) => (
                  <div key={p.id} className="chemistry-table__row">
                    <span className="chemistry-table__name chemistry-table__cell-clip">{p.lotNumber}</span>
                    <span className="chemistry-table__cell-clip">{p.gradeCode}</span>
                    <span className="chemistry-table__cell-clip">
                      {foamOutputFormatLabel(p.outputFormat)}
                      <span className="otk-foam-tab__grade">{foamFormatParamsLabel(p)}</span>
                    </span>
                    <span className="chemistry-table__num">{p.outputQty} {foamOutputUnitLabel(p.outputFormat)}</span>
                    <span><Badge variant="warning" size="sm">Ожидает проверки</Badge></span>
                    <span className="chemistry-table__actions">
                      <button type="button" className="btn btn--primary btn--sm" onClick={() => setInspectTarget(p)}>
                        Принять партию
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}

        {mainTab === 'history' && (
          visibleHistory.length === 0 ? (
            <EmptyState title="Проверок пока нет" />
          ) : (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table otk-foam-tab__history-table">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Лот</span>
                  <span className="chemistry-table__th">Формат</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Плотность</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Брак</span>
                  <span className="chemistry-table__th">Инспектор</span>
                  <span className="chemistry-table__th">Статус</span>
                  <span className="chemistry-table__th chemistry-table__th--actions"> </span>
                </div>
                {visibleHistory.map((h) => {
                  const badge = STATUS_BADGE[h.otkStatus] || STATUS_BADGE.pending;
                  return (
                    <div key={h.id} className="chemistry-table__row">
                      <span className="chemistry-table__name chemistry-table__cell-clip">
                        {h.lotNumber} <span className="otk-foam-tab__grade">{h.gradeCode}</span>
                      </span>
                      <span className="chemistry-table__cell-clip">{foamOutputFormatLabel(h.outputFormat)}</span>
                      <span className="chemistry-table__num">{formatNumberForInput(h.measuredDensityKgM3)} кг/м³</span>
                      <span className="chemistry-table__num">{formatNumberForInput(h.defectPercent)}%</span>
                      <span className="chemistry-table__cell-clip">{h.inspector || '—'}</span>
                      <span><Badge variant={badge.variant} size="sm">{badge.label}</Badge></span>
                      <span className="chemistry-table__actions">
                        {h.otkStatus === 'rejected' && (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => handleReopen(h)}>
                            Пересмотреть
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {inspectTarget && (
        <InspectModal
          item={inspectTarget}
          grades={densityGrades}
          inspectorName={inspectorName}
          onClose={() => setInspectTarget(null)}
          onSave={handleSaved}
        />
      )}
    </div>
  );
};

export default OtkFoamTab;
