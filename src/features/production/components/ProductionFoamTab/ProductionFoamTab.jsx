import React, { useMemo, useState } from 'react';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { Badge, ClientDateFilter, ConfirmModal, EmptyState, useToast } from '../../../../shared/ui';
import { useAuth } from '../../../auth';
import {
  FOAM_PRODUCTION_FORMATS,
  FOAM_PRODUCTION_LOSS_PERCENT,
  FOAM_CUBE_DIMS_CM,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamApplyProductionLoss,
  foamCalcCubesFromKg,
  foamCalcBagsFromKg,
  foamFormatParamsLabel,
} from '../../../foam/mockData';
import { useFoamStore, startProductionRun, cancelProductionRun } from '../../../foam/store';
import './ProductionFoamTab.scss';

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

const OTK_STATUS = {
  pending: { variant: 'warning', label: 'На ОТК' },
  accepted: { variant: 'success', label: 'Принято' },
  rejected: { variant: 'danger', label: 'Брак' },
};

const StartRunModal = ({ lots, grades, onClose, onCreate }) => {
  const availableLots = lots.filter((l) => l.remainingKg > 0);
  const [lotId, setLotId] = useState(availableLots[0]?.id || '');
  const [inputKg, setInputKg] = useState('150');
  const [gradeCode, setGradeCode] = useState(grades[0]?.code || '');
  const [outputFormat, setOutputFormat] = useState(FOAM_PRODUCTION_FORMATS[0].value);
  const [bagWeightKg, setBagWeightKg] = useState('25');

  const lot = availableLots.find((l) => l.id === lotId);
  const usableKg = useMemo(() => foamApplyProductionLoss(inputKg), [inputKg]);
  const outputQty = useMemo(() => {
    if (outputFormat === 'cube') return foamCalcCubesFromKg(gradeCode, inputKg, grades);
    if (outputFormat === 'bag') return foamCalcBagsFromKg(inputKg, bagWeightKg);
    return null;
  }, [outputFormat, gradeCode, inputKg, bagWeightKg, grades]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!lot || !gradeCode || !outputQty) return;
    const kg = Number(inputKg) || 0;
    if (kg <= 0 || kg > lot.remainingKg) return;
    const payload = { lotId: lot.id, inputKg: kg, gradeCode, outputFormat, outputQty };
    if (outputFormat === 'bag') payload.bagWeightKg = Number(bagWeightKg) || 0;
    onCreate(payload);
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Запустить производство</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <label>Лот сырья</label>
          <select value={lotId} onChange={(ev) => setLotId(ev.target.value)}>
            {availableLots.length === 0 && <option value="">Нет сырья с остатком</option>}
            {availableLots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.lotNumber} ({formatNumberForInput(l.remainingKg)} кг)
              </option>
            ))}
          </select>
          <label>Загрузка, кг</label>
          <input
            type="number"
            min="1"
            max={lot?.remainingKg || undefined}
            value={inputKg}
            onChange={(ev) => setInputKg(ev.target.value)}
            required
          />
          <p className="production-foam-tab__hint">
            С учётом потерь {FOAM_PRODUCTION_LOSS_PERCENT}%: в дело пойдёт ≈ {formatNumberForInput(usableKg)} кг
          </p>
          <label>Плотность на выходе</label>
          <select value={gradeCode} onChange={(ev) => setGradeCode(ev.target.value)}>
            {grades.length === 0 && <option value="">Нет ни одной плотности в справочнике</option>}
            {grades.map((g) => (
              <option key={g.code} value={g.code}>{g.code}</option>
            ))}
          </select>
          <label>Формат на выходе</label>
          <select value={outputFormat} onChange={(ev) => setOutputFormat(ev.target.value)}>
            {FOAM_PRODUCTION_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {outputFormat === 'cube' && (
            <p className="production-foam-tab__hint">
              Куб всегда одного размера: {FOAM_CUBE_DIMS_CM.height}×{FOAM_CUBE_DIMS_CM.width}×{FOAM_CUBE_DIMS_CM.length} см. Меняется только вес.
            </p>
          )}

          {outputFormat === 'bag' && (
            <>
              <label>1 мешок = сколько кг?</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={bagWeightKg}
                onChange={(ev) => setBagWeightKg(ev.target.value)}
                required
              />
            </>
          )}

          <div className="production-foam-tab__calc-box">
            <span className="production-foam-tab__calc-label">Количество на выходе</span>
            <span className="production-foam-tab__calc-value">
              {outputQty != null ? `${outputQty} ${foamOutputUnitLabel(outputFormat)}` : '—'}
            </span>
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={!lot || !gradeCode || !outputQty}>Запустить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProductionFoamTab = () => {
  const toast = useToast();
  const { user } = useAuth();
  const { rawLots, productionRuns, densityGrades } = useFoamStore();
  const [startOpen, setStartOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');

  const operatorName = user?.name || user?.role_name || 'Оператор';

  const stats = useMemo(() => {
    const pending = productionRuns.filter((r) => r.otkStatus === 'pending').length;
    const accepted = productionRuns.filter((r) => r.otkStatus === 'accepted').length;
    return { total: productionRuns.length, pending, accepted };
  }, [productionRuns]);

  const visibleRuns = useMemo(() => {
    if (!dateFilterIso) return productionRuns;
    return productionRuns.filter((r) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(r, ['producedAt'])));
  }, [productionRuns, dateFilterIso]);

  const handleCreate = (payload) => {
    startProductionRun({ ...payload, operator: operatorName });
    toast.success(`Производство запущено: ${formatNumberForInput(payload.inputKg)} кг → ${foamOutputFormatLabel(payload.outputFormat).toLowerCase()}`);
  };

  const handleCancel = () => {
    if (!cancelTarget) return;
    cancelProductionRun(cancelTarget.id);
    toast.success(`Партия отменена, ${formatNumberForInput(cancelTarget.inputKg)} кг возвращены в остаток лота`);
    setCancelTarget(null);
  };

  return (
    <div className="production-foam-tab">
      <div className="production-foam-tab__stats">
        <div className="production-foam-tab__stat">
          <span className="production-foam-tab__stat-value">{stats.total}</span>
          <span className="production-foam-tab__stat-label">Всего партий</span>
        </div>
        <div className="production-foam-tab__stat">
          <span className="production-foam-tab__stat-value">{stats.pending}</span>
          <span className="production-foam-tab__stat-label">На проверке ОТК</span>
        </div>
        <div className="production-foam-tab__stat">
          <span className="production-foam-tab__stat-value">{stats.accepted}</span>
          <span className="production-foam-tab__stat-label">Принято</span>
        </div>
      </div>

      <div className="production-card production-card--produced">
        <div className="production-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <h2 className="production-card__title">Выпуски пенопласта</h2>
            <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="production-foam-date" />
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => setStartOpen(true)}>
              Запустить производство
            </button>
          </div>
        </div>

        <p className="production-foam-tab__loss-note">
          Расчёт выхода уже учитывает технологические потери {FOAM_PRODUCTION_LOSS_PERCENT}% от загрузки.
        </p>

        {visibleRuns.length === 0 ? (
          <EmptyState title="Пока нет выпусков" description="Нажмите «Запустить производство» — сырьё уйдёт в обработку, партия попадёт в ОТК." />
        ) : (
          <div className="chemistry-table-wrap">
            <div className="chemistry-table production-foam-tab__runs-table">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Лот</span>
                <span className="chemistry-table__th">Плотность</span>
                <span className="chemistry-table__th chemistry-table__th--num">Загрузка</span>
                <span className="chemistry-table__th">Формат</span>
                <span className="chemistry-table__th chemistry-table__th--num">Выход</span>
                <span className="chemistry-table__th">Оператор</span>
                <span className="chemistry-table__th">Дата</span>
                <span className="chemistry-table__th">ОТК</span>
                <span className="chemistry-table__th chemistry-table__th--actions"> </span>
              </div>
              {visibleRuns.map((r) => {
                const status = OTK_STATUS[r.otkStatus] || OTK_STATUS.pending;
                return (
                  <div key={r.id} className="chemistry-table__row">
                    <span className="chemistry-table__name chemistry-table__cell-clip">{r.lotNumber}</span>
                    <span className="chemistry-table__cell-clip">{r.gradeCode}</span>
                    <span className="chemistry-table__num">{formatNumberForInput(r.inputKg)} кг</span>
                    <span className="chemistry-table__cell-clip">
                      {foamOutputFormatLabel(r.outputFormat)}
                      <span className="production-foam-tab__params">{foamFormatParamsLabel(r)}</span>
                    </span>
                    <span className="chemistry-table__num">{r.outputQty} {foamOutputUnitLabel(r.outputFormat)}</span>
                    <span className="chemistry-table__cell-clip">{r.operator || '—'}</span>
                    <span className="chemistry-table__status">{formatDateTime(r.producedAt)}</span>
                    <span><Badge variant={status.variant} size="sm">{status.label}</Badge></span>
                    <span className="chemistry-table__actions">
                      {r.otkStatus === 'pending' && (
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setCancelTarget(r)}>
                          Удалить
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {startOpen && (
        <StartRunModal lots={rawLots} grades={densityGrades} onClose={() => setStartOpen(false)} onCreate={handleCreate} />
      )}

      <ConfirmModal
        open={!!cancelTarget}
        title="Удалить партию?"
        message={cancelTarget ? `Партия ${cancelTarget.lotNumber} ещё не проверена ОТК. Удалить — ${formatNumberForInput(cancelTarget.inputKg)} кг вернутся в остаток лота.` : ''}
        confirmText="Удалить"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
};

export default ProductionFoamTab;
