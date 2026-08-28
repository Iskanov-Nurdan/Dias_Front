import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiPackage, FiBookOpen, FiRefreshCw, FiPlus, FiCheck, FiX,
  FiTag, FiTruck, FiHash, FiSliders,
} from 'react-icons/fi';
import {
  formatNumberForInput,
  pickFirstIsoDate,
  matchesClientDateFilter,
  getApiErrorMessage,
} from '../../../../shared/lib';
import { Badge, ClientDateFilter, EmptyState, Loading, useToast, EntityAvatar, SearchInput } from '../../../../shared/ui';
import { useOperationalRefetch, WS_FOAM_MATERIALS } from '../../../../shared/realtime';
import { FOAM_WAREHOUSE_RAW } from '../../../foam/mockData';
import {
  getFoamRawLots,
  createFoamRawLot,
  getFoamDensityGrades,
  createFoamDensityGrade,
  getFoamProductionRuns,
} from '../../../foam/api/foamApi';
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
  const remaining = Number(lot.remaining_kg);
  const bagWeight = Number(lot.bag_weight_kg);
  if (remaining <= 0) return 'empty';
  if (remaining <= bagWeight * 0.15) return 'low';
  return 'in_stock';
};

const AddIntakeModal = ({ onClose, onCreate, saving }) => {
  const [materialName, setMaterialName] = useState('');
  const [supplier, setSupplier] = useState('Kingeps');
  const [bagWeightKg, setBagWeightKg] = useState('800');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const weight = Number(bagWeightKg) || 0;
    const name = materialName.trim();
    if (weight <= 0 || !name) return;
    setError('');
    try {
      await onCreate({ material_name: name, supplier: supplier.trim(), bag_weight_kg: String(weight) });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--sm" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__head-titles">
            <span className="modal__eyebrow">Новый приход</span>
            <h3>Приход гранул</h3>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label-icon"><FiTag aria-hidden size={15} strokeWidth={2} />Название сырья</label>
            <input value={materialName} onChange={(ev) => setMaterialName(ev.target.value)} placeholder="Например, Гранула EPS Kingeps HS" autoComplete="off" required />
          </div>
          <div className="modal__field-row">
            <div className="modal__field">
              <label className="modal__label-icon"><FiTruck aria-hidden size={15} strokeWidth={2} />Поставщик</label>
              <input value={supplier} onChange={(ev) => setSupplier(ev.target.value)} autoComplete="off" />
            </div>
            <div className="modal__field">
              <label className="modal__label-icon"><FiHash aria-hidden size={15} strokeWidth={2} />Вес, кг</label>
              <input type="number" min="1" value={bagWeightKg} onChange={(ev) => setBagWeightKg(ev.target.value)} required />
            </div>
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}><FiX aria-hidden size={16} strokeWidth={2} />Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving || !materialName.trim() || Number(bagWeightKg) <= 0}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AddGradeModal = ({ existingCodes, onClose, onCreate, saving }) => {
  const [code, setCode] = useState('');
  const [minKgM3, setMinKgM3] = useState('');
  const [maxKgM3, setMaxKgM3] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
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
    try {
      await onCreate({ code: trimmed, min_kg_m3: String(min), max_kg_m3: String(max) });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div className="modal modal--sm" onClick={(ev) => ev.stopPropagation()}>
        <div className="modal__head">
          <div className="modal__head-titles">
            <span className="modal__eyebrow">Новая плотность</span>
            <h3>Добавить плотность</h3>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">×</button>
        </div>
        <form className="modal__body" onSubmit={handleSubmit}>
          <div className="modal__field">
            <label className="modal__label-icon"><FiTag aria-hidden size={15} strokeWidth={2} />Код (как в накладных, например «20»)</label>
            <input value={code} onChange={(ev) => { setCode(ev.target.value); setError(''); }} required autoComplete="off" />
          </div>
          <div className="modal__field-row">
            <div className="modal__field">
              <label className="modal__label-icon"><FiSliders aria-hidden size={15} strokeWidth={2} />Вес 1 м³, кг — от</label>
              <input type="number" min="0" step="0.1" value={minKgM3} onChange={(ev) => setMinKgM3(ev.target.value)} required />
            </div>
            <div className="modal__field">
              <label className="modal__label-icon"><FiSliders aria-hidden size={15} strokeWidth={2} />Вес 1 м³, кг — до</label>
              <input type="number" min="0" step="0.1" value={maxKgM3} onChange={(ev) => setMaxKgM3(ev.target.value)} required />
            </div>
          </div>
          {error && <p className="modal__error">{error}</p>}
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={onClose} disabled={saving}><FiX aria-hidden size={16} strokeWidth={2} />Отмена</button>
            <button type="submit" className="btn btn--primary" disabled={saving}>
              <FiCheck aria-hidden size={16} strokeWidth={2} />
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MaterialsFoamTab = () => {
  const toast = useToast();
  const [lots, setLots] = useState([]);
  const [productionRuns, setProductionRuns] = useState([]);
  const [densityGrades, setDensityGrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState(SUB_TAB.LOTS);
  const [addOpen, setAddOpen] = useState(false);
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const [savingLot, setSavingLot] = useState(false);
  const [savingGrade, setSavingGrade] = useState(false);
  const [dateFilterIso, setDateFilterIso] = useState('');
  const [lotsSearch, setLotsSearch] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [movementsSearch, setMovementsSearch] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      const [lotsRes, runsRes, gradesRes] = await Promise.all([
        getFoamRawLots({ page_size: 500 }),
        getFoamProductionRuns({ page_size: 500 }),
        getFoamDensityGrades(),
      ]);
      setLots(lotsRes.data?.items || []);
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

  useOperationalRefetch(WS_FOAM_MATERIALS, fetchAll, true);

  const stats = useMemo(() => {
    const totalKg = lots.reduce((sum, l) => sum + Number(l.remaining_kg), 0);
    const activeLots = lots.filter((l) => Number(l.remaining_kg) > 0).length;
    return { totalKg, activeLots, gradesCount: densityGrades.length };
  }, [lots, densityGrades]);

  const movements = useMemo(() => {
    const income = lots.map((l) => ({
      id: `in-${l.id}`,
      type: 'in',
      qtyKg: l.received_kg,
      date: l.received_at,
      note: `Приход — ${l.material_name} (${l.supplier || '—'})`,
    }));
    const outcome = productionRuns.map((r) => ({
      id: `out-${r.id}`,
      type: 'out',
      qtyKg: r.input_kg,
      date: r.produced_at,
      note: `Списано в производство — ${r.material_name}${r.grade_code ? ` (плотность на выходе: ${r.grade_code})` : ''}`,
    }));
    return [...income, ...outcome].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [lots, productionRuns]);

  const visibleLots = useMemo(() => {
    let list = lots;
    if (dateFilterIso) {
      list = list.filter((l) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(l, ['received_at'])));
    }
    const q = lotsSearch.trim().toLowerCase();
    if (q) list = list.filter((l) => String(l.material_name || '').toLowerCase().includes(q));
    return list;
  }, [lots, dateFilterIso, lotsSearch]);

  const visibleMovements = useMemo(() => {
    let list = movements;
    if (dateFilterIso) {
      list = list.filter((m) => matchesClientDateFilter(dateFilterIso, pickFirstIsoDate(m, ['date'])));
    }
    const q = movementsSearch.trim().toLowerCase();
    if (q) list = list.filter((m) => String(m.note || '').toLowerCase().includes(q));
    return list;
  }, [movements, dateFilterIso, movementsSearch]);

  const visibleDensityGrades = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return densityGrades;
    return densityGrades.filter((g) => String(g.code || '').toLowerCase().includes(q));
  }, [densityGrades, catalogSearch]);

  const handleCreateLot = async (payload) => {
    setSavingLot(true);
    try {
      await createFoamRawLot(payload);
      await fetchAll();
      toast.success(`Приход добавлен: ${payload.material_name}, ${formatNumberForInput(payload.bag_weight_kg)} кг`);
    } finally {
      setSavingLot(false);
    }
  };

  const handleCreateGrade = async (payload) => {
    setSavingGrade(true);
    try {
      await createFoamDensityGrade(payload);
      await fetchAll();
      toast.success(`Плотность «${payload.code}» добавлена в справочник`);
    } finally {
      setSavingGrade(false);
    }
  };

  if (loading) return <Loading />;

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
          [SUB_TAB.LOTS, 'Остатки по лотам', FiPackage],
          [SUB_TAB.CATALOG, 'Каталог марок', FiBookOpen],
          [SUB_TAB.MOVEMENTS, 'Движения', FiRefreshCw],
        ].map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={subTab === key}
            className={`materials-tabs__tab${subTab === key ? ' materials-tabs__tab--active' : ''}`}
            onClick={() => setSubTab(key)}
          >
            <Icon aria-hidden size={16} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {subTab === SUB_TAB.LOTS && (
        <div className="chemistry-card">
          <div className="chemistry-card__head ds-toolbar ds-toolbar--in-card">
            <div className="ds-toolbar__start">
              <SearchInput placeholder="Поиск" value={lotsSearch} onChange={(e) => setLotsSearch(e.target.value)} />
              <span className="materials-foam-tab__warehouse-badge">{FOAM_WAREHOUSE_RAW}</span>
              <ClientDateFilter value={dateFilterIso} onChange={setDateFilterIso} id="materials-foam-lots-date" />
            </div>
            <div className="ds-toolbar__end">
              <button type="button" className="btn btn--primary" onClick={() => setAddOpen(true)}>
                <FiPlus aria-hidden size={16} strokeWidth={2} />
                Приход
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
                      <span className="chemistry-table__name chemistry-table__name--with-avatar chemistry-table__cell-clip">
                        <EntityAvatar name={lot.material_name} size={28} />
                        {lot.material_name}
                      </span>
                      <span className="chemistry-table__cell-clip">{lot.supplier || '—'}</span>
                      <span className="chemistry-table__num">
                        {formatNumberForInput(lot.remaining_kg)} / {formatNumberForInput(lot.received_kg)} кг
                      </span>
                      <span className="chemistry-table__status">{formatDateTime(lot.received_at)}</span>
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
            <div className="ds-toolbar__start">
              <SearchInput placeholder="Поиск по плотности" value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} />
            </div>
            <div className="ds-toolbar__end">
              <button type="button" className="btn btn--primary" onClick={() => setAddGradeOpen(true)}>
                <FiPlus aria-hidden size={16} strokeWidth={2} />
                Плотность
              </button>
            </div>
          </div>
          {visibleDensityGrades.length === 0 && <EmptyState title="Ничего не найдено" />}
          <div className="chemistry-table-wrap">
            <div className="chemistry-table materials-foam-tab__catalog-table">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Плотность</span>
                <span className="chemistry-table__th chemistry-table__th--num">Вес 1 м³ (насыпной)</span>
              </div>
              {visibleDensityGrades.map((g) => (
                <div key={g.code} className="chemistry-table__row">
                  <span className="chemistry-table__name chemistry-table__name--with-avatar">
                    <EntityAvatar name={g.code} size={28} />
                    {g.code}
                  </span>
                  <span className="chemistry-table__num">{g.min_kg_m3}–{g.max_kg_m3} кг/м³</span>
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
              <SearchInput placeholder="Поиск" value={movementsSearch} onChange={(e) => setMovementsSearch(e.target.value)} />
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

      {addOpen && <AddIntakeModal onClose={() => setAddOpen(false)} onCreate={handleCreateLot} saving={savingLot} />}
      {addGradeOpen && (
        <AddGradeModal
          existingCodes={densityGrades.map((g) => g.code)}
          onClose={() => setAddGradeOpen(false)}
          onCreate={handleCreateGrade}
          saving={savingGrade}
        />
      )}
    </div>
  );
};

export default MaterialsFoamTab;
