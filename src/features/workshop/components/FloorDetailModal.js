import React, { useState, useEffect, useCallback } from 'react';
import {
  Warehouse, PackagePlus, LayoutGrid, History,
} from 'lucide-react';
import {
  Loading, ErrorState, Pagination, FormModal, Subtabs,
} from '../../../shared/ui';
import { fetchPreparedBlankDetail, fetchBlankDetail } from '../api';
import { fetchProductionRuns } from '../../production/api';
import { ProductionRunsList } from '../../production/components';
import './BlankModal.scss';
import './FloorDetailModal.scss';

const TAB_OVERVIEW = 'overview';
const TAB_HISTORY = 'history';

const TABS = [
  { id: TAB_OVERVIEW, label: 'Обзор', icon: LayoutGrid },
  { id: TAB_HISTORY, label: 'История', icon: History },
];

const formatKg = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} кг` : '—';
};

/** «625 кг» → «625 кг» + «(625 кг 0 г)» — та же разбивка, что была в старом «Цехе». */
const formatKgWithGrams = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const wholeKg = Math.trunc(n);
  const grams = Math.round((n - wholeKg) * 1000);
  return `${formatKg(n)} (${wholeKg} кг ${grams} г)`;
};

const STATS = [
  { key: 'total_kg', label: 'Всего заготовки', accent: true },
  { key: 'recipe_kg_per_barrel', label: '1 бочка' },
  { key: 'barrels', label: 'Бочек', raw: true },
  { key: 'extra_kg', label: 'Доп. кг' },
  { key: 'from_machine_remainder_kg', label: 'Остаток машины' },
  { key: 'from_defect_kg', label: 'Брак', danger: true },
  { key: 'pure_kg', label: 'Чисто', success: true },
  { key: 'total_kg', label: 'Сумма частей' },
];

/**
 * blankId — открываем и дозагружаем свежие данные (не доверяем кэшу списка).
 * refreshToken меняется в родителе после «+Бочка» откуда угодно (из строки
 * списка или из шапки этого же окна) — по нему тихо перечитываем обзор,
 * не закрывая и не перемонтируя окно.
 */
const FloorDetailModal = ({ blankId, blankName, refreshToken, onClose, onRequestAddBarrel, addingBarrel }) => {
  const [activeTab, setActiveTab] = useState(TAB_OVERVIEW);
  const [prepared, setPrepared] = useState(null);
  const [blank, setBlank] = useState(null);
  const [error, setError] = useState(null);

  const loadOverview = useCallback(() => {
    setError(null);
    Promise.all([fetchPreparedBlankDetail(blankId, null), fetchBlankDetail(blankId, null)])
      .then(([p, b]) => { setPrepared(p); setBlank(b); })
      .catch(() => setError('Не удалось загрузить данные'));
  }, [blankId]);

  useEffect(() => { loadOverview(); }, [loadOverview, refreshToken]);

  const [runsPage, setRunsPage] = useState(1);
  const [runs, setRuns] = useState(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState(null);

  const loadRuns = useCallback(() => {
    setRunsLoading(true);
    setRunsError(null);
    fetchProductionRuns({ blankId, page: runsPage, pageSize: 10 }, null)
      .then((data) => setRuns(data))
      .catch(() => setRunsError('Не удалось загрузить историю'))
      .finally(() => setRunsLoading(false));
  }, [blankId, runsPage]);

  useEffect(() => {
    if (activeTab === TAB_HISTORY) loadRuns();
  }, [activeTab, loadRuns]);

  const loading = !error && (!prepared || !blank);
  const compositionTotal = (blank?.composition ?? []).reduce((s, l) => s + Number(l.quantity_kg || 0), 0);

  return (
    <FormModal
      icon={Warehouse}
      eyebrow="Цех"
      title={blankName}
      onClose={onClose}
      size="fullscreen"
      className="fdm"
      headerExtra={(
        <button
          type="button"
          className="ui-modal-btn ui-modal-btn--primary fdm__add-barrel"
          onClick={onRequestAddBarrel}
          disabled={addingBarrel}
        >
          <PackagePlus size={14} /> {addingBarrel ? 'Добавляем…' : 'Бочка'}
        </button>
      )}
    >
      <Subtabs items={TABS} activeId={activeTab} onChange={setActiveTab} />

      <div className="fdm__scroll">
        {activeTab === TAB_OVERVIEW && (
          <div className="form-modal__body fdm__body">
            {error && <ErrorState message={error} onRetry={loadOverview} />}
            {loading && !error && <Loading />}
            {prepared && blank && (
              <>
                <p className="fdm__section-label">Накоплено в цехе</p>
                <div className="fdm__stats">
                  {STATS.map((s) => (
                    <div key={s.label} className={`fdm__stat${s.accent ? ' fdm__stat--accent' : ''}`}>
                      <span className="fdm__stat-label">{s.label}</span>
                      <span className={`fdm__stat-value${s.danger ? ' fdm__stat-value--danger' : ''}${s.success ? ' fdm__stat-value--success' : ''}`}>
                        {s.raw ? prepared[s.key] : formatKg(prepared[s.key])}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="fdm__composition">
                  <h3 className="fdm__section-title">Состав (рецепт)</h3>
                  <div className="fdm__rows">
                    {(blank.composition ?? []).map((l) => (
                      <div key={l.raw_material_id} className="fdm__row">
                        <span className="fdm__row-name">{l.raw_material_name}</span>
                        <span className="fdm__row-value">{formatKg(l.quantity_kg)}</span>
                      </div>
                    ))}
                  </div>
                  <p className="fdm__total">Общий итог: <strong>{formatKgWithGrams(compositionTotal)}</strong></p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === TAB_HISTORY && (
          <div className="form-modal__body fdm__body">
            <ProductionRunsList
              items={runs?.items}
              loading={runsLoading}
              error={runsError}
              onRetry={loadRuns}
            />
            <Pagination
              meta={runs?.meta}
              currentPage={runsPage}
              onPage={setRunsPage}
              loading={runsLoading}
              entityLabel="партий"
            />
          </div>
        )}
      </div>

      <div className="form-modal__actions">
        <button type="button" className="ui-modal-btn ui-modal-btn--primary" onClick={onClose}>Закрыть</button>
      </div>
    </FormModal>
  );
};

export default FloorDetailModal;
