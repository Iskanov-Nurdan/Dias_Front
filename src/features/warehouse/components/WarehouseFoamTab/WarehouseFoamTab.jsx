import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiPackage, FiClock, FiCheck, FiX } from 'react-icons/fi';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { ClientDateFilter, EmptyState, Loading, useToast, SearchInput, EntityAvatar } from '../../../../shared/ui';
import { useOperationalRefetch, WS_FOAM_WAREHOUSE } from '../../../../shared/realtime';
import {
  FOAM_WAREHOUSE_GP,
  FOAM_SHEET_THICKNESS_OPTIONS_CM,
  FOAM_OPERATION_KIND_LABEL,
  FOAM_CUBE_VOLUME_M3,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamStockRowWeightKg,
  foamFormatParamsLabel,
  foamSheetsPerCube,
} from '../../../foam/mockData';
import { getFoamGpStock, getFoamGpOperations, cutFoamGpStock, getFoamDensityGrades } from '../../../foam/api/foamApi';
import './WarehouseFoamTab.scss';

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

/** Мапит строку остатка/операции с бэка (snake_case) в форму, которую ждут расчётные хелперы mockData.js. */
const toCalcRow = (row) => ({
  outputFormat: row.output_format,
  gradeCode: row.grade_code,
  thicknessCm: row.thickness_cm,
  qty: Number(row.qty),
});
const toCalcGrades = (grades) =>
  grades.map((g) => ({ code: g.code, minKgM3: Number(g.min_kg_m3), maxKgM3: Number(g.max_kg_m3) }));

const CutCubeModal = ({ row, onClose, onSubmit, saving }) => {
  const [thicknessCm, setThicknessCm] = useState(String(FOAM_SHEET_THICKNESS_OPTIONS_CM[0]));
  const [cubesQty, setCubesQty] = useState('1');
  const [error, setError] = useState('');

  const qtyNum = Number(cubesQty) || 0;
  const sheetsPerCube = foamSheetsPerCube(thicknessCm);
  const sheetsTotal = Math.floor(sheetsPerCube * qtyNum);
  const willExceedStock = qtyNum > Number(row.qty);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (qtyNum <= 0 || willExceedStock) return;
    setError('');
    try {
      await onSubmit({ cube_stock_id: row.id, thickness_cm: Number(thicknessCm), cubes_qty: String(qtyNum) });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Нарезать куб на листы, плотность {row.grade_code}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <p className="warehouse-foam-tab__hint">На складе кубов: {formatNumberForInput(row.qty)}</p>
          <label>Толщина листа</label>
          <select value={thicknessCm} onChange={(ev) => setThicknessCm(ev.target.value)}>
            {FOAM_SHEET_THICKNESS_OPTIONS_CM.map((t) => (
              <option key={t} value={t}>{t} см</option>
            ))}
          </select>
          <label>Сколько кубов пустить на нарезку</label>
          <input type="number" min="0.1" step="0.1" max={row.qty} value={cubesQty} onChange={(ev) => setCubesQty(ev.target.value)} required />
          {willExceedStock && <p className="modal__error">На складе меньше кубов, чем указано.</p>}
          <div className="warehouse-foam-tab__calc-box">
            <span>Из 1 куба выходит {sheetsPerCube} листов ({thicknessCm} см). Итого получится:</span>
            <strong>{sheetsTotal} листов</strong>
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}>
              <FiX aria-hidden size={16} strokeWidth={2} />
              Отмена
            </button>
            <button type="submit" className="btn btn--primary" disabled={saving || qtyNum <= 0 || willExceedStock}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {saving ? 'Нарезка…' : 'Нарезать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WarehouseFoamTab = () => {
  const toast = useToast();
  const [stock, setStock] = useState([]);
  const [operations, setOperations] = useState([]);
  const [densityGrades, setDensityGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState('stock');
  const [cutTarget, setCutTarget] = useState(null);
  const [cutting, setCutting] = useState(false);
  const [dateFilterIso, setDateFilterIso] = useState('');
  const [stockSearch, setStockSearch] = useState('');
  const [opsSearch, setOpsSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [stockRes, opsRes, gradesRes] = await Promise.all([
        getFoamGpStock(),
        getFoamGpOperations({ page_size: 500 }),
        getFoamDensityGrades(),
      ]);
      setStock(stockRes.data?.items || []);
      setOperations(opsRes.data?.items || []);
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

  useOperationalRefetch(WS_FOAM_WAREHOUSE, fetchAll, true);

  const calcGrades = useMemo(() => toCalcGrades(densityGrades), [densityGrades]);

  const totalWeightKg = useMemo(
    () => Math.round(stock.reduce((sum, s) => sum + (foamStockRowWeightKg(toCalcRow(s), calcGrades) || 0), 0) * 10) / 10,
    [stock, calcGrades],
  );

  const cubeTotals = useMemo(() => {
    const qty = stock.filter((s) => s.output_format === 'cube').reduce((sum, s) => sum + Number(s.qty), 0);
    return {
      qty: Math.round(qty * 10) / 10,
      volumeM3: Math.round(qty * FOAM_CUBE_VOLUME_M3 * 100) / 100,
    };
  }, [stock]);

  const visibleStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    if (!q) return stock;
    return stock.filter((s) => String(s.grade_code || '').toLowerCase().includes(q));
  }, [stock, stockSearch]);

  const visibleOperations = useMemo(() => {
    let list = operations;
    if (dateFilterIso) {
      list = list.filter((op) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(op, ['created_at'])));
    }
    const q = opsSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((op) => String(op.grade_code || '').toLowerCase().includes(q));
    }
    return list;
  }, [operations, dateFilterIso, opsSearch]);

  const handleCutSubmit = async (payload) => {
    setCutting(true);
    try {
      await cutFoamGpStock(payload);
      await fetchAll();
    } finally {
      setCutting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="warehouse-gp warehouse-gp--stock warehouse-foam-tab">
      <div className="warehouse-gp__main-tabs production-main-tabs" role="tablist" aria-label="Склад пенопласта">
        {[
          ['stock', 'Остатки', FiPackage],
          ['history', 'История', FiClock],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mainTab === key}
            className={`production-main-tabs__btn${mainTab === key ? ' production-main-tabs__btn--active' : ''}`}
            onClick={() => setMainTab(key)}
          >
            <Icon aria-hidden size={16} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {mainTab === 'stock' && (
        <div className="ds-list-card">
          <div className="ds-list-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start">
              <SearchInput
                placeholder="Поиск по плотности"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
              <span className="warehouse-foam-tab__warehouse-badge">{FOAM_WAREHOUSE_GP}</span>
            </div>
          </div>
          {stock.length === 0 ? (
            <EmptyState title="Склад пуст" description="Товар попадает сюда сразу после выпуска в «Производстве»." />
          ) : visibleStock.length === 0 ? (
            <EmptyState title="Ничего не найдено" />
          ) : (
            <>
              <p className="warehouse-foam-tab__total-weight">
                Итого на складе (оценочно): ≈ {formatNumberForInput(totalWeightKg)} кг
                {cubeTotals.qty > 0 ? ` · кубов: ${formatNumberForInput(cubeTotals.qty)} шт (≈ ${formatNumberForInput(cubeTotals.volumeM3)} м³)` : ''}
              </p>
              <div className="chemistry-table-wrap">
                <div className="chemistry-table warehouse-foam-tab__stock-table">
                  <div className="chemistry-table__header">
                    <span className="chemistry-table__th">Формат</span>
                    <span className="chemistry-table__th">Плотность</span>
                    <span className="chemistry-table__th">Параметры</span>
                    <span className="chemistry-table__th chemistry-table__th--num">Остаток</span>
                    <span className="chemistry-table__th chemistry-table__th--num">≈ Вес</span>
                    <span className="chemistry-table__th chemistry-table__th--actions"> </span>
                  </div>
                  {visibleStock.map((s) => (
                    <div key={s.id} className="chemistry-table__row">
                      <span className="chemistry-table__name chemistry-table__name--with-avatar">
                        <EntityAvatar name={foamOutputFormatLabel(s.output_format)} size={28} />
                        {foamOutputFormatLabel(s.output_format)}
                      </span>
                      <span className="chemistry-table__cell-clip">{s.grade_code || '—'}</span>
                      <span className="chemistry-table__cell-clip">{foamFormatParamsLabel(toCalcRow(s))}</span>
                      <span className="chemistry-table__num">{formatNumberForInput(s.qty)} {foamOutputUnitLabel(s.output_format)}</span>
                      <span className="chemistry-table__num">{formatNumberForInput(foamStockRowWeightKg(toCalcRow(s), calcGrades))} кг</span>
                      <span className="chemistry-table__actions chemistry-table__actions--wrap">
                        {s.output_format === 'cube' && (
                          <button type="button" className="action-row__btn" onClick={() => setCutTarget(s)}>
                            Нарезать на листы
                          </button>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {mainTab === 'history' && (
        <div className="ds-list-card">
          <div className="ds-list-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start">
              <SearchInput
                placeholder="Поиск по плотности"
                value={opsSearch}
                onChange={(e) => setOpsSearch(e.target.value)}
              />
            </div>
            <div className="ds-toolbar__end">
              <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="warehouse-foam-history-date" />
            </div>
          </div>
          {visibleOperations.length === 0 ? (
            <EmptyState title="Записей нет" />
          ) : (
            <div className="commercial-table-wrap warehouse-gp__table-wrap warehouse-gp__table-wrap--scroll">
              <table className="data-table data-table--warehouse-gp data-table--warehouse-gp-compact">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Операция</th>
                    <th>Товар</th>
                    <th className="data-table__cell--num">Кол-во</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleOperations.map((op) => (
                    <tr key={op.id}>
                      <td className="data-table__cell--muted">{formatDateTime(op.created_at)}</td>
                      <td>{FOAM_OPERATION_KIND_LABEL[op.kind] || op.kind}{op.ref ? ` — ${op.ref}` : ''}</td>
                      <td>
                        {foamOutputFormatLabel(op.output_format)}
                        {op.grade_code ? `, плотность ${op.grade_code}` : ''}
                        {op.thickness_cm ? `, ${op.thickness_cm} см` : ''}
                      </td>
                      <td className={`data-table__cell--num warehouse-foam-tab__qty${Number(op.qty) < 0 ? ' warehouse-foam-tab__qty--out' : ' warehouse-foam-tab__qty--in'}`}>
                        {Number(op.qty) > 0 ? '+' : ''}{formatNumberForInput(op.qty)} {foamOutputUnitLabel(op.output_format)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {cutTarget && (
        <CutCubeModal
          row={cutTarget}
          onClose={() => setCutTarget(null)}
          onSubmit={handleCutSubmit}
          saving={cutting}
        />
      )}
    </div>
  );
};

export default WarehouseFoamTab;
