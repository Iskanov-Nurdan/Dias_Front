import React, { useMemo, useState, useEffect, useSyncExternalStore } from 'react';
import { useToast, EmptyState } from '../../../../shared/ui';
import { formatNumberForInput, parseLocaleNumber } from '../../../../shared/lib';
import {
  MOCK_RAW_MATERIALS,
  sumCompositionKg,
  compositionTotalSummaryText,
} from '../../lib/blankRecipeShared';
import {
  loadBlanks,
  subscribeEmployeePrepared,
  getEmployeePreparedSnapshot,
  getEmployeePreparedBreakdown,
  addEmployeeBarrel,
} from '../../lib/localBlankStore';
import '../ChemistryPage/ChemistryPage.scss';
import './EmployeePrepareBlanksPage.scss';

const materialLabel = (id) => {
  const m = MOCK_RAW_MATERIALS.find((x) => String(x.id) === String(id));
  return m?.name || `Сырьё #${id}`;
};

const EmployeeBlankDetailModal = ({ blank, onClose }) => {
  if (!blank) return null;
  const breakdown = getEmployeePreparedBreakdown(blank.id);
  const composition = Array.isArray(blank.composition) ? blank.composition : [];
  const sumKg = sumCompositionKg(composition);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal--wide employee-prepare-detail-modal"
        onClick={(ev) => ev.stopPropagation()}
        role="dialog"
        aria-labelledby="employee-prepare-detail-title"
      >
        <div className="modal__head">
          <h3 id="employee-prepare-detail-title">Подробности: {blank.name || 'Заготовка'}</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="modal__body employee-prepare-detail-modal__body">
          {breakdown ? (
            <section className="employee-prepare-detail-modal__summary">
              <h4 className="employee-prepare-detail-modal__h4">Накоплено в цехе</h4>
              <ul className="employee-prepare-detail-modal__stats">
                <li>
                  <span>1 бочка</span>
                  <strong>{formatNumberForInput(breakdown.recipeKgPerBarrel)} кг</strong>
                </li>
                <li>
                  <span>Бочек</span>
                  <strong>{formatNumberForInput(breakdown.barrels)}</strong>
                </li>
                <li>
                  <span>Доп. кг (после приёмки ГП)</span>
                  <strong>{formatNumberForInput(breakdown.extraKg)} кг</strong>
                </li>
                <li className="employee-prepare-detail-modal__stats-total">
                  <span>Всего заготовки</span>
                  <strong>{formatNumberForInput(breakdown.totalKg)} кг</strong>
                </li>
              </ul>
            </section>
          ) : (
            <p className="modal__error">Нет суммы кг по рецепту — админ должен заполнить состав.</p>
          )}

          <section className="employee-prepare-detail-modal__recipe-block">
            <h4 className="employee-prepare-detail-modal__h4">Состав (рецепт)</h4>
            {composition.length === 0 ? (
              <p className="employee-prepare-detail-modal__empty">Состав не задан.</p>
            ) : (
              <>
                <div className="employee-prepare-recipe-grid employee-prepare-recipe-grid--head">
                  <span>Сырьё</span>
                  <span className="employee-prepare-recipe-grid__num">Вес, кг</span>
                </div>
                {composition
                  .map((row, idx) => {
                    const q = parseLocaleNumber(row.quantity_per_unit ?? row.quantity ?? '');
                    if (!Number.isFinite(q) || q <= 0) return null;
                    return (
                      <div
                        key={`${row.raw_material_id}-${idx}`}
                        className="employee-prepare-recipe-grid employee-prepare-recipe-grid--row"
                      >
                        <span>{materialLabel(row.raw_material_id)}</span>
                        <span className="employee-prepare-recipe-grid__num">
                          {formatNumberForInput(q)} кг
                        </span>
                      </div>
                    );
                  })
                  .filter(Boolean)}
                {sumKg != null && Number.isFinite(sumKg) ? (
                  <p className="employee-prepare-detail-modal__recipe-total">
                    {compositionTotalSummaryText(sumKg)}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Цех: только готовят заготовку по рецепту админа (+бочки).
 * Остаток кг после приёмки ГП добавляется в эту же массу автоматически (см. localBlankStore).
 */
const EmployeePrepareBlanksPage = () => {
  const toast = useToast();
  const [blankRev, setBlankRev] = useState(0);
  const [detailBlank, setDetailBlank] = useState(null);
  const vPrep = useSyncExternalStore(
    subscribeEmployeePrepared,
    getEmployeePreparedSnapshot,
    getEmployeePreparedSnapshot,
  );

  useEffect(() => {
    const h = () => setBlankRev((x) => x + 1);
    window.addEventListener('dias-blanks-changed', h);
    return () => window.removeEventListener('dias-blanks-changed', h);
  }, []);

  const blanks = useMemo(() => {
    void blankRev;
    return loadBlanks();
  }, [blankRev]);

  const rows = useMemo(() => {
    void vPrep;
    void blankRev;
    return (blanks || []).map((b) => ({
      blank: b,
      breakdown: getEmployeePreparedBreakdown(b.id),
    }));
  }, [blanks, vPrep, blankRev]);

  const onAddBarrel = (blankId) => {
    if (addEmployeeBarrel(blankId)) {
      toast.show('Добавлена 1 бочка');
    } else {
      toast.show('Нет суммы кг по рецепту — проверьте состав в «Заготовка»');
    }
  };

  return (
    <div className="page page--chemistry chemistry-blank-stock">
      <div className="chemistry-card">
        <p className="chemistry-page__lede employee-prepare-blanks__lede">
          Рецепт задаёт админ в «Заготовка». «+ бочка» увеличивает накопленный объём на одну бочку (сумма кг по
          составу). Килограммы после частичной приёмки склада ГП автоматически прибавляются к той же заготовке.
        </p>
        {blanks.length === 0 ? (
          <EmptyState title="Нет рецептов — админ создаёт их в «Заготовка»" />
        ) : (
          <div className="chemistry-table-wrap">
            <div className="chemistry-table employee-prepare-table">
              <div className="chemistry-table__header">
                <span className="chemistry-table__th">Рецепт</span>
                <span className="chemistry-table__th chemistry-table__th--num">кг / бочка</span>
                <span className="chemistry-table__th chemistry-table__th--num">Бочек</span>
                <span className="chemistry-table__th chemistry-table__th--num">Доп. кг</span>
                <span className="chemistry-table__th chemistry-table__th--num">Всего, кг</span>
                <span className="chemistry-table__th chemistry-table__th--actions"> </span>
              </div>
              {rows.map(({ blank, breakdown }) => (
                <div key={blank.id} className="chemistry-table__row">
                  <span className="chemistry-table__name chemistry-table__cell-clip">
                    {blank.name || '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {breakdown
                      ? `${formatNumberForInput(breakdown.recipeKgPerBarrel)} кг`
                      : '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {breakdown ? formatNumberForInput(breakdown.barrels) : '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {breakdown ? `${formatNumberForInput(breakdown.extraKg)} кг` : '—'}
                  </span>
                  <span className="chemistry-table__num">
                    {breakdown ? `${formatNumberForInput(breakdown.totalKg)} кг` : '—'}
                  </span>
                  <span className="chemistry-table__actions chemistry-table__actions--wrap">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => setDetailBlank(blank)}
                    >
                      Подробности
                    </button>
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={!breakdown}
                      onClick={() => onAddBarrel(blank.id)}
                    >
                      + бочка
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {detailBlank ? (
        <EmployeeBlankDetailModal blank={detailBlank} onClose={() => setDetailBlank(null)} />
      ) : null}
    </div>
  );
};

export default EmployeePrepareBlanksPage;
