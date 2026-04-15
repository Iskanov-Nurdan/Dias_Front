# Полная документация UI и поведения фронтенда (фактическое состояние кода)

Базовый URL API: через `apiClient` (относительные пути ниже — как в коде, без префикса `/api/`).

Доступ к разделам: `react-router` + `ProtectedRoute` с `requiredAccess` по ключу из `user.accesses`. При отсутствии доступа к конкретному разделу выполняется редирект на первый доступный маршрут из `getDefaultHomePath` или на `/forbidden`. Разделы «Клиенты» и «Продажи» монтируются в маршруты только если `STAGE2_TABS_ENABLED === true` в `src/shared/config/constants.js` (сейчас `true`).

---

## 1. Страницы

### 1.1. Сырьё (`/materials`, `MaterialsPage`)

**Заголовок страницы в разметке:** «Склад сырья».

**Вкладки (переключение `mainTab`):**

| Вкладка | Содержимое |
|---------|------------|
| Справочник | Таблица на данных `GET materials/balances/`. |
| Остатки | Та же выборка балансов, другие колонки (без действий в строке). |
| Партии | `GET incoming/` с `page=1`, `page_size=500`, `ordering=-received_at`. |
| История движения | `GET materials/movements/` с теми же лимитами; при ответе 404 список пустой, текст пустого состояния упоминает необходимость эндпоинта на бэкенде. |

**Верхняя панель карточки (общая для всех вкладок):**

- Слева (только на вкладке «Справочник»): `Select` фильтр остатка: «Все» / «Ниже минимума» / «Норма»; поле «Поиск» по имени сырья (регистронезависимо, подстрока); при `lowStockCount > 0` — текст «Ниже минимума: N».
- Справа всегда: кнопка «Добавить сырьё»; кнопка «Оформить приход».

**Действия и ограничения по строкам (вкладка «Справочник»):**

- «Оформить приход» — `disabled`, если нет идентификатора материала в строке (`material_id` / `id` / `raw_material_id`).
- «Редактировать» — то же.
- «Деактивировать» — только если `is_active !== false`.
- «Удалить» — только если `b.deletable === true` (флаг с бэка).

**Поведение в реальном времени:** при событиях `raw_material`, `incoming`, `material_balance`, `material_writeoff`, `material_movement` вызывается общий refetch балансов, incoming и movements.

**Замечание по UI:** фильтр и поиск слева отображаются только на «Справочнике», но кнопки «Добавить сырьё» и «Оформить приход» остаются на остальных вкладках.

---

### 1.2. Химия (`/chemistry`, `ChemistryPage`)

**Вкладки:** URL для не-каталога: `?tab=stock`, `?tab=batches`; каталог — без query или с очисткой параметров.

| Вкладка | Данные |
|---------|--------|
| Справочник | `GET chemistry/elements/?page=1&page_size=500&ordering=name`; остаток в строке смешивается с `GET chemistry/balances/` по id элемента. |
| Остатки | Только `GET chemistry/balances/`. |
| Партии | `GET chemistry/batches/?page=1&page_size=500&ordering=-created_at`. |

**Кнопки панели:**

- «Справочник»: «Добавить химию», «Выпуск».
- «Остатки»: «Выпуск».

**Таблица справочника — колонки:** Название; Остаток; Минимальный остаток; Статус; Действия.

**Действия в строке справочника:**

- Кнопка «Выпуск» — открывает модалку выпуска с предзаполненным id этой химии.
- `ActionMenu`: «Редактировать»; «Состав»; при активной — «Деактивировать»; при `deletable === true` — «Удалить».

**Состав:** загрузка `GET chemistry/elements/{id}/` при открытии модалки состава.

**Refetch по WS:** `chemistry`, `chemistry_element`, `chemistry_balance`, `chemistry_batch`, `material_balance`.

---

### 1.3. Рецепты (`/recipes`, `RecipesPage`)

**Верх страницы:** если список профилей пуст после загрузки — баннер-ссылка «Создать профиль» на `/profiles`.

**Фильтр по профилю из URL:** `?filter_profile_id=<id>` — список рецептов фильтруется на клиенте по `profile_id` / `profile.id`. Баннер «Рецепты профиля: …» и кнопка «Все рецепты» (сброс query).

**Панель:** поле «Поиск» — меняет `query.search` и сбрасывает `page` на 1; запрос `GET recipes/?...` (пустые поля query не уходят в строку запроса).

**Кнопка «Добавить рецепт»:** `disabled`, если нет ни одного профиля (`plastic-profiles/` пуст); `title` с подсказкой.

**Таблица — колонки:** Название; Профиль; Компонентов; Статус; Действия.

**Строка кликабельна целиком** (кроме кликов по кнопкам и меню): открывает модалку просмотра рецепта. Клавиши Enter/Space на фокусе строки — открывают просмотр.

**Действия в строке:** «Редактировать»; меню: «Состав», «Проверка остатков», при активном — «Деактивировать», при `deletable` — «Удалить».

**Refetch:** события `recipe`, `recipes`.

---

### 1.4. Профили (`/profiles`, `PlasticProfilesPage`)

**Панель:** поиск по названию, коду, id (подстрока, клиентский фильтр).

**Кнопка:** «Добавить профиль».

**Таблица — колонки:** Название; Код; Есть рецепт (да/нет по наличию рецептов с этим `profile_id` из общего списка `GET recipes/`); Статус; Действия.

**Действия:** «Создать рецепт» — навигация на `/recipes?profile_id=<id>&open=recipe` (страница рецептов сама читает query и открывает форму создания с заблокированным профилем, затем удаляет `open` и `profile_id` из URL). Меню: «Рецепты» → `/recipes?filter_profile_id=<id>`; «Редактировать»; «Деактивировать» / «Удалить» (`deletable`).

**Refetch:** `plastic_profile`, `recipe`, `recipes`, `production_batch`, `batch`.

---

### 1.5. Производство (`/production`, `ProductionPage`)

**В разметке нет элемента с классом `page__title` / заголовка уровня страницы** — сразу карточка с таблицей.

**Панель:** поиск по строке (линия, профиль, рецепт, id, комментарий) — клиентский фильтр по уже загруженному списку.

**Кнопка:** «Новая партия» — открывает `ProductionBatchModal` без привязки к линии (`lineId` не передан).

**Данные:** `GET batches/?page=1&page_size=100&ordering=-created_at`.

**Таблица — колонки:** Создано; Профиль; Рецепт; Линия; Шт; Длина, м; Метры; Сом/м; Сом/шт; Статус; Действия.

**Действия в строке:** при выполнении условий `canSendProductionBatchToOtk(b)` — кнопка «В ОТК»; в меню — «Детали» (модалка `ProductionBatchDetailModal`).

**Refetch:** `production_batch`, `batch`, `line`, `shift`.

---

### 1.6. ОТК (`/otk`, `OTKPage`)

**Вкладки:** «Ожидают» / «История».

**Ожидают:** запрос через `getBatchesAwaitingOtk`: сначала `GET otk/pending/` с query (`page`, `page_size`, `search`, `ordering`); при 404 или 405 — `GET batches/` с теми же query. `FilterBar`: поиск, сортировка «Дата (возр./убыв.)». Пагинация по `meta` ответа.

**История:** `GET batches/` с `page`, `page_size`, `search`, `ordering` (по умолчанию `-date`), `otk_status` (пусто / `accepted` / `rejected`). Пагинация.

**Строка истории** кликабельна — открывает `HistoryDetailModal` (только чтение).

**Refetch по WS:** в списке триггеров указан также `recipe_run` (отдельного UI под recipe run нет).

---

### 1.7. Склад (`/warehouse`, `WarehousePage`)

**Панель фильтров:** текстовый поиск (`search`); `Select` статуса: пусто / `available` / `reserved` / `shipped`; `Select` формы: пусто / `unpacked` / `packed` / `open_package`. При смене фильтра сбрасывается `page` на 1.

**Кнопка «Упаковать»:** дублируется — в тулбаре (скрыта на мобильном классом) и в блоке `ds-sticky-mobile-actions`.

**Таблица:** клик по строке или Enter/Space — модалка деталей партии (`buildWarehouseBatchCardRows`).

**Меню в строке:** пункт «Резерв» — `disabled`, если `status` строки в нижнем регистре не равен `available`.

**Запрос списка:** `GET warehouse/batches/` с текущим `queryState` (`page_size: 20`). **В интерфейсе нет элементов пагинации** — при `meta.pages > 1` перелистывание страниц пользователем из UI недоступно.

**Refetch:** `warehouse_batch`, `production_batch`, `batch`.

---

### 1.8. Продажи (`/sales`, `SalesPage`)

Доступен только при включённом `STAGE2_TABS_ENABLED` и праве `sales`.

**Панель:** кнопка «Создать» (дубликат для мобильного sticky).

**Список:** `GET sales/?page=1&page_size=20` — **без поиска и фильтров на странице**.

**Таблица — колонки:** Дата; Клиент; Профиль / партия; Количество; Выручка; Себестоимость; Прибыль; меню.

**Клик по строке:** открывает модалку создания/редактирования продажи.

**Меню:** «Накладная» (загрузка); «Удалить» — `DELETE sales/{id}/`.

**Параллельная загрузка:** при монтировании и после операций — `GET clients/?page_size=500` (в выпадающий список попадают клиенты с `is_active !== false` и `active !== false`) и `GET warehouse/batches/?page_size=500&status=available` для выбора партии.

**Refetch:** `sale`, `warehouse_batch`.

---

## 2. Формы (поля, обязательность, API, проверки на фронте)

### 2.1. Сырьё — «Добавить сырьё» (`AddCatalogMaterialModal`)

| Поле | Обязательность | В API |
|------|----------------|--------|
| Название | HTML `required` | `POST raw-materials/` — `name` |
| Единица | Select кг/г | `unit` |
| Минимальный остаток | нет | `min_balance` только если число валидно и ≥ 0 |
| Комментарий | нет | `comment` если непустой |
| Статус | Select | `is_active` |

Проверка: при непустом минимуме — `parseLocaleNumber`; если не число или &lt; 0 — `onSubmit` не вызывается (молчаливый return).

---

### 2.2. Сырьё — «Редактировать» (`EditMaterialModal`)

`PATCH raw-materials/{id}/`: `name`, `is_active`, `min_balance` (число или `null` для сброса), `comment` (пустая строка если очищено), `unit` **только если** не `unitLocked` (блокировка: `unit_locked` / `unit_change_allowed === false` / `has_receipts` / `has_movements` / счётчики движений).

---

### 2.3. Сырьё — «Приход» (`ReplenishModal`)

Режим выбора сырья: кнопка «Оформить приход» без строки открывает `pickMaterial: true` и грузит `GET raw-materials/?page_size=500`.

| Поле | Обязательность | API `POST incoming/` |
|------|----------------|----------------------|
| Сырьё (в режиме выбора) | логически да | `material_id` |
| Количество | `required` + проверка `qty > 0` | `quantity` |
| Цена за единицу | `required`, `price >= 0` | `unit_price` |
| Дата прихода | `required` | `received_at` в ISO из `datetime-local` |
| Поставщик, документ, комментарий | нет | опциональные поля |

Кнопка submit `disabled`, если не выбран/не разрешён `material_id`. Единица только read-only из карточки.

---

### 2.4. Химия — добавление (`AddChemistryModal`)

`POST chemistry/elements/`: `name`, `unit`, `is_active`, `recipe_lines: []`, `min_balance` (число или `null`), опционально `comment`.

Фронт: пустое имя — текст ошибки; минимум — неотрицательное число или пусто.

---

### 2.5. Химия — редактирование (`EditChemistryModal`)

`PATCH chemistry/elements/{id}/`: как выше без `recipe_lines`; `unit` добавляется только если не заблокирован (`has_batches` или `batches_count`).

---

### 2.6. Химия — состав (`CompositionModal`)

`PATCH chemistry/elements/{id}/` с телом `{ recipe_lines: [...] }`, каждая строка `{ raw_material_id, quantity_per_unit }` — только строки с валидным id и q &gt; 0.

Проверки: минимум одна валидная строка; запрет дубликатов `raw_material_id`.

---

### 2.7. Химия — выпуск (`ProduceChemistryModal`)

Каталог: `GET chemistry/elements/?page_size=500`, в Select только `is_active !== false`.

`POST chemistry/elements/produce/`: `chemistry_id`, `quantity`, опционально `comment`.

Проверка: id и quantity &gt; 0; submit `disabled` без выбранной химии.

---

### 2.8. Профиль (`ProfileMetaModal`)

`POST plastic-profiles/` / `PATCH plastic-profiles/{id}/`: `name`, `code`, `is_active`, `comment` (пустая строка если пусто).

Кнопка сохранения `disabled`, пока не заполнены имя и код.

---

### 2.9. Рецепт — карточка (`RecipeMetaModal`)

Создание: `POST recipes/` с телом: `recipe`, `product` (оба = введённое название), `profile_id`, `base_unit: 'per_meter'`, `is_active`, `comment`, при создании дополнительно `components: []`.

Редактирование: `PATCH recipes/{id}/` — то же без принудительного `components: []` в этом обработчике (отправляется то, что собрано в `handleSubmit`).

Проверка: непустое имя и выбранный профиль (`profile_id` число &gt; 0). При создании из профиля query `open=recipe&profile_id=` поле профиля только текстом, id зафиксирован.

---

### 2.10. Рецепт — состав (`RecipeCompositionModal`)

Загрузка: `GET recipes/{id}/`. Сохранение: `PATCH recipes/{id}/` с `base_unit: 'per_meter'` и массивом `components`: для сырья `{ type: 'raw_material', material_id, quantity_per_meter, unit: 'кг' }`, для химии `{ type: 'chemistry', chemistry_id, quantity_per_meter, unit: 'кг' }`.

Проверки при добавлении строки: выбран составной ключ `raw:id` или `chem:id`; количество &gt; 0; нет дубликата тип+id. При сохранении: хотя бы одна строка с числом quantity ≥ 0 после фильтрации.

---

### 2.11. ProductionBatch — создание (`ProductionBatchModal`)

**С линией (со страницы линий):** `lineId` задан — блок выбора линии скрыт, в POST уходит этот `line`.

**С производства:** `needsLinePick` — загрузка линий `GET lines/?page_size=200&eligible_for_production_batch=true&eligible_for_recipe_run=true`, в выпадающий список попадают только линии с открытой сменой и без паузы (`isLineEligibleForBatch`).

`POST batches/`: `profile`, `recipe`, `line`, `pieces` (целое `Math.floor`), `length_per_piece`, опционально `comment`. Поля `profile`/`recipe`/`line` — числовые id.

Проверки: наличие профилей; выбран профиль и рецепт из отфильтрованного по профилю списка; pieces &gt; 0; length &gt; 0; line id валиден и при выборе линии — линия в списке допустимых.

---

### 2.12. ProductionBatch — детали (`ProductionBatchDetailModal`)

`GET batches/{id}/`. Редактирование: `PATCH batches/{id}/` — только `pieces`, `length_per_piece`, `comment` (пустая строка допускается).

Кнопка «Редактировать» показывается только если `batchMetaEditable(batch)`. «Отправить в ОТК» — если `canSendProductionBatchToOtk` и не режим редактирования формы; `POST batches/{id}/submit-for-otk/` с пустым телом.

---

### 2.13. ОТК — приёмка (`AcceptModal`)

Логика количества «к проверке»: `pieces ?? quantity` иначе `released` / `produced` / 0.

`POST batches/{id}/otk_accept/` — тело собирается в `acceptBatch`: строковые `otk_accepted`, `otk_defect`, числовые `accepted`, `rejected`, вычисляемый `otk_status` (`rejected` если брак &gt; 0 и принято 0, иначе `accepted`), опционально `otk_defect_reason`, `otk_comment`, `otk_inspector` (только если передан `inspectorId` — **в форме поле только имя**, `inspectorId` из UI не задаётся), `otk_inspector_name`, `otk_checked_at`.

Проверки: `a + d > 0`; если `produced > 0`, то **строго** `a + d === produced`; при браке &gt; 0 — непустая причина. Поля «Принято» и «Брак» при `produced > 0` связаны автоподстановкой второго при изменении первого. Submit `disabled` при неверной сумме.

---

### 2.14. Склад — резерв (`ReserveModal`)

`POST warehouse/batches/reserve/`: `batch_id`, `quantity` (число), опционально `sale_id` из блока «Дополнительно».

Поле «Продукт» в форме привязано к `batch.product` (в `setReserveTarget` передаётся ключ `product` с текстовым названием — **это одно и то же поле**, отображается название).

---

### 2.15. Склад — упаковка (`PackFromOtkModal`)

`POST warehouse/batches/package/` через `packFromOtk`: `product_id`, `shift_height`, `shift_width`, `width_meters` (= ширина), `angle_deg`, `pieces_per_package`, `packages_count`, `unit_meters` (= высота), `package_total_meters` (= округлённое `ipp * height`).

Проверки: выбран продукт; высота &gt; 0, ширина ≥ 0, угол — число; целые ipp и количество упаковок ≥ 1; сумма ipp×pk не больше доступного количества неупакованного остатка с совпадающим продуктом и тройкой размеров (данные из предзагрузки `GET warehouse/batches/?page_size=200&status=available&inventory_form=unpacked`).

---

### 2.16. Продажа (`SaleModal`)

Создание: `POST sales/`; редактирование: `PATCH sales/{id}/`.

Тело (создание/обновление) включает: `client_id` и дублирующий `client` как число при выборе клиента; `product` = id продукта из каталога, извлечённый из выбранной партии (`readCatalogProductIdFromWarehouseBatch`); `warehouse_batch`, `warehouse_batch_id`; `sale_mode` — `packages` или `pieces`; `sold_pieces`; при упаковках — `sold_packages`; опционально `length_per_piece`; `quantity`, `quantity_unit`, `quantity_input`; `stock_form`; условно `piece_pick` (`from_sealed_package` / `from_open_package`; для неупакованного `loose_remainder` поле **не** отправляется); опционально `override_pieces_per_package`, `price`, `comment`, `sale_date` и `date`.

Правила единиц: для партии «Упаковано» (`packed`) радиокнопка «Упаковки» включена, «Штуки» disabled; для не-упакованного наоборот — «Упаковки» disabled. При новой продаже и смене партии подставляется кратность в поле override для упакованных.

Submit `disabled` при: ошибке конвертации количества, превышении остатка, отсутствии `catalogProductId`, невалидных `sold_pieces`.

После успешного создания показывается фаза «Продажа создана» с кнопкой накладной (без автозакрытия).

---

## 3. Таблицы (колонки, данные, действия)

Сводка по основным таблицам уже частично в разделе 1. Дополнения:

- **Сырьё / движения:** действий в строке нет; при ошибке не 404 показывается `ErrorState`.
- **Химия / партии:** только просмотр, без действий.
- **Рецепты:** число компонентов из массива `components`/`composition` или поля `components_count`.
- **Производство:** статус из эвристики `batchProductionLifecycleRu` по полям партии.
- **ОТК ожидают:** одна кнопка «Проверить» в строке.
- **ОТК история:** клик по строке без отдельной кнопки действий.

---

## 4. User flow (пошагово: действия пользователя → API)

### 4.1. Создание профиля

1. `/profiles` → «Добавить профиль».
2. Заполнить название, код, опционально комментарий, статус.
3. «Создать» → `POST plastic-profiles/` с телом из формы.
4. Список обновляется через локальный refetch запросов страницы.

---

### 4.2. Создание рецепта

**Вариант А (со страницы профилей):** «Создать рецепт» у профиля → переход на `/recipes?profile_id=…&open=recipe` → `RecipesPage` ставит `lockedProfileForCreate`, открывает `RecipeMetaModal` с зафиксированным профилем, очищает query.

**Вариант Б:** `/recipes` → «Добавить рецепт» (если есть профили) → выбор профиля в модалке → `POST recipes/`.

**Состав:** в списке рецептов меню «Состав» или из просмотра → `RecipeCompositionModal` → `GET recipes/{id}/`, затем `PATCH recipes/{id}/` с компонентами.

---

### 4.3. Выпуск химии

1. `/chemistry` (любая вкладка со кнопкой или строка справочника) → «Выпуск».
2. Выбор химии (если не предзаполнено), количество, опционально комментарий.
3. «Выпустить» → `POST chemistry/elements/produce/`.
4. Refetch элементов, балансов и партий химии.

---

### 4.4. Создание ProductionBatch

**С `/production`:** «Новая партия» → модалка с выбором линии среди открытых без паузы → `POST batches/`.

**С `/lines`:** у открытой не на паузе линии кнопка «Партия производства» видна только если пользователь `is_superuser` **или** имеет доступ `production` → модалка с фиксированным `lineId` (поле выбора линии скрыто) → `POST batches/`.

---

### 4.5. ОТК

1. На производстве: «В ОТК» у подходящей партии → подтверждение → `POST batches/{id}/submit-for-otk/`.
2. Либо в деталях партии «Отправить в ОТК» при тех же условиях.
3. В `/otk`, вкладка «Ожидают» → «Проверить» → заполнение принято/брак/причина/комментарий/инспектор/дата → `POST batches/{id}/otk_accept/`.

---

### 4.6. Продажа

1. `/sales` → «Создать».
2. Дата, клиент (можно «Без клиента»), партия склада (список только `available`), единица (ограничена формой хранения партии), количество, цена, комментарий.
3. «Сохранить» → `POST sales/`.
4. Экран успеха; опционально «Накладная» → `downloadSaleWaybill` (логика в `salesApi`).

---

## 5. Фильтры и поиск

| Место | Элементы | Как работает |
|-------|-----------|--------------|
| Сырьё, вкладка Справочник | Select остатка + input | Клиентская фильтрация массива балансов |
| Рецепты | Input в query к API | `search` в `GET recipes/` |
| Рецепты | URL `filter_profile_id` | Клиентский фильтр |
| Профили | Input | Клиентский фильтр |
| Производство | Input | Клиентский фильтр загруженных 100 партий |
| ОТК | `FilterBar` на обеих вкладках | Параметры уходят в запросы pending/history |
| Склад | search + два Select | Параметры `GET warehouse/batches/` |
| Продажи | — | Нет фильтров на странице списка |

---

## 6. Модалки (перечень по продуктовым разделам)

| Модалка | Где открывается | Действия |
|---------|-----------------|----------|
| AddCatalogMaterialModal | Сырьё | Создание сырья |
| EditMaterialModal | Сырьё | Сохранение правок |
| ReplenishModal | Сырьё | Приход |
| ConfirmModal | Сырьё | Удаление, деактивация |
| AddChemistryModal / EditChemistryModal / CompositionModal / ProduceChemistryModal | Химия | CRUD, состав, выпуск |
| ConfirmModal | Химия | Деактивация, удаление |
| ProfileMetaModal | Профили | Создание/редактирование |
| ConfirmModal | Профили | Деактивация, удаление |
| RecipeMetaModal / RecipeCompositionModal / RecipeDetailModal / AvailabilityModal | Рецепты | Мета, состав, просмотр, сырой ответ availability |
| ConfirmModal | Рецепты | Удаление, деактивация |
| ProductionBatchModal | Производство, Линии | Создание партии |
| ProductionBatchDetailModal | Производство | Просмотр, правка, ОТК |
| ConfirmModal | Производство | Подтверждение отправки в ОТК |
| ShiftParamsModal / ShiftPauseModal / ShiftResumeModal / LineFormModal / LineHistorySessionModal | Линии | Смены, линии, история |
| ProductionBatchModal | Линии | Создание партии с привязкой к линии |
| AcceptModal / HistoryDetailModal | ОТК | Приёмка, просмотр записи истории |
| WarehouseBatchDetailModal / ReserveModal / PackFromOtkModal | Склад | Детали, резерв, упаковка |
| SaleModal + ConfirmModal удаления | Продажи | Создание/редактирование, удаление |

---

## 7. Recipe Run

- Отдельной страницы, таба, таблицы или кнопки «Recipe run» в приложении **нет**.
- Строка `eligible_for_recipe_run: true` передаётся только в запросе списка линий для выбора линии в модалке **ProductionBatch** (вместе с `eligible_for_production_batch`), на состав UI это не выводится.
- Событие `recipe_run` участвует в подписке operational refetch на странице ОТК наряду с партиями — **только автообновление данных**, без отображения сущности recipe run.
- Путаница с производством на уровне интерфейса: оба сценария (производство и линии) открывают одну и ту же модалку `ProductionBatchModal` и создают одну и ту же сущность через `POST batches/`. Разница: с линий `line` зашит в модалке; с производства линию нужно выбрать. Отдельного мастера «recipe run» нет.

---

## 8. Ограничения и блокировки UI

- **Маршруты продаж/клиентов:** отсутствуют при `STAGE2_TABS_ENABLED === false`.
- **Рецепт без профиля:** кнопка создания неактивна.
- **Партия без открытой смены:** в модалке нет подходящих линий, сообщение об ошибке в форме.
- **Партия с линий:** кнопка «Партия производства» скрыта без роли `production` и не у суперпользователя; также скрыта на паузе.
- **Редактирование партии в деталях:** скрыто после передачи в ОТК / по флагам жизненного цикла (`batchMetaEditable`).
- **«В ОТК» в списке производства:** только если `canSendProductionBatchToOtk`.
- **Резерв на складе:** только для `status === 'available'`.
- **Продажа:** нельзя сохранить, если у выбранной партии нет id продукта для каталога (`catalogProductMissing`).
- **Удаление сырья/химии/рецепта/профиля:** кнопка не показывается, если `deletable !== true`.
- **Единица сырья/химии:** блокировка Select при `unitLocked` / истории производства у химии.
- **ОТК:** кнопка «Сохранить» неактивна, пока сумма принято+брак не совпадает с выпуском (если выпуск известен и &gt; 0).

---

## 9. Наблюдаемые особенности поведения (не нормы, а факт кода)

1. Заголовок страницы сырья в UI — «Склад сырья», хотя в навигации раздел назван «Сырьё и остатки».
2. Страница производства **не выводит** заголовок `<h1 class="page__title">` в JSX (в отличие от других страниц).
3. Склад передаёт `page` и `page_size` в API, но **не рисует** переключатель страниц.
4. Очередь ОТК сначала бьёт в `otk/pending/`, при отсутствии метода падает обратно на общий `batches/` — поведение списка «Ожидают» зависит от наличия эндпоинта.
5. В форме ОТК поле инспектора заполняет только имя; `inspectorId` в API из этой формы не передаётся.
6. `recipe_run` в коде фигурирует только как параметр запроса линий и как триггер refetch; пользовательского экрана Recipe Run нет — при проверке соответствия бизнес-логике это разрыв между доменной сущностью (если она есть на бэке) и UI.

---

*Документ составлен по исходникам: страницы в `src/features/*/components`, модалки, `src/features/*/api`, `src/app/routes/AppRoutes.jsx`, `src/shared/config/navigation.js`, `src/shared/config/constants.js`.*
