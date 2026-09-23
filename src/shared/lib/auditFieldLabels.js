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
  // EmployeeFormModal.js: «Имя (логин)», «Роль»; is_active — как везде
  // («Активен», см. ProfileDetailModal.js и другие записи этого словаря).
  'accounts.user': {
    name: 'Имя',
    role: 'Роль',
    is_active: 'Активен',
  },
  // RolesList.js — карточки ролей по name; description/is_system в UI нет.
  'accounts.role': {
    name: 'Название',
    description: 'Описание',
  },
  // Все FoamRawLot/FoamProductionRun/FoamGpStock/FoamSale — Foam-раздел
  // «Сырьё»/«Производство»/«Склад»/«Касса» (переключатель линии Foam).
  // Подписи взяты из verbose_name самих Django-полей (DIas_ERP/apps/foam/
  // models.py) — они уже написаны по-русски авторами бэкенда, отдельных
  // подписей в формах фронта для части из них ещё нет (страницы в процессе
  // миграции), поэтому используем их как есть.
  'foam.foamrawlot': {
    lot_number: 'Номер лота',
    material_name: 'Материал',
    supplier: 'Поставщик',
    bag_weight_kg: 'Вес мешка, кг',
    received_kg: 'Приход, кг',
    remaining_kg: 'Остаток, кг',
    unit_price: 'Цена за единицу, сом',
    received_at: 'Дата прихода',
  },
  'foam.foamproductionrun': {
    lot: 'Лот сырья',
    grade: 'Марка плотности',
    input_kg: 'Расход сырья, кг',
    output_format: 'Формат выхода',
    output_qty: 'Выход',
    produced_at: 'Дата выпуска',
    operator: 'Оператор',
  },
  'foam.foamgpstock': {
    output_format: 'Формат',
    grade: 'Марка плотности',
    thickness_cm: 'Толщина, см',
    qty: 'Остаток',
  },
  'foam.foamsale': {
    client: 'Клиент',
    sale_date: 'Дата продажи',
    total_amount: 'Сумма',
    paid_amount: 'Оплачено',
    payment_status: 'Статус оплаты',
  },
  // ShiftsPage.js — вкладка «Фотоотчёты»; user = «Сотрудник» (как у Shift).
  'production.shiftphotoreport': {
    user: 'Сотрудник',
    description: 'Комментарий',
  },
  // production.RecipeRun — «замес» перед партией ОТК. Раздел ещё не
  // мигрирован на этот фронт целиком (нет своей формы), подписи — из
  // verbose_name модели и уже принятых в словаре слов («Линия»).
  'production.reciperun': {
    recipe: 'Рецепт',
    line: 'Линия',
    production_batch: 'Партия ОТК',
  },
  // Прайс-листы и цены клиентов — на этот фронт ещё не перенесены (нет своей
  // страницы), но бэкенд их уже пишет в общий журнал. Подписи — verbose_name.
  'sales.pricelist': {
    name: 'Название прайса',
    is_active: 'Активен',
    valid_from: 'Действует с',
    valid_to: 'Действует по',
    comment: 'Комментарий',
  },
  'sales.clientprice': {
    client: 'Клиент',
    profile: 'Профиль',
    product: 'Товар',
    price: 'Цена',
    unit: 'Единица',
    valid_from: 'Действует с',
    valid_to: 'Действует по',
    comment: 'Комментарий',
  },
};

// Поля-«техника»: внутренняя бухгалтерия аудита без пользовательского
// смысла (id записи, служебный снимок бывшей линии/рецепта) — для них на
// сайте нет и не может быть «человеческого» названия, поэтому не подписываем
// их вслепую, а просто не показываем в списке. Действует для любой модели —
// эти имена по всему DIas_ERP всегда одно и то же (см. Shift, RecipeRun,
// Line.delete() в apps/production/models.py — паттерн снимка при обнулении FK).
const HIDDEN_FIELDS = new Set([
  'id',
  'former_line_id', 'line_name_snapshot',
  'former_recipe_id', 'recipe_name_snapshot',
]);

// То же самое, но только для конкретной модели — поле называется иначе в
// разных местах, вслепую прятать по имени для всех моделей нельзя (например
// «email» у sales.client — нормальное поле, прятать не нужно).
const HIDDEN_FIELDS_BY_ENTITY = {
  // email/date_joined/is_staff/is_superuser/is_system у User нигде в UI не
  // показываются и не редактируются (email генерится бэкендом из имени, см.
  // EmployeeFormModal.js).
  'accounts.user': new Set(['email', 'date_joined', 'is_staff', 'is_superuser', 'is_system']),
  'accounts.role': new Set(['is_system']),
  // «Устарело: раньше помечало списание по замесу (не используется)» — по
  // verbose_name самого поля в apps/production/models.py.
  'production.reciperun': new Set(['recipe_run_consumption_applied']),
};

export const isHiddenAuditField = (fieldKey, entityType) =>
  HIDDEN_FIELDS.has(fieldKey) || HIDDEN_FIELDS_BY_ENTITY[entityType]?.has(fieldKey) === true;
