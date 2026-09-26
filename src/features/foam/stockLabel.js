export const OUTPUT_LABEL = { cube: 'Куб', granule: 'Гранулят', sheet: 'Лист' };

/**
 * Единица измерения остатка/выпуска по формату — гранулят взвешивают (кг),
 * куб и лист считают поштучно (шт). apps.foam.FoamGpStock.qty — одно и то же
 * Decimal-поле для всех форматов, смысл (шт/кг) зависит от output_format —
 * см. apps/foam/formulas.py: granule_output_qty() буквально возвращает кг,
 * cube_output_qty()/sheets_from_cut() — штуки. Единый источник правды для
 * всех мест, где показывается qty (касса, склад, производство), чтобы не
 * разъезжались по смыслу так же, как раньше разъехались подписи.
 */
export const FOAM_UNIT = { cube: 'шт', sheet: 'шт', granule: 'кг' };
export const foamUnit = (outputFormat) => FOAM_UNIT[outputFormat] || 'шт';

/**
 * Общая подпись позиции склада ГП Foam. Код марки один не говорит ничего
 * о разнице между марками ("Дияр" vs "Максат") — рядом всегда показываем
 * диапазон плотности (grade_density_range с бэка, apps.foam
 * FoamGpStockSerializer.get_grade_density_range), если он есть.
 */
export const stockLabel = (s) => {
  const parts = [OUTPUT_LABEL[s.output_format] || s.output_format];
  if (s.grade_code) {
    parts.push(s.grade_density_range ? `${s.grade_code} (${s.grade_density_range})` : s.grade_code);
  }
  if (s.thickness_cm) parts.push(`${s.thickness_cm} см`);
  return parts.join(' · ');
};
