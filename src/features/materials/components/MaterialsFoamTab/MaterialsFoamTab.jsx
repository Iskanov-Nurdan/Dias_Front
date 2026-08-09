import React, { useMemo, useState } from 'react';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
} from '../../../../shared/lib';
import { Badge, ClientDateFilter, EmptyState, useToast } from '../../../../shared/ui';
import { FOAM_WAREHOUSE_RAW, nextFoamId } from '../../../foam/mockData';
import { useFoamStore, addRawLot, addDensityGrade } from '../../../foam/store';
import './MaterialsFoamTab.scss';

const SUB_TAB = { CATALOG: 'catalog', LOTS: 'lots', MOVEMENTS: 'movements' };

const formatDateTime = (iso) => {
  if (!iso) return '—';
  const s = String(iso);
  if (s.length >= 16) return `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)} ${s.slice(11, 16)}`;
  return s.slice(0, 10);
};

const LOT_STATUS_BADGE = {
  in_stock: { variant: 'success', label: 'В наличии' },
  low: { variant: 'warning', label: 'Остаток мал' },
  empty: { variant: 'default', label: 'Нет остатка' },
};

const lotStatusOf = (lot) => {
  if (lot.remainingKg <= 0) return 'empty';
  if (lot.remainingKg <= lot.bagWeightKg * 0.15) return 'low';
  return 'in_stock';
};

const AddIntakeModal = ({ onClose, onCreate }) => {
  const [materialName, setMaterialName] = useState('');
  const [supplier, setSupplier] = useState('Kingeps');
  const [bagWeightKg, setBagWeightKg] = useState('800');

  const handleSubmit = (e) => {
    e.preventDefault();
    const weight = Number(bagWeightKg) || 0;
    const name = materialName.trim();
    if (weight <= 0 || !name) return;
    onCreate({
      id: nextFoamId('lot'),
      lotNumber: `KG-${Date.now().toString().slice(-6)}`,
      materialName: name,
      supplier: supplier.trim() || '—',
      bagWeightKg: weight,
      receivedKg: weight,
      remainingKg: weight,
      receivedAt: new Date().toISOString(),
      warehouse: FOAM_WAREHOUSE_RAW,
      status: 'in_stock',
    });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Приход гранул</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <label>Название сырья</label>
          <input value={materialName} onChange={(ev) => setMaterialName(ev.target.value)} placeholder="Например, Гранула EPS Kingeps HS" autoComplete="off" required />
          <label>Поставщик</label>
          <input value={supplier} onChange={(ev) => setSupplier(ev.target.value)} autoComplete="off" />
          <label>Вес, кг</label>
          <input type="number" min="1" value={bagWeightKg} onChange={(ev) => setBagWeightKg(ev.target.value)} required />
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={!materialName.trim() || Number(bagWeightKg) <= 0}>Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddGradeModal = ({ existingCodes, onClose, onCreate }) => {
  const [code, setCode] = useState('');
  const [minKgM3, setMinKgM3] = useState('');
  const [maxKgM3, setMaxKgM3] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    const min = Number(minKgM3);
    const max = Number(maxKgM3);
    if (!trimmed) { setError('Укажите код плотности'); return; }
    if (existingCodes.includes(trimmed)) { setError('Такая плотность уже есть в справочнике'); return; }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      setError('Проверьте диапазон кг/м³');
      return;
    }
    onCreate({ code: trimmed, minKgM3: min, maxKgM3: max });
    onClose();
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <h3>Добавить плотность</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <label>Код (как в накладных, например «20»)</label>
          <input value={code} onChange={(ev) => { setCode(ev.target.value); setError(''); }} required autoComplete="off" />
          <label>Вес 1 м³, кг — от</label>
          <input type="number" min="0" step="0.1" value={minKgM3} onChange={(ev) => setMinKgM3(ev.target.value)} required />
          <label>Вес 1 м³, кг — до</label>
          <input type="number" min="0" step="0.1" value={maxKgM3} onChange={(ev) => setMaxKgM3(ev.target.value)} required />
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn--primary">Сохранить</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MaterialsFoamTab = () => {
  const toast = useToast();
  const { rawLots: lots, productionRuns, densityGrades } = useFoamStore();
  const [subTab, setSubTab] = useState(SUB_TAB.LOTS);
  const [addOpen, setAddOpen] = useState(false);
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const [dateFilterIso, setDateFilterIso] = useState('');

  const stats = useMemo(() => {
    const totalKg = lots.reduce((sum, l) => sum + l.remainingKg, 0);
    const activeLots = lots.filter((l) => l.remainingKg > 0).length;
    return { totalKg, activeLots, gradesCount: densityGrades.length };
  }, [lots, densityGrades]);

  const movements = useMemo(() => {
    const income = lots.map((l) => ({
      id: `in-${l.id}`,
      type: 'in',
      qtyKg: l.receivedKg,
      date: l.receivedAt,
      note: `Приход — ${l.materialName} (${l.supplier})`,
    }));
    const outcome = productionRuns.map((r) => ({
      id: `out-${r.id}`,
      type: 'out',
      qtyKg: r.inputKg,
      date: r.producedAt,
      note: `Списано в производство — ${r.materialName}${r.gradeCode ? ` (плотность на выходе: ${r.gradeCode})` : ''}`,
    }));
    return [...income, ...outcome].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [lots, productionRuns]);

  const visibleLots = useMemo(() => {
    if (!dateFilterIso) return lots;
    return lots.filter((l) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(l, ['receivedAt'])));
  }, [lots, dateFilterIso]);

  const visibleMovements = useMemo(() => {
    if (!dateFilterIso) return movements;
    return movements.filter((m) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(m, ['date'])));
  }, [movements, dateFilterIso]);

  const handleCreateLot = (lot) => {
    addRawLot(lot);
    toast.success(`Приход добавлен: ${lot.materialName}, ${formatNumberForInput(lot.bagWeightKg)} кг`);
  };

  const handleCreateGrade = (grade) => {
    addDensityGrade(grade);
    toast.success(`Плотность «${grade.code}» добавлена в справочник`);
  };

  return (
    <div className="materials-foam-tab">
      <div className="materials-foam-tab__stats">
        <div className="materials-foam-tab__stat">
          <span className="materials-foam-tab__stat-value">{formatNumberForInput(stats.totalKg)} кг</span>
          <span className="materials-foam-tab__stat-label">Остаток гранул на складе</span>
        </div>
        <div className="materials-foam-tab__stat">
          <span className="materials-foam-tab__stat-value">{stats.activeLots}</span>
          <span className="materials-foam-tab__stat-label">Лотов с остатком</span>
        </div>
        <div className="materials-foam-tab__stat">
          <span className="materials-foam-tab__stat-value">{stats.gradesCount}</span>
          <span className="materials-foam-tab__stat-label">Марок в производстве</span>
        </div>
      </div>

      <div className="materials-tabs" role="tablist" aria-label="Разделы сырья пенопласта">
        {[
          [SUB_TAB.LOTS, 'Остатки по лотам'],
          [SUB_TAB.CATALOG, 'Каталог марок'],
          [SUB_TAB.MOVEMENTS, 'Движения'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={subTab === key}
            className={`materials-tabs__tab${subTab === key ? ' materials-tabs__tab--active' : ''}`}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === SUB_TAB.LOTS && (
        <div className="chemistry-card">
          <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start">
              <span className="materials-foam-tab__warehouse-badge">{FOAM_WAREHOUSE_RAW}</span>
              <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="materials-foam-lots-date" />
            </div>
            <div className="ds-toolbar__end">
              <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
                Добавить приход
              </button>
            </div>
          </div>

          {visibleLots.length === 0 ? (
            <EmptyState title="Нет лотов гранул" />
          ) : (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table materials-foam-tab__lots-table">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Название сырья</span>
                  <span className="chemistry-table__th">Поставщик</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Остаток</span>
                  <span className="chemistry-table__th">Приёмка</span>
                  <span className="chemistry-table__th">Статус</span>
                </div>
                {visibleLots.map((lot) => {
                  const status = lotStatusOf(lot);
                  const badge = LOT_STATUS_BADGE[status];
                  return (
                    <div key={lot.id} className="chemistry-table__row">
                      <span className="chemistry-table__name chemistry-table__cell-clip">{lot.materialName}</span>
                      <span className="chemistry-table__cell-clip">{lot.supplier}</span>
                      <span className="chemistry-table__num">
                        {formatNumberForInput(lot.remainingKg)} / {formatNumberForInput(lot.receivedKg)} кг
                      </span>
                      <span className="chemistry-table__status">{formatDateTime(lot.receivedAt)}</span>
                      <span><Badge variant={badge.variant} size="sm">{badge.label}</Badge></span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === SUB_TAB.CATALOG && (
        <div className="chemistry-card">
          <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start" />
            <div className="ds-toolbar__end">
              <button type="button" className="btn btn--primary" onClick={() => setAddGradeOpen(true)}>
                Добавить плотность
              </button>
            </div>
          </div>
          <div className="chemistry-table-wrap">
            <div className="chemistry-table materials-foam-tab__catalog-table">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Плотность</span>
                <span className="chemistry-table__th chemistry-table__th--num">Вес 1 м³ (насыпной)</span>
              </div>
              {densityGrades.map((g) => (
                <div key={g.code} className="chemistry-table__row">
                  <span className="chemistry-table__name">{g.code}</span>
                  <span className="chemistry-table__num">{g.minKgM3}–{g.maxKgM3} кг/м³</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === SUB_TAB.MOVEMENTS && (
        <div className="chemistry-card">
          <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start">
              <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="materials-foam-movements-date" />
            </div>
          </div>
          {visibleMovements.length === 0 ? (
            <EmptyState title="Пока нет движений" />
          ) : (
            <div className="chemistry-table-wrap">
              <div className="chemistry-table materials-foam-tab__movements-table">
                <div className="chemistry-table__header">
                  <span className="chemistry-table__th">Дата</span>
                  <span className="chemistry-table__th">Операция</span>
                  <span className="chemistry-table__th chemistry-table__th--num">Кг</span>
                </div>
                {visibleMovements.map((m) => (
                  <div key={m.id} className="chemistry-table__row">
                    <span className="chemistry-table__status">{formatDateTime(m.date)}</span>
                    <span className="chemistry-table__cell-clip">{m.note}</span>
                    <span className={`chemistry-table__num materials-foam-tab__qty materials-foam-tab__qty--${m.type}`}>
                      {m.type === 'in' ? '+' : '−'}{formatNumberForInput(m.qtyKg)} кг
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {addOpen && <AddIntakeModal onClose={() => setAddOpen(false)} onCreate={handleCreateLot} />}
      {addGradeOpen && (
        <AddGradeModal
          existingCodes={densityGrades.map((g) => g.code)}
          onClose={() => setAddGradeOpen(false)}
          onCreate={handleCreateGrade}
        />
      )}
    </div>
  );
};

export default MaterialsFoamTab;
