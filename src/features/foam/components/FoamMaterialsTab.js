import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  Boxes, Layers, History, Plus, PackagePlus, Search, Pencil, Trash2,
  ArrowDownToLine, ArrowUpFromLine, MoreVertical,
} from 'lucide-react';
import {
  fetchFoamRawLots, createFoamRawLot, updateFoamRawLot, deleteFoamRawLot,
  fetchFoamDensityGrades, createFoamDensityGrade, updateFoamDensityGrade, deleteFoamDensityGrade,
  fetchFoamProductionRuns,
} from '../api';
import { useToast } from '../../../app/providers/ToastProvider';
import { useDebounce } from '../../../shared/hooks/useDebounce';
import { getApiErrorMessage } from '../../../shared/lib/apiError';
import {
  ErrorState, EmptyState, SkeletonTable, ConfirmModal, ActionSheet, Fab, Subtabs,
} from '../../../shared/ui';
import FoamRawLotModal from './FoamRawLotModal';
import FoamDensityGradeModal from './FoamDensityGradeModal';
import './FoamMaterialsTab.scss';

const MOBILE_MQ = '(max-width: 768px)';

const SUB_LOTS = 'lots';
const SUB_GRADES = 'grades';
const SUB_MOVEMENTS = 'movements';

const SUBTABS = [
  { id: SUB_LOTS, label: 'Остатки по материалам', icon: Boxes },
  { id: SUB_GRADES, label: 'Каталог марок', icon: Layers },
  { id: SUB_MOVEMENTS, label: 'Движения', icon: History },
];

const normalize = (s) => (s || '').trim().toLowerCase();
const fmtKg = (n) => `${Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 })} кг`;
const dateFmt = (d) => (d ? new Date(d).toLocaleDateString('ru-RU') : '—');
const initials = (name) => (name || '?').trim().slice(0, 1).toUpperCase();

const materialStatus = (m) => {
  if (!(m.remaining > 0)) return 'empty';
  if (m.remaining < m.received * 0.15) return 'low';
  return 'ok';
};

const STATUS_LABEL = { ok: 'В наличии', low: 'Заканчивается', empty: 'Пусто' };

/**
 * Лот (партия/биг-бэг) — внутренняя FIFO-единица бэкенда, но в этом UI её
 * никогда не показываем и не называем: пользователь мыслит материалами
 * («Дияр гранул»), а не номерами партий. Каждая карточка ниже — материал,
 * агрегированный по всем его лотам; «Приход» добавляет новый лот под
 * капотом, но с точки зрения пользователя просто пополняет остаток.
 */
const FoamMaterialsTab = () => {
  const toast = useToast();
  const [sub, setSub] = useState(SUB_LOTS);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const syncMobile = () => setIsMobile(mq.matches);
    syncMobile();
    mq.addEventListener('change', syncMobile);
    return () => mq.removeEventListener('change', syncMobile);
  }, []);

  const [lots, setLots] = useState([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [lotsError, setLotsError] = useState(null);
  const [lotModal, setLotModal] = useState(null); // { variant: 'new'|'replenish'|'rename', material? }
  const [lotSaving, setLotSaving] = useState(false);
  const [lotError, setLotError] = useState(null);
  const [confirmDeleteMaterial, setConfirmDeleteMaterial] = useState(null);
  const [materialSearch, setMaterialSearch] = useState('');
  const debouncedMaterialSearch = useDebounce(materialSearch);
  const [menuMaterial, setMenuMaterial] = useState(null);

  const loadLots = useCallback(() => {
    setLotsLoading(true);
    setLotsError(null);
    fetchFoamRawLots({ pageSize: 100 }, null)
      .then((data) => setLots(data.items))
      .catch((err) => setLotsError(getApiErrorMessage(err)))
      .finally(() => setLotsLoading(false));
  }, []);

  useEffect(() => { loadLots(); }, [loadLots]);

  const materials = useMemo(() => {
    const byName = new Map();
    for (const l of lots) {
      if (!byName.has(l.material_name)) {
        byName.set(l.material_name, { name: l.material_name, supplier: l.supplier, remaining: 0, received: 0, lots: [] });
      }
      const m = byName.get(l.material_name);
      m.remaining += Number(l.remaining_kg);
      m.received += Number(l.received_kg);
      m.lots.push(l);
    }
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [lots]);

  const materialsFiltered = useMemo(() => {
    const q = normalize(debouncedMaterialSearch);
    if (!q) return materials;
    return materials.filter((m) => normalize(m.name).includes(q) || normalize(m.supplier).includes(q));
  }, [materials, debouncedMaterialSearch]);

  const [grades, setGrades] = useState([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [gradesError, setGradesError] = useState(null);
  const [gradeModal, setGradeModal] = useState(null); // null закрыто, {} новая, объект марки — правка
  const [gradeSaving, setGradeSaving] = useState(false);
  const [gradeError, setGradeError] = useState(null);
  const [confirmDeleteGrade, setConfirmDeleteGrade] = useState(null);
  const [gradeSearch, setGradeSearch] = useState('');
  const debouncedGradeSearch = useDebounce(gradeSearch);
  const [menuGrade, setMenuGrade] = useState(null);

  const loadGrades = useCallback(() => {
    setGradesLoading(true);
    setGradesError(null);
    fetchFoamDensityGrades(null)
      .then(setGrades)
      .catch((err) => setGradesError(getApiErrorMessage(err)))
      .finally(() => setGradesLoading(false));
  }, []);

  useEffect(() => { loadGrades(); }, [loadGrades]);

  const gradesFiltered = useMemo(() => {
    const q = normalize(debouncedGradeSearch);
    if (!q) return grades;
    return grades.filter((g) => normalize(g.code).includes(q));
  }, [grades, debouncedGradeSearch]);

  // Движения — свой журнал apps.foam для этого не заводился, собираем на
  // клиенте: приход = лоты, расход = производственные запуски (тот же приём,
  // что был в старом фронте). Номер лота в подписи не показываем — та же
  // логика, что и в основной таблице.
  const [runs, setRuns] = useState([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movementsError, setMovementsError] = useState(null);
  const [movementsSearch, setMovementsSearch] = useState('');
  const debouncedMovementsSearch = useDebounce(movementsSearch);

  const loadMovements = useCallback(() => {
    setMovementsLoading(true);
    setMovementsError(null);
    fetchFoamProductionRuns({ pageSize: 100 }, null)
      .then((data) => setRuns(data.items))
      .catch((err) => setMovementsError(getApiErrorMessage(err)))
      .finally(() => setMovementsLoading(false));
  }, []);

  useEffect(() => { if (sub === SUB_MOVEMENTS) loadMovements(); }, [sub, loadMovements]);

  const movements = useMemo(() => {
    const income = lots.map((l) => ({
      key: `lot-${l.id}`,
      date: l.received_at,
      label: `Приход: ${l.material_name}`,
      kg: Number(l.received_kg),
      direction: 'in',
    }));
    const outcome = runs.map((r) => ({
      key: `run-${r.id}`,
      date: r.produced_at,
      label: `Производство: ${r.material_name || 'материал'}`,
      kg: Number(r.input_kg),
      direction: 'out',
    }));
    return [...income, ...outcome].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [lots, runs]);

  const movementsFiltered = useMemo(() => {
    const q = normalize(debouncedMovementsSearch);
    if (!q) return movements;
    return movements.filter((m) => normalize(m.label).includes(q));
  }, [movements, debouncedMovementsSearch]);

  const handleSaveLot = async (payload) => {
    setLotError(null);
    setLotSaving(true);
    try {
      if (lotModal.variant === 'rename') {
        await Promise.all(
          lotModal.material.lots.map((l) => updateFoamRawLot(l.id, { materialName: payload.materialName, supplier: payload.supplier }, null)),
        );
        toast.success('Материал обновлён');
      } else {
        await createFoamRawLot(payload, null);
        toast.success('Приход оформлен');
      }
      setLotModal(null);
      loadLots();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setLotError(msg);
      toast.error(msg);
    } finally {
      setLotSaving(false);
    }
  };

  const handleDeleteMaterial = async () => {
    const material = confirmDeleteMaterial;
    if (!material) return;
    setConfirmDeleteMaterial(null);
    const results = await Promise.allSettled(material.lots.map((l) => deleteFoamRawLot(l.id, null)));
    const failed = results.filter((r) => r.status === 'rejected');
    loadLots();
    if (failed.length === 0) {
      toast.success('Материал удалён');
    } else if (failed.length < results.length) {
      toast.error(`Удалены не все партии: ${failed.length} из ${results.length} уже использованы`);
    } else {
      toast.error(getApiErrorMessage(failed[0].reason));
    }
  };

  const handleSaveGrade = async (payload) => {
    setGradeError(null);
    setGradeSaving(true);
    try {
      if (gradeModal?.id) {
        await updateFoamDensityGrade(gradeModal.id, payload, null);
        toast.success('Марка обновлена');
      } else {
        await createFoamDensityGrade(payload, null);
        toast.success('Марка добавлена');
      }
      setGradeModal(null);
      loadGrades();
    } catch (err) {
      const msg = getApiErrorMessage(err);
      setGradeError(msg);
      toast.error(msg);
    } finally {
      setGradeSaving(false);
    }
  };

  const handleDeleteGrade = () => {
    if (!confirmDeleteGrade) return;
    deleteFoamDensityGrade(confirmDeleteGrade.id, null)
      .then(() => {
        setConfirmDeleteGrade(null);
        loadGrades();
        toast.success('Марка удалена');
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err));
        setConfirmDeleteGrade(null);
      });
  };

  const closeMaterialMenu = () => setMenuMaterial(null);
  const handleMaterialMenuAction = (action) => {
    if (!menuMaterial) return;
    const m = menuMaterial;
    closeMaterialMenu();
    action(m);
  };

  const closeGradeMenu = () => setMenuGrade(null);
  const handleGradeMenuAction = (action) => {
    if (!menuGrade) return;
    const g = menuGrade;
    closeGradeMenu();
    action(g);
  };

  const renderLotsMobile = () => (
    <div className="foam-materials__cards">
      {materialsFiltered.map((m, idx) => {
        const status = materialStatus(m);
        return (
          <article
            key={m.name}
            className="foam-materials__card"
            style={{ '--row-i': idx }}
            onClick={() => setLotModal({ variant: 'rename', material: m })}
          >
            <span className={`foam-materials__avatar foam-materials__avatar--${status}`}>{initials(m.name)}</span>
            <div className="foam-materials__card-info">
              <div className="foam-materials__card-name">{m.name}</div>
              <div className="foam-materials__card-sub">
                <span className={`foam-materials__status foam-materials__status--${status}`}>
                  <span className="foam-materials__status-dot" />
                  {fmtKg(m.remaining)} из {fmtKg(m.received)}
                </span>
              </div>
              {m.supplier && <div className="foam-materials__card-supplier">{m.supplier}</div>}
            </div>
            <button
              type="button"
              className="foam-materials__card-menu-btn"
              aria-label="Действия"
              onClick={(e) => { e.stopPropagation(); setMenuMaterial(m); }}
            >
              <MoreVertical size={17} />
            </button>
          </article>
        );
      })}
    </div>
  );

  const renderGradesMobile = () => (
    <div className="foam-materials__cards">
      {gradesFiltered.map((g, idx) => (
        <article
          key={g.id ?? g.code}
          className="foam-materials__card"
          style={{ '--row-i': idx }}
          onClick={() => setGradeModal(g)}
        >
          <span className="foam-materials__avatar foam-materials__avatar--grade"><Layers size={15} /></span>
          <div className="foam-materials__card-info">
            <div className="foam-materials__card-name">{g.code}</div>
            <div className="foam-materials__card-sub">{Number(g.min_kg_m3).toFixed(2)} кг/м³</div>
          </div>
          <button
            type="button"
            className="foam-materials__card-menu-btn"
            aria-label="Действия"
            onClick={(e) => { e.stopPropagation(); setMenuGrade(g); }}
          >
            <MoreVertical size={17} />
          </button>
        </article>
      ))}
    </div>
  );

  const renderMovementsMobile = () => (
    <div className="foam-materials__cards">
      {movementsFiltered.map((m, idx) => (
        <article key={m.key} className="foam-materials__card foam-materials__card--static" style={{ '--row-i': idx }}>
          <span className={`foam-materials__movement-icon foam-materials__movement-icon--${m.direction}`}>
            {m.direction === 'in' ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
          </span>
          <div className="foam-materials__card-info">
            <div className="foam-materials__card-name">{m.label}</div>
            <div className="foam-materials__card-sub">{dateFmt(m.date)}</div>
          </div>
          <span className={`foam-materials__movement-qty foam-materials__movement-qty--${m.direction}`}>
            {m.direction === 'in' ? '+' : '−'}{fmtKg(m.kg)}
          </span>
        </article>
      ))}
    </div>
  );

  return (
    <div className="foam-materials">
      <Subtabs items={SUBTABS} activeId={sub} onChange={setSub} />

      <div className="foam-materials__toolbar">
        {sub === SUB_LOTS && (
          <div className="ui-search foam-materials__search">
            <Search size={16} className="ui-search__icon" />
            <input type="text" placeholder="Поиск по материалу, поставщику" value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} className="ui-search__input" />
          </div>
        )}
        {sub === SUB_GRADES && (
          <div className="ui-search foam-materials__search">
            <Search size={16} className="ui-search__icon" />
            <input type="text" placeholder="Поиск по коду марки" value={gradeSearch} onChange={(e) => setGradeSearch(e.target.value)} className="ui-search__input" />
          </div>
        )}
        {sub === SUB_MOVEMENTS && (
          <div className="ui-search foam-materials__search">
            <Search size={16} className="ui-search__icon" />
            <input type="text" placeholder="Поиск по операции" value={movementsSearch} onChange={(e) => setMovementsSearch(e.target.value)} className="ui-search__input" />
          </div>
        )}
        <div className="foam-materials__toolbar-actions">
          {sub === SUB_LOTS && (
            <button type="button" className="foam-materials__add" onClick={() => setLotModal({ variant: 'new' })}>
              <PackagePlus size={16} /> Новый материал
            </button>
          )}
          {sub === SUB_GRADES && (
            <button type="button" className="foam-materials__add" onClick={() => setGradeModal({})}>
              <Plus size={16} /> Марка плотности
            </button>
          )}
        </div>
      </div>

      {sub === SUB_LOTS && (
        lotsError ? <ErrorState message={lotsError} onRetry={loadLots} /> : (
          <div className={isMobile ? '' : 'foam-materials__panel'}>
            {lotsLoading ? (
              <SkeletonTable rows={6} cols={4} />
            ) : !materialsFiltered.length ? (
              <EmptyState message={debouncedMaterialSearch ? 'Ничего не найдено' : 'Материалов пока нет'} actionLabel={debouncedMaterialSearch ? undefined : 'Новый материал'} onAction={debouncedMaterialSearch ? undefined : () => setLotModal({ variant: 'new' })} />
            ) : isMobile ? (
              renderLotsMobile()
            ) : (
              <table className="foam-materials__table">
                <thead>
                  <tr>
                    <th>Материал</th>
                    <th>Поставщик</th>
                    <th>Остаток</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {materialsFiltered.map((m, idx) => {
                    const status = materialStatus(m);
                    return (
                      <tr key={m.name} style={{ '--row-i': idx }}>
                        <td>
                          <div className="foam-materials__name-cell">
                            <span className="foam-materials__avatar">{initials(m.name)}</span>
                            <span className="foam-materials__name-text">{m.name}</span>
                          </div>
                        </td>
                        <td className="foam-materials__supplier-cell">{m.supplier || '—'}</td>
                        <td>
                          <span className="foam-materials__remaining">{fmtKg(m.remaining)}</span>
                          <span className="foam-materials__muted"> из {fmtKg(m.received)}</span>
                        </td>
                        <td>
                          <span className={`foam-materials__status foam-materials__status--${status}`}>
                            <span className="foam-materials__status-dot" />
                            {STATUS_LABEL[status]}
                          </span>
                        </td>
                        <td>
                          <div className="foam-materials__row-actions">
                            <button type="button" className="foam-materials__pill-btn" onClick={() => setLotModal({ variant: 'replenish', material: m })}>
                              <PackagePlus size={13} /> Приход
                            </button>
                            <button type="button" className="foam-materials__icon-btn" title="Переименовать" onClick={() => setLotModal({ variant: 'rename', material: m })}><Pencil size={13} /></button>
                            <button type="button" className="foam-materials__icon-btn foam-materials__icon-btn--danger" title="Удалить" onClick={() => setConfirmDeleteMaterial(m)}><Trash2 size={13} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {sub === SUB_GRADES && (
        gradesError ? <ErrorState message={gradesError} onRetry={loadGrades} /> : (
          <div className={isMobile ? '' : 'foam-materials__panel'}>
            {gradesLoading ? (
              <SkeletonTable rows={4} cols={3} />
            ) : !gradesFiltered.length ? (
              <EmptyState message={debouncedGradeSearch ? 'Ничего не найдено' : 'Марок пока нет'} actionLabel={debouncedGradeSearch ? undefined : 'Марка плотности'} onAction={debouncedGradeSearch ? undefined : () => setGradeModal({})} />
            ) : isMobile ? (
              renderGradesMobile()
            ) : (
              <table className="foam-materials__table">
                <thead><tr><th>Код</th><th>Плотность</th><th></th></tr></thead>
                <tbody>
                  {gradesFiltered.map((g, idx) => (
                    <tr key={g.id ?? g.code} style={{ '--row-i': idx }}>
                      <td>
                        <div className="foam-materials__name-cell">
                          <span className="foam-materials__avatar foam-materials__avatar--grade"><Layers size={13} /></span>
                          <span className="foam-materials__name-text">{g.code}</span>
                        </div>
                      </td>
                      <td className="foam-materials__remaining">{g.min_kg_m3} кг/м³</td>
                      <td>
                        <div className="foam-materials__row-actions">
                          <button type="button" className="foam-materials__icon-btn" title="Изменить" onClick={() => setGradeModal(g)}><Pencil size={13} /></button>
                          <button type="button" className="foam-materials__icon-btn foam-materials__icon-btn--danger" title="Удалить" onClick={() => setConfirmDeleteGrade(g)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      {sub === SUB_MOVEMENTS && (
        movementsError ? <ErrorState message={movementsError} onRetry={loadMovements} /> : (
          <div className={isMobile ? '' : 'foam-materials__panel'}>
            {movementsLoading ? (
              <SkeletonTable rows={6} cols={3} />
            ) : !movementsFiltered.length ? (
              <EmptyState message={debouncedMovementsSearch ? 'Ничего не найдено' : 'Движений пока нет'} />
            ) : isMobile ? (
              renderMovementsMobile()
            ) : (
              <table className="foam-materials__table">
                <thead><tr><th>Дата</th><th>Операция</th><th>Кг</th></tr></thead>
                <tbody>
                  {movementsFiltered.map((m, idx) => (
                    <tr key={m.key} style={{ '--row-i': idx }}>
                      <td className="foam-materials__muted">{dateFmt(m.date)}</td>
                      <td>
                        <div className="foam-materials__movement-cell">
                          <span className={`foam-materials__movement-icon foam-materials__movement-icon--${m.direction}`}>
                            {m.direction === 'in' ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}
                          </span>
                          {m.label}
                        </div>
                      </td>
                      <td className={`foam-materials__movement-qty foam-materials__movement-qty--${m.direction}`}>
                        {m.direction === 'in' ? '+' : '−'}{fmtKg(m.kg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      )}

      <ActionSheet open={!!menuMaterial} onClose={closeMaterialMenu} title={menuMaterial?.name}>
        <button type="button" className="action-sheet__item" onClick={() => handleMaterialMenuAction((m) => setLotModal({ variant: 'replenish', material: m }))}>
          <PackagePlus size={17} /> Приход
        </button>
        <button type="button" className="action-sheet__item" onClick={() => handleMaterialMenuAction((m) => setLotModal({ variant: 'rename', material: m }))}>
          <Pencil size={17} /> Переименовать
        </button>
        <button type="button" className="action-sheet__item action-sheet__item--danger action-sheet__item--divider" onClick={() => handleMaterialMenuAction(setConfirmDeleteMaterial)}>
          <Trash2 size={17} /> Удалить
        </button>
      </ActionSheet>

      <ActionSheet open={!!menuGrade} onClose={closeGradeMenu} title={menuGrade?.code}>
        <button type="button" className="action-sheet__item" onClick={() => handleGradeMenuAction(setGradeModal)}>
          <Pencil size={17} /> Изменить
        </button>
        <button type="button" className="action-sheet__item action-sheet__item--danger action-sheet__item--divider" onClick={() => handleGradeMenuAction(setConfirmDeleteGrade)}>
          <Trash2 size={17} /> Удалить
        </button>
      </ActionSheet>

      {lotModal && (
        <FoamRawLotModal
          variant={lotModal.variant}
          materialName={lotModal.material?.name}
          supplier={lotModal.material?.supplier}
          onSave={handleSaveLot}
          onClose={() => { setLotModal(null); setLotError(null); }}
          error={lotError}
          saving={lotSaving}
        />
      )}
      {gradeModal && (
        <FoamDensityGradeModal
          grade={gradeModal.id ? gradeModal : null}
          onSave={handleSaveGrade}
          onClose={() => { setGradeModal(null); setGradeError(null); }}
          error={gradeError}
          saving={gradeSaving}
        />
      )}
      {confirmDeleteMaterial && (
        <ConfirmModal
          title="Удалить материал?"
          message={`«${confirmDeleteMaterial.name}» — ${confirmDeleteMaterial.lots.length} партий. Партии, которые уже расходовались, останутся (это защищает историю производства).`}
          confirmText="Удалить"
          onConfirm={handleDeleteMaterial}
          onCancel={() => setConfirmDeleteMaterial(null)}
          danger
        />
      )}
      {confirmDeleteGrade && (
        <ConfirmModal
          title="Удалить марку?"
          message={`Марка «${confirmDeleteGrade.code}». Доступно только если марка ещё не использована в производстве или на складе.`}
          confirmText="Удалить"
          onConfirm={handleDeleteGrade}
          onCancel={() => setConfirmDeleteGrade(null)}
          danger
        />
      )}

      {sub === SUB_LOTS && <Fab onClick={() => setLotModal({ variant: 'new' })} label="Новый материал" />}
      {sub === SUB_GRADES && <Fab onClick={() => setGradeModal({})} label="Новая марка плотности" />}
    </div>
  );
};

export default FoamMaterialsTab;
