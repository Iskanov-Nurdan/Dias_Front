import React from 'react';
import {
  formatNumberForInput,
  parseLocaleNumber,
} from '../../../../shared/lib';
import { sumCompositionKg, compositionTotalSummaryText } from '../../lib/blankRecipeShared';

export const buildPreparedBreakdown = (blank, preparedRow) => {
  const recipeKg = Number(blank?.recipeKgPerBarrel) || 0;
  if (preparedRow && preparedRow.blankId) return preparedRow;
  return {
    recipeKgPerBarrel: recipeKg,
    barrels: 0,
    extraKg: 0,
    totalKg: 0,
    fromMachineRemainderKg: null,
    fromDefectKg: null,
    pureKg: null,
  };
};

const formatWorkshopNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return formatNumberForInput(value);
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  return formatNumberForInput(rounded);
};

const formatWorkshopKg = (value) => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return `${formatWorkshopNumber(value)} кг`;
};

const EmployeeBlankDetailContent = ({ blank, preparedRow, materialNameById, variant = 'modal' }) => {
  if (!blank) return null;

  const isPage = variant === 'page';
  const recipeKg = Number(blank.recipeKgPerBarrel) || 0;
  const breakdown = buildPreparedBreakdown(blank, preparedRow);
  const composition = Array.isArray(blank.composition) ? blank.composition : [];
  const sumKg = sumCompositionKg(composition);

  const fmtKgOpt = (v) => formatWorkshopKg(v);

  const m = breakdown.fromMachineRemainderKg;
  const b = breakdown.fromDefectKg;
  const p = breakdown.pureKg;
  const sumParts =
    m != null && Number.isFinite(Number(m)) && b != null && Number.isFinite(Number(b)) && p != null && Number.isFinite(Number(p))
      ? Number(m) + Number(b) + Number(p)
      : null;

  const rootClass = [
    'employee-prepare-detail',
    isPage ? 'employee-prepare-detail--page' : 'employee-prepare-detail--modal',
  ].join(' ');

  return (
    <div className={rootClass}>
      {recipeKg > 0 ? (
        <section className="employee-prepare-stock-panel">
          <h4 className="employee-prepare-stock-panel__title">Накоплено в цехе</h4>
          <div className="employee-prepare-stock-grid">
            <div className="employee-prepare-stock-metric employee-prepare-stock-metric--primary">
              <span className="employee-prepare-stock-metric__label">Всего заготовки</span>
              <span className="employee-prepare-stock-metric__value">
                {formatWorkshopNumber(breakdown.totalKg)}
                <span className="employee-prepare-stock-metric__unit">кг</span>
              </span>
            </div>
            <div className="employee-prepare-stock-metric">
              <span className="employee-prepare-stock-metric__label">1 бочка</span>
              <span className="employee-prepare-stock-metric__value">
                {formatWorkshopNumber(breakdown.recipeKgPerBarrel || recipeKg)}
                <span className="employee-prepare-stock-metric__unit">кг</span>
              </span>
            </div>
            <div className="employee-prepare-stock-metric">
              <span className="employee-prepare-stock-metric__label">Бочек</span>
              <span className="employee-prepare-stock-metric__value">
                {formatWorkshopNumber(breakdown.barrels)}
              </span>
            </div>
            <div className="employee-prepare-stock-metric">
              <span className="employee-prepare-stock-metric__label">Доп. кг</span>
              <span className="employee-prepare-stock-metric__value">
                {formatWorkshopNumber(breakdown.extraKg)}
                <span className="employee-prepare-stock-metric__unit">кг</span>
              </span>
            </div>
            <div className="employee-prepare-stock-metric">
              <span className="employee-prepare-stock-metric__label">Остаток машины</span>
              <span className="employee-prepare-stock-metric__value">{fmtKgOpt(m)}</span>
            </div>
            <div className="employee-prepare-stock-metric employee-prepare-stock-metric--warn">
              <span className="employee-prepare-stock-metric__label">Брак</span>
              <span className="employee-prepare-stock-metric__value">{fmtKgOpt(b)}</span>
            </div>
            <div className="employee-prepare-stock-metric employee-prepare-stock-metric--ok">
              <span className="employee-prepare-stock-metric__label">Чисто</span>
              <span className="employee-prepare-stock-metric__value">{fmtKgOpt(p)}</span>
            </div>
            {sumParts != null ? (
              <div className="employee-prepare-stock-metric employee-prepare-stock-metric--muted">
                <span className="employee-prepare-stock-metric__label">Сумма частей</span>
                <span className="employee-prepare-stock-metric__value">
                  {formatWorkshopNumber(sumParts)}
                  <span className="employee-prepare-stock-metric__unit">кг</span>
                </span>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <p className="modal__error">Нет recipe_kg_per_barrel — проверьте заготовку в админке.</p>
      )}

      <section className="employee-prepare-detail__recipe-block">
        <h4 className="employee-prepare-detail__h4 employee-prepare-detail__h4--recipe">Состав (рецепт)</h4>
        {composition.length === 0 ? (
          <p className="employee-prepare-detail__empty">Состав не передан в API или пустой.</p>
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
                const lab =
                  row.raw_material_name
                  || materialNameById.get(String(row.raw_material_id))
                  || `Сырьё #${row.raw_material_id}`;
                return (
                  <div
                    key={`${row.raw_material_id}-${idx}`}
                    className="employee-prepare-recipe-grid employee-prepare-recipe-grid--row"
                  >
                    <span>{lab}</span>
                    <span className="employee-prepare-recipe-grid__num">{formatWorkshopKg(q)}</span>
                  </div>
                );
              })
              .filter(Boolean)}
            {sumKg != null && Number.isFinite(sumKg) ? (
              <p className="employee-prepare-detail__recipe-total">
                {compositionTotalSummaryText(sumKg)}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
};

export default EmployeeBlankDetailContent;
