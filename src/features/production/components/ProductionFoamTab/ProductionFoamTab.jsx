import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPlus, FiCheck, FiX } from 'react-icons/fi';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { ClientDateFilter, EmptyState, Loading, useToast, SearchInput, EntityAvatar } from '../../../../shared/ui';
import { useOperationalRefetch, WS_FOAM_PRODUCTION } from '../../../../shared/realtime';
import {
  FOAM_PRODUCTION_FORMATS,
  FOAM_PRODUCTION_LOSS_PERCENT,
  FOAM_CUBE_DIMS_CM,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamApplyProductionLoss,
  foamCalcCubesFromKg,
  foamCalcGranuleKgFromKg,
  foamFormatParamsLabel,
} from '../../../foam/mockData';
import { getFoamRawLots, getFoamDensityGrades, getFoamProductionRuns, createFoamProductionRun } from '../../../foam/api/foamApi';
import './ProductionFoamTab.scss';

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

/** Плотности стора имеют вид { code, min_kg_m3, max_kg_m3 } — расчётные хелперы mockData.js ждут camelCase. */
const toCalcGrades = (grades) =>
  grades.map((g) => ({ code: g.code, minKgM3: Number(g.min_kg_m3), maxKgM3: Number(g.max_kg_m3) }));

const StartRunModal = ({ lots, grades, onClose, onCreate, saving }) => {
  const availableLots = lots.filter((l) => Number(l.remaining_kg) > 0);
  const [lotId, setLotId] = useState(availableLots[0]?.id ?? '');
  const [inputKg, setInputKg] = useState('150');
  const [gradeCode, setGradeCode] = useState(grades[0]?.code || '');
  const [outputFormat, setOutputFormat] = useState(FOAM_PRODUCTION_FORMATS[0].value);
  const [error, setError] = useState('');

  const calcGrades = useMemo(() => toCalcGrades(grades), [grades]);
  const lot = availableLots.find((l) => l.id === lotId);
  const usableKg = useMemo(() => foamApplyProductionLoss(inputKg), [inputKg]);
  const outputQty = useMemo(() => {
    if (outputFormat === 'cube') return foamCalcCubesFromKg(gradeCode, inputKg, calcGrades);
    if (outputFormat === 'granule') return foamCalcGranuleKgFromKg(inputKg);
    return null;
  }, [outputFormat, gradeCode, inputKg, calcGrades]);

  const needsGrade = outputFormat === 'cube';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!lot || (needsGrade && !gradeCode)) return;
    const kg = Number(inputKg) || 0;
    if (kg <= 0 || kg > Number(lot.remaining_kg)) return;
    const payload = { lot_id: lot.id, input_kg: String(kg), output_format: outputFormat };
    if (needsGrade) payload.grade_code = gradeCode;
    setError('');
    try {
      await onCreate(payload);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Запустить производство</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <label>Сырьё</label>
          <select value={lotId} onChange={(ev) => setLotId(Number(ev.target.value))}>
            {availableLots.length === 0 && <option value="">Нет сырья с остатком</option>}
            {availableLots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.material_name} ({formatNumberForInput(l.remaining_kg)} кг)
              </option>
            ))}
          </select>
          <label>Загрузка, кг</label>
          <input
            type="number"
            min="1"
            max={lot?.remaining_kg || undefined}
            value={inputKg}
            onChange={(ev) => setInputKg(ev.target.value)}
            required
          />
          <p className="production-foam-tab__hint">
            С учётом потерь {FOAM_PRODUCTION_LOSS_PERCENT}%: в дело пойдёт ≈ {formatNumberForInput(usableKg)} кг
          </p>
          <label>Формат на выходе</label>
          <select value={outputFormat} onChange={(ev) => setOutputFormat(ev.target.value)}>
            {FOAM_PRODUCTION_FORMATS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {outputFormat === 'cube' && (
            <>
              <label>Плотность на выходе</label>
              <select value={gradeCode} onChange={(ev) => setGradeCode(ev.target.value)}>
                {grades.length === 0 && <option value="">Нет ни одной плотности в справочнике</option>}
                {grades.map((g) => (
                  <option key={g.code} value={g.code}>{g.code}</option>
                ))}
              </select>
              <p className="production-foam-tab__hint">
                Куб всегда одного размера: {FOAM_CUBE_DIMS_CM.height}×{FOAM_CUBE_DIMS_CM.width}×{FOAM_CUBE_DIMS_CM.length} см. Меняется только вес.
              </p>
            </>
          )}

          {outputFormat === 'granule' && (
            <p className="production-foam-tab__hint">
              Без деления на упаковки — считается напрямую в кг (с учётом потерь), у гранул на продажу нет плотности.
            </p>
          )}

          <div className="production-foam-tab__calc-box">
            <span className="production-foam-tab__calc-label">Количество на выходе (предпросмотр)</span>
            <span className="production-foam-tab__calc-value">
              {outputQty != null ? `≈ ${outputQty} ${foamOutputUnitLabel(outputFormat)}` : '—'}
            </span>
          </div>
          {error && <p className="modal__error">{error}</p>}

          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
              <FiX aria-hidden size={16} strokeWidth={2} />
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving || !lot || (needsGrade && !gradeCode)}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {saving ? 'Запуск…' : 'Запустить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const ProductionFoamTab = () => {
  const toast = useToast();
  const [rawLots, setRawLots] = useState([]);
  const [productionRuns, setProductionRuns] = useState([]);
  const [densityGrades, setDensityGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [startOpen, setStartOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dateFilterIso, setDateFilterIso] = useState('');
  const [runsSearch, setRunsSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [lotsRes, runsRes, gradesRes] = await Promise.all([
        getFoamRawLots({ page_size: 500 }),
        getFoamProductionRuns({ page_size: 500 }),
        getFoamDensityGrades(),
      ]);
      setRawLots(lotsRes.data?.items || []);
      setProductionRuns(runsRes.data?.items || []);
      setDensityGrades(gradesRes.data?.items || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useOperationalRefetch(WS_FOAM_PRODUCTION, fetchAll, true);

  const stats = useMemo(() => {
    const cubes = productionRuns
      .filter((r) => r.output_format === 'cube')
      .reduce((sum, r) => sum + Number(r.output_qty), 0);
    const granuleKg = productionRuns
      .filter((r) => r.output_format === 'granule')
      .reduce((sum, r) => sum + Number(r.output_qty), 0);
    return {
      total: productionRuns.length,
      cubes: Math.round(cubes * 10) / 10,
      granuleKg: Math.round(granuleKg * 10) / 10,
    };
  }, [productionRuns]);

  const visibleRuns = useMemo(() => {
    let list = productionRuns;
    if (dateFilterIso) {
      list = list.filter((r) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(r, ['produced_at'])));
    }
    const q = runsSearch.trim().toLowerCase();
    if (q) list = list.filter((r) => String(r.material_name || '').toLowerCase().includes(q));
    return list;
  }, [productionRuns, dateFilterIso, runsSearch]);

  const handleCreate = async (payload) => {
    setSaving(true);
    try {
      await createFoamProductionRun(payload);
      await fetchAll();
      toast.success(`Производство запущено: ${formatNumberForInput(payload.input_kg)} кг → ${foamOutputFormatLabel(payload.output_format).toLowerCase()}, сразу на склад`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="production-foam-tab">
      <div className="production-foam-tab__stats">
        <div className="production-foam-tab__stat">
          <span className="production-foam-tab__stat-value">{stats.total}</span>
          <span className="production-foam-tab__stat-label">Всего партий</span>
        </div>
        <div className="production-foam-tab__stat">
          <span className="production-foam-tab__stat-value">{stats.cubes}</span>
          <span className="production-foam-tab__stat-label">Кубов выпущено</span>
        </div>
        <div className="production-foam-tab__stat">
          <span className="production-foam-tab__stat-value">{stats.granuleKg}</span>
          <span className="production-foam-tab__stat-label">Гранул на продажу, кг</span>
        </div>
      </div>

      <div className="production-card production-card--produced">
        <div className="production-card__head ds-toolbar ds-toolbar--in-card">
          <div className="ds-toolbar__start">
            <SearchInput placeholder="Поиск по сырью" value={runsSearch} onChange={(e) => setRunsSearch(e.target.value)} />
            <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="production-foam-date" />
          </div>
          <div className="ds-toolbar__end">
            <button type="button" className="btn btn--primary" onClick={() => setStartOpen(true)}>
              <FiPlus aria-hidden size={16} strokeWidth={2} />
              Производство
            </button>
          </div>
        </div>

        <p className="production-foam-tab__loss-note">
          Расчёт выхода уже учитывает технологические потери {FOAM_PRODUCTION_LOSS_PERCENT}% от загрузки.
        </p>

        {visibleRuns.length === 0 ? (
          <EmptyState title="Пока нет выпусков" description="Нажмите «Запустить производство» — сырьё уйдёт в обработку, готовая партия сразу попадёт на склад." />
        ) : (
          <div className="chemistry-table-wrap">
            <div className="chemistry-table production-foam-tab__runs-table">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Сырьё</span>
                <span className="chemistry-table__th">Плотность</span>
                <span className="chemistry-table__th chemistry-table__th--num">Загрузка</span>
                <span className="chemistry-table__th">Формат</span>
                <span className="chemistry-table__th chemistry-table__th--num">Выход</span>
                <span className="chemistry-table__th">Оператор</span>
                <span className="chemistry-table__th">Дата</span>
              </div>
              {visibleRuns.map((r) => (
                <div key={r.id} className="chemistry-table__row">
                  <span className="chemistry-table__name chemistry-table__name--with-avatar chemistry-table__cell-clip">
                    <EntityAvatar name={r.material_name} size={28} />
                    {r.material_name}
                  </span>
                  <span className="chemistry-table__cell-clip">{r.grade_code || '—'}</span>
                  <span className="chemistry-table__num">{formatNumberForInput(r.input_kg)} кг</span>
                  <span className="chemistry-table__cell-clip">
                    {foamOutputFormatLabel(r.output_format)}
                    <span className="production-foam-tab__params">{foamFormatParamsLabel({ outputFormat: r.output_format, gradeCode: r.grade_code })}</span>
                  </span>
                  <span className="chemistry-table__num">{r.output_qty} {foamOutputUnitLabel(r.output_format)}</span>
                  <span className="chemistry-table__cell-clip">{r.operator || '—'}</span>
                  <span className="chemistry-table__status">{formatDateTime(r.produced_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {startOpen && (
        <StartRunModal lots={rawLots} grades={densityGrades} onClose={() => setStartOpen(false)} onCreate={handleCreate} saving={saving} />
      )}
    </div>
  );
};

export default ProductionFoamTab;
