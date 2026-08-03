import React, { useMemo, useState } from 'react';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { ClientDateFilter, EmptyState } from '../../../../shared/ui';
import {
  FOAM_WAREHOUSE_GP,
  FOAM_SHEET_THICKNESS_OPTIONS_CM,
  FOAM_OPERATION_KIND_LABEL,
  foamOutputFormatLabel,
  foamOutputUnitLabel,
  foamStockRowWeightKg,
  foamFormatParamsLabel,
  foamSheetsPerCube,
} from '../../../foam/mockData';
import { useFoamStore, recordWarehouseOperation, cutCubeToSheets } from '../../../foam/store';
import './WarehouseFoamTab.scss';

const OPERATION_KINDS = [
  { value: 'sale', label: 'Продажа', sign: -1 },
  { value: 'defect', label: 'Брак / списание', sign: -1 },
  { value: 'return', label: 'Возврат на склад', sign: 1 },
];

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

const StockOperationModal = ({ row, onClose, onSubmit }) => {
  const [kind, setKind] = useState('sale');
  const [qty, setQty] = useState('');
  const [comment, setComment] = useState('');

  const kindDef = OPERATION_KINDS.find((k) => k.value === kind);
  const qtyNum = Number(qty) || 0;
  const willExceedStock = kindDef?.sign === -1 && qtyNum > row.qty;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qtyNum <= 0 || willExceedStock) return;
    onSubmit({ kind, qty: qtyNum * kindDef.sign, ref: comment.trim() });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Движение: {foamOutputFormatLabel(row.outputFormat)}, плотность {row.gradeCode}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <p className="warehouse-foam-tab__hint">Сейчас на складе: {formatNumberForInput(row.qty)} {foamOutputUnitLabel(row.outputFormat)}</p>
          <label>Операция</label>
          <select value={kind} onChange={(ev) => setKind(ev.target.value)}>
            {OPERATION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <label>Количество ({foamOutputUnitLabel(row.outputFormat)})</label>
          <input type="number" min="1" step="1" value={qty} onChange={(ev) => setQty(ev.target.value)} required />
          {willExceedStock && <p className="modal__error">На складе меньше, чем указано.</p>}
          <label>Комментарий</label>
          <input value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="Например, № продажи" autoComplete="off" />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={qtyNum <= 0 || willExceedStock}>Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CutCubeModal = ({ row, onClose, onSubmit }) => {
  const [thicknessCm, setThicknessCm] = useState(String(FOAM_SHEET_THICKNESS_OPTIONS_CM[0]));
  const [cubesQty, setCubesQty] = useState('1');

  const qtyNum = Number(cubesQty) || 0;
  const sheetsPerCube = foamSheetsPerCube(thicknessCm);
  const sheetsTotal = Math.floor(sheetsPerCube * qtyNum);
  const willExceedStock = qtyNum > row.qty;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qtyNum <= 0 || willExceedStock) return;
    onSubmit({ thicknessCm: Number(thicknessCm), cubesQty: qtyNum });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Нарезать куб на листы, плотность {row.gradeCode}</h3>
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
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={qtyNum <= 0 || willExceedStock}>Нарезать</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WarehouseFoamTab = () => {
  const { gpStock: stock, gpOperations: operations } = useFoamStore();
  const [mainTab, setMainTab] = useState('stock');
  const [opTarget, setOpTarget] = useState(null);
  const [cutTarget, setCutTarget] = useState(null);
  const [dateFilterIso, setDateFilterIso] = useState('');

  const totalWeightKg = useMemo(
    () => Math.round(stock.reduce((sum, s) => sum + (foamStockRowWeightKg(s) || 0), 0) * 10) / 10,
    [stock],
  );

  const visibleOperations = useMemo(() => {
    if (!dateFilterIso) return operations;
    return operations.filter((op) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(op, ['createdAt'])));
  }, [operations, dateFilterIso]);

  const handleOperationSubmit = (row, payload) => {
    recordWarehouseOperation({ row, ...payload });
  };

  const handleCutSubmit = (row, payload) => {
    cutCubeToSheets({ gradeCode: row.gradeCode, ...payload });
  };

  return (
    <div className="warehouse-gp warehouse-gp--stock warehouse-foam-tab">
      <div className="warehouse-gp__main-tabs production-main-tabs" role="tablist" aria-label="Склад пенопласта">
        {[
          ['stock', 'Остатки'],
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

      {mainTab === 'stock' && (
        <section className="warehouse-gp__block">
          <h2 className="warehouse-gp__title">
            Готовая продукция <span className="warehouse-foam-tab__warehouse-badge">{FOAM_WAREHOUSE_GP}</span>
          </h2>
          {stock.length === 0 ? (
            <EmptyState title="Склад пуст" description="Товар попадает сюда после приёмки в «ОТК»." />
          ) : (
            <>
              <p className="warehouse-foam-tab__total-weight">
                Итого на складе (оценочно): ≈ {formatNumberForInput(totalWeightKg)} кг
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
                  {stock.map((s) => (
                    <div key={s.key} className="chemistry-table__row">
                      <span className="chemistry-table__name">{foamOutputFormatLabel(s.outputFormat)}</span>
                      <span className="chemistry-table__cell-clip">{s.gradeCode}</span>
                      <span className="chemistry-table__cell-clip">{foamFormatParamsLabel(s)}</span>
                      <span className="chemistry-table__num">{formatNumberForInput(s.qty)} {foamOutputUnitLabel(s.outputFormat)}</span>
                      <span className="chemistry-table__num">{formatNumberForInput(foamStockRowWeightKg(s))} кг</span>
                      <span className="chemistry-table__actions chemistry-table__actions--wrap">
                        {s.outputFormat === 'cube' && (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setCutTarget(s)}>
                            Нарезать на листы
                          </button>
                        )}
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => setOpTarget(s)}>
                          Движение
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {mainTab === 'history' && (
        <section className="warehouse-gp__block">
          <div className="ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start">
              <h2 className="warehouse-gp__title">Движения склада</h2>
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
                      <td className="data-table__cell--muted">{formatDateTime(op.createdAt)}</td>
                      <td>{FOAM_OPERATION_KIND_LABEL[op.kind] || op.kind}{op.ref ? ` — ${op.ref}` : ''}</td>
                      <td>
                        {foamOutputFormatLabel(op.outputFormat)}, плотность {op.gradeCode}
                        {op.thicknessCm ? `, ${op.thicknessCm} см` : ''}
                        {op.bagWeightKg ? `, ${op.bagWeightKg} кг/меш` : ''}
                      </td>
                      <td className={`data-table__cell--num warehouse-foam-tab__qty${op.qty < 0 ? ' warehouse-foam-tab__qty--out' : ' warehouse-foam-tab__qty--in'}`}>
                        {op.qty > 0 ? '+' : ''}{formatNumberForInput(op.qty)} {foamOutputUnitLabel(op.outputFormat)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {opTarget && (
        <StockOperationModal
          row={opTarget}
          onClose={() => setOpTarget(null)}
          onSubmit={(payload) => handleOperationSubmit(opTarget, payload)}
        />
      )}

      {cutTarget && (
        <CutCubeModal
          row={cutTarget}
          onClose={() => setCutTarget(null)}
          onSubmit={(payload) => handleCutSubmit(cutTarget, payload)}
        />
      )}
    </div>
  );
};

export default WarehouseFoamTab;
