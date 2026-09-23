// Фронтенд-словарь подписей полей для журнала действий (apps.activity).
// Бэкенд присылает `field_labels` только для части моделей (см.
// AUDIT_FIELD_LABELS в DIas_ERP/apps/activity/audit_messages.py) — для
// остальных (Пенопласт, Цех) поле в модалке «Подробнее» показывалось как
// сырое имя из Django-модели (code, min_kg_m3, id...). Бэкенд не трогаем —
// достраиваем подписи на фронте теми же русскими названиями, что уже
// используются в формах на сайте, только там, где backend не покрыл.
//
// Ключ верхнего уровня — entry.entity_type ("app_label.model_name", бэкенд
// уже отдаёт его в API, см. UserActivitySerializer). Значение бэкенда
// (entry.field_labels) всегда приоритетнее — этот словарь только дополняет.
export const FRONTEND_FIELD_LABELS = {
  // FoamDensityGradeModal.js: «Код марки», «Плотность, кг/м³»
  'foam.foamdensitygrade': {
    code: 'Код марки',
    min_kg_m3: 'Плотность мин., кг/м³',
    max_kg_m3: 'Плотность макс., кг/м³',
  },
  // BlankFormModal.js: «Название»; FloorDetailModal.js STATS: «1 бочка»;
  // ProfileDetailModal.js: is_active показывается как «Активен»/«Неактивен»
  'workshop.workshopblank': {
    name: 'Название',
    recipe_kg_per_barrel: '1 бочка, кг',
    plastic_profile: 'Профиль',
    is_active: 'Активен',
    comment: 'Комментарий',
  },
  // CompositionRowsEditor.js: «Сырьё», состав считается в кг
  'workshop.workshopblankcompositionline': {
    blank: 'Заготовка',
    raw_material: 'Сырьё',
    quantity_kg: 'Количество, кг',
  },
  // production.shift: line/status/opened_at/closed_at/comment уже переводит
  // бэкенд — здесь только то, что он не покрыл. user = «Сотрудник» (тот же
  // подписи, что в шапке ActivityLogPage.js — колонка «Сотрудник», фильтр
  // «Все сотрудники»).
  'production.shift': {
    user: 'Сотрудник',
  },
};

// Поля-«техника»: внутренняя бухгалтерия аудита без пользовательского
// смысла (id записи, служебный снимок бывшей линии смены) — для них на
// сайте нет и не может быть «человеческого» названия, поэтому не подписываем
// их вслепую, а просто не показываем в списке. Действует для любой модели.
const HIDDEN_FIELDS = new Set(['id', 'former_line_id', 'line_name_snapshot']);

export const isHiddenAuditField = (fieldKey) => HIDDEN_FIELDS.has(fieldKey);
