# FRONTEND_AUDIT_DOC_V3 — фактическая документация UI (код на момент составления)

Документ составлен **только по текущему коду** репозитория `Dias_Front`. Пути — относительно корня репозитория. Если отдельной страницы/фичи в маршрутах нет — указано явно.

**База API:** `src/shared/config/api.js` — `API_BASE = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api').replace(/\/?$/, '/')`. HTTP-клиент: `src/shared/api/client.js` (`apiClient`, axios, Bearer из `localStorage`, заголовки `X-Audit-Shift-Id` / `X-Shift-Id` при открытой личной смене из `getAuditShiftId()`).

**Список ответов:** `src/shared/lib/apiList.js` — `parseApiListResponse`: массив как есть, иначе `data.items`, иначе `data.results`, иначе `[]`.

---

## 1. Общая карта UI

### 1.1. Маршруты

Источник: `src/app/routes/AppRoutes.jsx`.

| Путь | Компонент страницы | Доступ (`requiredAccess`) |
|------|---------------------|---------------------------|
| `/login` | `LoginPage` | нет |
| `/` (index) | `DefaultHomeRedirect` → первый доступный путь из `getDefaultHomePath` | `ProtectedRoute` без ключа |
| `/users` | `UsersPage` | `users` |
| `/lines` | `LinesPage` | `lines` |
| `/production` | `ProductionPage` | `production` |
| `/materials` | `MaterialsPage` | `materials` |
| `/chemistry` | `ChemistryPage` | `chemistry` |
| `/recipes` | `RecipesPage` | `recipes` |
| `/profiles` | `PlasticProfilesPage` | `recipes` (тот же ключ, что и рецепты) |
| `/otk` | `OTKPage` | `otk` |
| `/warehouse` | `WarehousePage` | `warehouse` |
| `/analytics` | `AnalyticsPage` | `analytics` |
| `/my-shift` | `MyShiftPage` | `my_shift` |
| `/shifts` | `ShiftsReportPage` | `shifts` |
| `/clients` | `ClientsPage` | `clients` (только если `STAGE2_TABS_ENABLED`) |
| `/sales` | `SalesPage` | `sales` (только если `STAGE2_TABS_ENABLED`) |
| `/forbidden` | встроенный `PlaceholderPage` | без доп. ключа |
| `*` | редирект на `/` | — |

Флаг: `src/shared/config/constants.js` — `STAGE2_TABS_ENABLED = true` (маршруты клиентов/продаж включены).

**В коде не найдено** отдельных маршрутов для: заказов (`orders`), отгрузок (`shipments`) — ключи есть в `ACCESS_GROUPS` / `ACCESS_KEYS`, но в `AppRoutes.jsx` страниц под них нет.

### 1.2. Layout

- **`MainLayout`**: `src/app/components/MainLayout/MainLayout.jsx`.
  - Левая колонка: логотип «D», при развёрнутом сайдбаре текст «DIAS LINE», кнопка сворачивания, навигация по секциям из `getNavSections()` (`src/shared/config/navigation.js`), фильтрация пунктов по `user.accesses`.
  - Карточка пользователя внизу сайдбара: аватар-иконка, `user.name || user.email || 'Пользователь'`, подпись роли `user.role_name || user.role?.name || 'Администратор'`, кнопка выхода.
  - **Верх страницы (header в layout):** `header.main-layout__header` с кнопкой мобильного меню и **`<h1 className="main-layout__page-title">`**, текст = подпись активного пункта меню (`ACCESS_LABELS[accessKey]` или переопределение `label` у ссылки) либо `'DIAS LINE'`.
  - Контент: `<Outlet />` внутри `main.main-layout__main` → `div.main-layout__viewport`.

### 1.3. Page title в layout vs заголовок в теле страницы

- **Заголовок уровня 1 в layout** всегда совпадает с пунктом бокового меню (например «Моя смена», «Сырьё и остатки»).
- **Внутри страниц** часто есть **дополнительные заголовки**:
  - Страницы с **`<h1 className="page__title">`**: `MaterialsPage` («Склад сырья»), `ChemistryPage` («Химия»), `RecipesPage` («Рецепты»), `PlasticProfilesPage` («Профили»).
  - **`MyShiftPage`**: нет `page__title`; блок `my-shift__header` с **`<h1 className="my-shift__greeting">Привет, …`**, т.е. при активном пункте меню «Моя смена» в layout и в теле **два разных крупных заголовка**.
  - **`LinesPage`**: нет общего `page__title`; заголовки вкладок через **`<h2 className="lines-card__title">`** («Линии», «Открытие / закрытие линии»).
  - **`ProductionPage`**, **`OTKPage`**, **`WarehousePage`**, **`SalesPage`**, **`ClientsPage`**, **`AnalyticsPage`**, **`UsersPage`**, **`ShiftsReportPage`**: в разметке **нет** `page__title` / `h1` с названием раздела на уровне страницы (заголовок только в `MainLayout`).

### 1.4. Компонент `PageHeader`

- `src/shared/ui/PageHeader/PageHeader.jsx` — **`<h2>`** + опционально описание и `actions`.
- **В коде не найдено** импортов `PageHeader` в перечисленных страницах фич (grep по `src/features`); используется, например, только определение в `shared/ui`.

### 1.5. Повторяющиеся блоки (по коду)

- Паттерн **`ds-toolbar` + `ds-sticky-mobile-actions`** с дублированием primary-кнопки для мобильных: `UsersPage`, `WarehousePage`, `ClientsPage`, `SalesPage` и др.
- Вкладки **`page__tabs` / кастомные `*-tabs`**: `MyShiftPage`, `UsersPage`, `MaterialsPage`, `ChemistryPage`, `LinesPage`, `OTKPage`, `ShiftsReportPage`.
- Модалки: общая разметка `modal-overlay` + `modal` + `modal__head` / `modal__body` / `modal__actions` повторяется во многих фичах.

---

## 2. Страницы (по списку заказчика)

Для каждой страницы ниже: блоки, кнопки, таблицы, фильтры, модалки, формы, пустые состояния, тексты, данные для пользователя, затем обязательные подпункты аудита (формулировки привязаны к наблюдаемым фактам кода).

### 2.1. Моя смена

**Файл:** `src/features/shifts/components/MyShiftPage/MyShiftPage.jsx`.  
**API:** `src/features/shifts/api/shiftsApi.js` — `getMyShift`, `openShift`, `closeShift`, `addShiftNote`, `getMyShiftNotes`, `getMyShiftHistory`, `getShiftDetails`, `getMyActivity`, `getMyActivityDetail`, `getAllUsers`.

**Блоки:** заголовок-приветствие, дата, кнопка «Добавить жалобу», бейдж статуса смены; вкладки «Текущая смена» / «История смен» / «Жалобы»; карточка старта или активной смены; заметки; история с раскрытием; `ComplaintsInbox`; модалки.

**Кнопки (основные):** «Добавить жалобу» (в шапке и в активной смене), «Открыть смену», «Закрыть смену», «Добавить» (заметка), «Обновить» (история), «Действия за смену», вкладки.

**Таблицы:** нет классической `<table>`; списки в div-разметке.

**Фильтры:** нет полей фильтрации списков на странице.

**Модалки:** `ShiftActivityListModal`; `ComplaintModal` (имя компонента — жалоба, не закрытие смены); кастомное закрытие смены — `modal-overlay` / `modal my-shift__close-modal` с формой комментария.

**Формы:** добавление заметки (`input` max 500); форма закрытия смены (`textarea` комментарий необязательный).

**Пустые состояния:** «Заметок пока нет»; «История смен пуста»; загрузка со спиннером.

**Тексты сверху / в теле:** «Привет, {displayName}!», роль, дата словами; описательный текст в карточке «Начать рабочий день»; подсказки в истории.

**Данные, которые видит пользователь:** статус смены, таймер, время начала, число заметок, опционально строка линии `shiftLineLabel(shift)`; список заметок с полями `note|text|content` и временем; история с датой/длительностью/статусом/заметками из `getShiftDetails`; журнал активности через `fetchShiftActivityList`.

#### Что на странице выглядит перегруженно

- Три вкладки + большой блок приветствия + дублирование кнопки жалобы в шапке и в активной смене (факт наличия двух кнопок с одной подписью в разных зонах).

#### Что дублируется

- Подпись «Добавить жалоба» в двух местах при открытой смене; повторяющаяся тема «заметки» в текущей смене и в раскрытой истории.

#### Какие тексты лишние

- В карточке старта смены абзац пояснения про открытие смены (строки ~415–417) — отдельный от меню информационный блок.

#### Какие кнопки расположены плохо

- В коде только факт: primary-действия разнесены (жалоба рядом с бейджем, закрытие смены в другом краю карточки) — оценка «плохо» субъективна; **факт:** две кнопки «Добавить жалобу» на одном экране.

#### Какие поля лишние

- Отдельных «лишних» полей форм мало; комментарий при закрытии помечен как необязательный.

#### Есть ли двойные заголовки

- **Да:** `<h1>` в `MainLayout` («Моя смена» по `ACCESS_LABELS`) и **`<h1 class="my-shift__greeting">`** в теле.

#### Есть ли большие пустые зоны

- При отсутствии заметок показывается блок `my-shift__notes-empty` с иконкой и текстом.

#### Есть ли англоязычные слова / смешанные подписи / сырые данные

- В журнале активности возможен «сырой» контент с бэка через `ShiftActivityListModal` / `fetchShiftActivityList` (зависит от данных API). Статусы смены выводятся как есть (`s.status` → «Открыта»/«Закрыта» при известных значениях).

---

### 2.2. Сотрудники

**Файл:** `src/features/users/components/UsersPage/UsersPage.jsx`.  
**Список:** `useServerQuery('users/', queryState)`; роли: `useServerQuery('roles/', { page_size: 100 })`.  
**Доп. API:** `createUser`, `updateUser`, `deleteUser`, `updateUserAccess`, `getUser` из `usersApi`; роли из `rolesApi`; для отчёта — `getUserShifts`, `getUserActivity`, `getShiftDetails`, `getActivityDetail` из `shiftsApi`.

**Блоки:** вкладки «Список» / «Роли»; `ServerList` с фильтрами; таблица пользователей или ролей; дублирование кнопок «Добавить» / «Создать роль» в toolbar и `ds-sticky-mobile-actions`.

**Фильтры (`FilterBar`, `USERS_FILTERS_ALL`):** поиск, роль, статус активности, сортировка (ID, имя). Параметры уходят в query `users/` (см. `useServerQuery` — пустые строки отбрасываются в `cleanQuery` только для передачи в FilterBar; в `queryState` ключи могут быть пустыми строками).

**Модалки:** `UserFormModal`, `AccessModal`, `UserReportModal`, `RoleFormModal`, `ConfirmModal` на удаление.

**Поля форм (по коду):**  
- `UserFormModal`: имя* (`input`), пароль* при создании (`input type="password"`); при редактировании смена пароля в **`Collapse`** с полем без `required`; роль* (`Select` по списку `roles`). Submit: без роли не уходит; новый пользователь без пароля не уходит (`if (!user && !password) return`).  
- `RoleFormModal`: только название роли*.  
- `AccessModal`: чекбоксы доступов по группам `ACCESS_GROUPS` из `constants.js`, загрузка текущих ключей с `GET users/{id}/` (через `getUser` в эффекте компонента).  
- `UserReportModal`: выбор года/месяца/дня, список смен `getUserShifts`, раскрытие заметок `getShiftDetails`, журнал `ShiftActivityListModal` + `getUserActivity` / `getActivityDetail`.

**Пустые состояния:** через `ServerList` / пустой список (зависит от реализации `ServerList`).

#### Перегруженно

- На вкладке «Список» до 4 фильтров в одной строке (`FilterBar` variant row) + таблица с `ActionMenu` (3 пункта).

#### Дублируется

- Кнопки «Добавить» / «Создать роль» в двух местах (desktop toolbar + sticky mobile).

#### Лишние тексты

- Вкладки без отдельного описания страницы; явного лишнего абзаца нет.

#### Кнопки расположены плохо

- **Факт:** дублирование primary-кнопок по паттерну layout.

#### Поля лишние

- В коде модалок пользователя/ролей — стандартный набор; детали в секции 3 (при необходимости раскрыть вручную по файлу ниже по `UserFormModal` в том же jsx).

#### Двойные заголовки

- **Нет** `h1` в теле; только заголовок из `MainLayout` («Сотрудники»).

#### Пустые зоны

- Не выделены отдельной разметкой.

#### EN / смесь / сырое

- В ошибках доступа возможен вывод `JSON.stringify` деталей при сохранении роли (`handleRoleSubmit`). В `AccessModal` загрузка ключей доступа с API.

---

### 2.3. Линии и смены на линиях

**Файл:** `src/features/lines/components/LinesPage/LinesPage.jsx`.  
**API:** `src/features/lines/api/linesApi.js` (и связанные вызовы истории/смен — см. импорты в начале файла).

**Вкладки:** «Линия» | «Открытие» | «История».

**Таблицы:** div-таблицы `lines-table` с заголовками колонок капсом (`НАЗВАНИЕ`, `КОД`, …).

**Фильтры:** на вкладке «Линия» — поле поиска по названию; на «Истории» — фильтр по линии и др. (см. состояние в файле — `historyFilterLineId` и т.д.).

**Модалки:** `LineFormModal`, `ShiftParamsModal` (открытие/закрытие/параметры), `ShiftPauseModal`, `ShiftResumeModal`, `ProductionBatchModal` (создание партии с линии), `LineHistorySessionModal`, `ConfirmModal` удаления линии.

**Кнопки на «Открытие»:** до нескольких в строке (Остановить/Возобновить, Параметры, партия и т.д. — см. разметку ~897+).

#### Перегруженно

- Вкладка «Открытие»: много колонок и действий в одной строке таблицы.

#### Дублируется

- Поля `notes` и `comment` в submit линии оба отправляются (`LineFormModal` — в payload есть `notes` и дублирующий `comment` с тем же значением).

#### Лишние тексты

- В `ShiftParamsModal` при `type === 'open'` показывается длинный hint про рецепт и ProductionBatch (строки ~1604–1606).

#### Кнопки

- **Факт:** в строке «Открытие» несколько кнопок с классом `btn--sm` и переносом (`lines-table__actions--wrap`).

#### Поля лишние

- В форме линии: `Collapse` с комментарием — скрытый блок.

#### Двойные заголовки

- Только `h1` из layout + **`h2`** в карточке (`lines-card__title`); отдельного `page__title` нет.

#### Пустые зоны

- `EmptyState title="Нет данных"` при пустых списках.

#### EN / сырое

- Заголовки колонок **латиницей капсом** (`НАЗВАНИЕ`, `КОД`, …). В подсказке открытия смены англ. термин **«ProductionBatch»**.

---

### 2.4. Сырьё и остатки

**Файл:** `src/features/materials/components/MaterialsPage/MaterialsPage.jsx`.

**Заголовок в теле:** `<h1 className="page__title">Склад сырья</h1>` — **не совпадает** с подписью пункта меню «Сырьё и остатки» (`ACCESS_LABELS.materials` в `constants.js`).

**Вкладки:** Справочник | Остатки | Партии | История движения.

**Кнопки:** «Добавить сырьё», «Оформить приход»; в строках — действия редактирования/прихода/деактивации (см. разметку каталога и остатков).

**Фильтры:** на вкладке «Справочник» — `Select` (Все / Ниже минимума / Норма) + поиск по названию; фильтрация остатков частично на клиенте (`balancesFiltered`).

**API:** `materials/balances/`, `incoming/`, `materials/movements/`, `raw-materials` через `materialsApi` / `apiClient`.

**Модалки:** `AddCatalogMaterialModal`, `EditMaterialModal`, `ReplenishModal`, подтверждения удаления/деактивации.

#### Перегруженно

- Четыре вкладки + тулбар с фильтрами и двумя основными действиями на справочнике.

#### Дублируется

- Плашка «Ниже минимума: N» и фильтр «Ниже минимума».

#### Лишние тексты

- Плейсхолдеры «Опционально» в нескольких полях.

#### Кнопки

- Две крупные кнопки рядом в карточке («Добавить сырьё» / «Оформить приход»).

#### Поля лишние

- В приходе: необязательные поставщик, номер документа, комментарий — все помечены как опциональные в UI.

#### Двойные заголовки

- **Да:** `MainLayout` («Сырьё и остатки») + **`h1` «Склад сырья»** (разный текст).

#### Пустые зоны

- Зависит от вкладки; `EmptyState` при отсутствии данных.

#### EN / сырое

- Единицы в коде канонически `kg`/`g` с подписью «кг»/«г». В ошибке состава химии на другой странице встречается `quantity_per_meter` — на материалах в основном RU.

---

### 2.5. Химия

**Файл:** `src/features/chemistry/components/ChemistryPage/ChemistryPage.jsx`.  
**Заголовок:** `<h1 className="page__title">Химия</h1>` (в меню `ACCESS_LABELS.chemistry` = «Химия» — совпадение частичное с полным названием группы в `PAGE_LABELS` «Химия (полуфабрикат)» в `pages.js`, в меню из `ACCESS_LABELS` — короче).

**Вкладки:** Справочник | Остатки | Партии (`tab` в URL через `?tab=stock|batches`).

**Модалки:** `AddChemistryModal`, `EditChemistryModal`, `CompositionModal`, `ProduceChemistryModal`, `ConfirmModal`.

**Таблицы:** div-таблицы `chemistry-table`.

**API:** `chemistry/elements/`, `getChemistryBalances`, `chemistry/batches/`, `produceChemistry`, CRUD через `chemistryApi`, плюс `raw-materials/` для состава.

#### Перегруженно

- Вкладка «Партии»: много числовых колонок (произведено, осталось, себестоимость за кг, общая, комментарий).

#### Дублируется

- Кнопка «Выпуск» в шапке карточки справочника и в каждой строке.

#### Лишние тексты

- Подсказки «Опционально» в формах.

#### Кнопки

- «Выпуск» продублирована горизонтально в строке с `ActionMenu`.

#### Поля

- Состав: placeholder `0` у `DecimalInput` для расхода сырья на 1 кг химии.

#### Двойные заголовки

- Layout «Химия» + `h1` «Химия» — **одинаковый текст**, два уровня (внешний `h1` layout и внутренний `h1` страницы).

#### EN

- В `RecipeCompositionModal` (рецепты) ошибка с текстом `quantity_per_meter` — на странице химии сообщения вроде «кг сырья на 1 кг химии» на RU. В `formatReleaseCell` отфильтрованы служебные подписи единиц типа `'amount'`, `'ед.'`.

---

### 2.6. Профили

**Файл:** `src/features/recipes/components/PlasticProfilesPage/PlasticProfilesPage.jsx`.  
**Маршрут:** `/profiles`.  
**Заголовок:** `<h1>Профили</h1>`; в меню пункт подписан «Профили» (`navigation.js`).

**Таблица:** `plastic-profiles-table` с подстрокой рецептов под блоком профиля при `recs.length > 0`.

**Модалка:** `ProfileMetaModal` (в том же файле).

**API:** `plastic-profiles/`, `recipes/` через `useServerQuery`; сохранение через `productionApi` (`createPlasticProfile` / `updatePlasticProfile` / `deletePlasticProfile`).

#### Перегруженно

- Строка действий: кнопка «Создать рецепт» + `ActionMenu` (ещё «Рецепты», редактирование, …).

#### Дублируется

- Навигация «Создать рецепт» и пункт меню «Рецепты» с фильтром по профилю.

#### Двойные заголовки

- Layout (например «Рецептуры» не отображается — пункт «Профили») + внутренний `h1` «Профили» — **два заголовка** если считать layout; текст может совпасть с пунктом меню.

---

### 2.7. Рецепты

**Файл:** `src/features/recipes/components/RecipesPage/RecipesPage.jsx`.

**Заголовок:** `<h1>Рецепты</h1>`; меню: «Рецептуры» (`PAGE_LABELS`) / «Рецептуры» в `ACCESS_LABELS` как `recipes: 'Рецептуры'`.

**Блоки:** баннер при отсутствии профилей (ссылка на `/profiles`); баннер фильтра по профилю из query `filter_profile_id`; карточка с поиском и таблицей.

**Модалки:** `RecipeMetaModal`, `RecipeCompositionModal`, `RecipeDetailModal`, `AvailabilityModal`, `ConfirmModal` ×2.

**Таблица:** div `recipes-table` с кликом по строке для просмотра.

**API:** `recipes/`, `recipes/{id}/`, `recipes/{id}/availability/`, `plastic-profiles/`, `raw-materials/`, `chemistry/elements/`.

#### Перегруженно

- В строке: кнопка «Редактировать» + `ActionMenu` (Состав, Проверка остатков, …).

#### Дублируется

- Действия «Состав» / «Проверить доступность» доступны и из карточки просмотра (`RecipeDetailModal`), и из меню строки.

#### Лишние тексты

- В мета-форме рецепта дублирование смысла: поля `recipe` и `product` в API оба ставятся из одного названия (`body.recipe` и `body.product` из одного `name`).

#### Двойные заголовки

- Layout «Рецептуры» + `h1` «Рецепты» — **разные слова**.

#### Сырое

- **`AvailabilityModal`:** тело ответа `getRecipeAvailability` выводится как **`<pre>`** через `JSON.stringify(payload, null, 2)` если не строка — сырой JSON для пользователя.

---

### 2.8. Производство

**Файл:** `src/features/production/components/ProductionPage/ProductionPage.jsx`.  
**Модалки:** `ProductionBatchModal` (`src/features/lines/components/ProductionBatchModal.jsx`), `ProductionBatchDetailModal`, `ConfirmModal` для ОТК.

**Таблица:** `production-table` — колонки: Создано, Профиль, Рецепт, Линия, Шт, Длина м, Метры, Сом/м, Сом/шт, Статус, Действия.

**Фильтр:** локальный поиск `input` (не query API).

**API:** `useServerQuery('batches/', …)`, `submitProductionBatchForOtk` → `POST batches/{id}/submit-for-otk/`.

#### EN / сырое

- Заголовок модалки деталей: **`ProductionBatch #{batchId}`** (`ProductionBatchDetailModal.jsx`).

#### Двойные заголовки

- Только заголовок layout «Производство»; в теле нет `h1`.

#### Перегруженно

- Широкая таблица с множеством числовых колонок.

---

### 2.9. ОТК

**Файл:** `src/features/otk/components/OTKPage/OTKPage.jsx`.

**Вкладки:** «Ожидают проверки» / история (реализация через `activeTab`).

**Фильтры:** `FilterBar` с разными наборами для очереди и истории; пагинация кастомная `Pagination` в файле.

**Модалки:** форма приёмки (заголовок «Проверка партии»), `HistoryDetailModal`.

**API:** `getBatchesAwaitingOtk` (с fallback на `batches/` при 404/405), `getOtkHistory`, `acceptBatch` → `POST batches/{id}/otk_accept/`.

#### Сырое

- В подписях ошибок возможна склейка полей `details` / `missing` с бэка (`errorToMessage`).

#### Перегруженно

- Таблица очереди с множеством колонок (см. разметку после ~250 строки файла — профиль, линия, размеры смены, метры, заказ, …).

---

### 2.10. Склад готовой продукции

**Файл:** `src/features/warehouse/components/WarehousePage/WarehousePage.jsx`.

**Фильтры в toolbar:** поиск, статус, форма (`inventory_form`), качество (часть качества фильтруется **на клиенте** после загрузки: `rows` с `queryState.quality`).

**Модалки:** `WarehouseBatchDetailModal` (локальный компонент в файле), `PackFromOtkModal`, резервирование (см. ниже по файлу — `reserveTarget`).

**Таблица:** `<table className="data-table …">`.

**API:** `warehouse/batches/`, `POST warehouse/batches/reserve/`, упаковка через `warehouseApi.packFromOtk`.

#### Дублируется

- Кнопка «Упаковать» в toolbar и в `ds-sticky-mobile-actions`.

#### Поля

- В резерве (если открыто) — см. продолжение файла после строки 200: `DecimalInput` для количества.

---

### 2.11. Клиенты

**Файл:** `src/features/clients/components/ClientsPage/ClientsPage.jsx`.

**Шапка:** `ds-page-top` с **`<p className="ds-page-top__desc">`** — текст про справочник покупателей.

**Таблица:** клиент, телефон, контакт, число продаж, сумма, статус, меню (История, Удалить).

**Модалки:** `ClientModal`, `HistoryModal`, `ConfirmModal`.

**API:** `clients/`, `PATCH/POST`, `clients/{id}/history/` с fallback на `sales/?client_id=`.

#### Двойные заголовки

- Layout «Клиенты» + **нет `h1`**; есть только абзац-описание под заголовком layout (визуально второй текстовый блок под title bar).

---

### 2.12. Продажи

**Файл:** `src/features/sales/components/SalesPage/SalesPage.jsx`.

**Таблица:** дата, клиент, профиль/партия, количество, выручка, себестоимость, прибыль, меню.

**Модалка:** `SaleModal` — многошаговая логика (`phase` success), поля клиент, партия склада, единицы продажи, количество, цена, комментарий, дата, override штук в упаковке.

**API:** `sales/`, `clients/`, `warehouse/batches/?status=available`, `downloadSaleWaybill`.

#### Перегруженно

- Внутри `SaleModal` блоки баннера склада, подсказок упаковки, предупреждений по остатку, дополнительных полей — см. JSX после ~670 строки.

#### Сырое

- Отображение в таблице и модалке зависит от вложенности `warehouse_batch` и множества fallback-полей (`product_name`, `stock_form`, …).

---

### 2.13. Аналитика

**Файл:** `src/features/analytics/components/AnalyticsPage/AnalyticsPage.jsx`.

**Фильтры:** год (`input type="number"`), месяц, день; кнопка «Сброс»; **вторая полоса** с полями: Линия **(id)**, Клиент **(id)**, Профиль **(id)**, Рецепт **(id)**, Партия **(id)**, статус, даты от/до — подписи явно «(id)».

**API:** `GET analytics/summary/` с параметрами из состояния; доп. запросы в модалках детализации через `getRevenueDetails`, `getExpenseDetails`, `getWriteoffDetails` из `analytics/api`.

**Графики:** recharts (Bar, Pie, Area и т.д.).

#### Сырое / не клиентское

- Пользователь вводит **числовые id** вручную в текстовые поля (подписи «Линия (id)» и т.д.).

#### Двойные заголовки

- Нет `h1` в теле; только layout «Отчёты и аналитика».

---

## 3. Формы и модалки (сводка по ключевым сценариям)

Ниже — **имена компонентов/файлов** и поля по коду. «Обязательные» — где HTML/логика явно требует значение (`required`, или `return` при пустом).

| Сценарий | Где в коде | Открытие | Поля и проверки |
|----------|------------|----------|-------------------|
| Открытие смены линии | `ShiftParamsModal` в `LinesPage.jsx` | Кнопки открытия/параметров на вкладке «Открытие» | Высота/ширина/градус `DecimalInput` required; комментарий; для открытия — `session_title` необязательно; hint текстом. Submit через `handleShiftModalSubmit`. |
| Создание сырья | `AddCatalogMaterialModal` | «Добавить сырьё» | Название*; единица*; мин. остаток `DecimalInput`; комментарий; статус*. |
| Приход | `ReplenishModal` | «Оформить приход» / из строки | Режим выбора сырья: `Select` список; количество* `DecimalInput`; цена* `DecimalInput`; дата-время* `datetime-local`; поставщик, документ, комментарий; сумма показывается как `qty*price`. Отправка `createIncoming` (`materialsApi`). |
| Состав химии | `CompositionModal` | Меню «Состав» | Строки: сырьё `Select` + `DecimalInput` кг/кг химии; минимум одна валидная строка; дубликаты сырья запрещены. PATCH `updateChemicalElement` с `recipe_lines`. |
| Выпуск химии | `ProduceChemistryModal` | «Выпуск» | Химия* `Select`; количество* `DecimalInput`; комментарий. `produceChemistry` с `quantity`. |
| Профиль | `ProfileMetaModal` | «Добавить профиль» / редактирование | Имя*; код*; комментарий; статус*. `canSave` требует имя и код непустые. |
| Рецепт мета | `RecipeMetaModal` | «Добавить рецепт» / редактирование | Профиль* `Select` (или locked); название*; комментарий; статус*; при создании `components: []` в теле. |
| Состав рецепта | `RecipeCompositionModal` | Меню «Состав» | Объединённый `Select` сырьё/химия; количество кг/м `DecimalInput`; таблица строк с `DecimalInput`; сохранение `updateRecipe` с `components`. Ошибка валидации с текстом про `quantity_per_meter` (EN). |
| Production batch | `ProductionBatchModal.jsx` | «Производство» и линии | Профиль*, рецепт*, линия* (если не передан `lineId`), штуки* (`DecimalInput` но в submit **`Math.floor(Number(parseLocaleNumber(pieces)))`**), длина* `DecimalInput`, комментарий. POST `batches/`. |
| ОТК | форма в `OTKPage.jsx` | Кнопка в строке очереди | Принято/брак `DecimalInput` (далее в API уходят строки и числа — см. `acceptBatch` в `otkApi.js`); дата проверки; инспектор; причина; комментарий. |
| Упаковка | `PackFromOtkModal.jsx` | «Упаковать» на складе | Выбор партии (`warehouse/batches` unpacked); штук в упаковке — **целое `Math.floor`**; число упаковок — целое; комментарий. |
| Продажа | `SaleModal` | «Создать» / клик по строке | Клиент; партия склада; единица (шт/упак.); количество; цена `DecimalInput`; дата; override штук в упаковке; вычисление `sold_pieces` через **`Math.floor`** для штук и упаковок; много полей в payload (`warehouse_batch`, `piece_pick`, `stock_form`, …). |

### 3.1. Read-only и «не для клиента»

- **Read-only:** в приходе сырья поле единицы — `input readOnly`. В `RecipeDetailModal` просмотр состава без редактирования. В `ProductionBatchDetailModal` блок read-only до нажатия «Редактировать».
- **Сырой JSON / внутренние имена:** заголовок **`ProductionBatch #{id}`**; модалка **доступности рецепта** — JSON в `<pre>`.

### 3.2. Decimal / пустые значения (поведение по коду)

- Компонент **`DecimalInput`**: `src/shared/ui/DecimalInput/DecimalInput.jsx` + `formatNumberForInput` / `parseLocaleNumber` в `src/shared/lib/numbers.js`.
- При **blur** пустое или нечисловое → `onChange('')`; clamp по `min`/`max`.
- **`formatNumberForInput`:** числа, отличающиеся от целого менее чем на 1e-12, показываются как **целое** (`0.80` может стать **`0`** если в float оно «почти целое» — зависит от представления; для 0.8 обычно остаётся дробным). Нули: **`n === 0` → строка `'0'`**.
- **Фокус:** если значение число, вызывается `onChange(formatNumberForInput(n))` — перезапись строки в поле.

---

## 4. Таблицы (перечень по страницам)

| Страница | Колонки / тип | Действия в строке | Примечание |
|-----------|----------------|-------------------|------------|
| Моя смена | списки div | нет табличных row actions | — |
| Сотрудники | Имя, Роль, Статус | клик по строке → модалка; меню: Доступы, Отчёт, Удалить | — |
| Линии | см. `lines-table__th` | Редактировать/Удалить; на открытии — много кнопок | Заголовки колонок CAPS |
| Материалы | каталог/остатки/партии/движения — разные наборы | кнопки в строках каталога | Часть фильтров клиентская |
| Химия | см. `chemistry-table__th` | Выпуск + меню | Партии без row actions |
| Профили | Название, Код, Есть рецепт, Статус | Создать рецепт + меню | Подстрочный список рецептов |
| Рецепты | Название, Профиль, Компонентов, Статус | Редактировать + меню | Строка кликабельна |
| Производство | см. production-table | В ОТК + меню «Детали» | Много числовых колонок |
| ОТК | см. JSX таблиц | Открыть проверку / история | — |
| Склад ГП | Статус, Качество, Продукт, Количество, Партия | клик, резерв, меню | `getWarehouseQuantityPresentation` |
| Клиенты | стандартные колонки | клик → модалка; меню История/Удалить | — |
| Продажи | финансовые колонки | клик → модалка | — |
| Аналитика | списки/графики | — | Срезы по id в фильтрах |

---

## 5. Фильтры и поиск

- **`FilterBar`** (`src/shared/ui/FilterBar/FilterBar.jsx`): только видимые поля, **без сворачивания** внутри компонента.
- **`Collapse`:** используется, например, в форме линии для комментария (`LinesPage.jsx`).
- **Скрытые фильтры:** отдельного паттерна «фильтры в drawer» в коде страниц **не найдено**; на аналитике вторая группа фильтров вынесена в `analytics-filters--extra` (визуально отдельный блок, не скрытый по умолчанию).
- **Клиентская фильтрация:** поиск на `ProductionPage`, `PlasticProfilesPage`, `RecipesPage` (search в state), фильтр качества на `WarehousePage` после запроса.
- **Query в API:** `useServerQuery` сериализует непустые поля объекта в query-string (`buildQueryString` в `useServerQuery.js`).

---

## 6. User flow (по коду — шаги и API)

### 6.1. Открытие смены (линия)

1. Пользователь на `/lines`, вкладка «Открытие», нажимает действие открытия (код кнопки в таблице открытых линий).  
2. Открывается `ShiftParamsModal` с `type='open'`.  
3. Ввод высоты/ширины/градуса (DecimalInput), опционально название сессии, комментарий.  
4. Submit вызывает обработчик в `LinesPage` → API смены линии (см. `linesApi` / `handleShiftModalSubmit` в файле).  
5. **Запутанность:** длинный текст hint с упоминанием рецепта и англ. `ProductionBatch`; отдельно существует личная смена в «Моя смена» без этих параметров.

### 6.2. Создание сырья

1. `/materials` → вкладка «Справочник» → «Добавить сырьё».  
2. Модалка → `POST` через `createRawMaterial`.  
3. Опционально оформить приход отдельной кнопкой.

### 6.3. Выпуск химии

1. `/chemistry` → «Выпуск» → `ProduceChemistryModal` → `produceChemistry` API.

### 6.4. Профиль

1. `/profiles` → «Добавить профиль» → `ProfileMetaModal` → `createPlasticProfile`.

### 6.5. Рецепт

1. `/recipes` → «Добавить рецепт» или редактирование.  
2. Состав через `RecipeCompositionModal`.  
3. «Проверка остатков» / «Проверить доступность» → `GET recipes/{id}/availability/` → вывод **как текст/JSON в pre**.

### 6.6. Производство

1. `/production` → «Новая партия» → `ProductionBatchModal` (без lineId — выбор линии внутри).  
2. Список партий; «В ОТК» → подтверждение → `submitProductionBatchForOtk`.

### 6.7. ОТК

1. `/otk` → очередь → форма проверки → `acceptBatch`.

### 6.8. Склад

1. `/warehouse` → фильтры → клик по строке → детали; «Упаковать» → `PackFromOtkModal` → `packFromOtk`.

### 6.9. Упаковка

- Только через модалку на странице склада (отдельного маршрута «Упаковка» **нет**).

### 6.10. Продажа

1. `/sales` → «Создать» → `SaleModal` → сложный payload (см. формирование объекта в submit).  
2. После успеха — фаза «Продажа создана» с кнопкой накладной.

---

## 7. Проблемные экраны (фиксация по коду)

### 7.1. Рецепт → «Проверка остатков» / доступность

- Пункт меню: **«Проверка остатков»** (`RecipesPage.jsx`).  
- В карточке просмотра кнопка: **«Проверить доступность»** — тот же `AvailabilityModal`.  
- **Что видит пользователь:** заголовок «Доступность: {название}» и содержимое `<pre class="recipe-availability__pre">` — строка, `detail` или **форматированный JSON**.  
- **Неудобство / не клиентский вид:** отсутствие табличной/структурированной разметки под обычного пользователя; зависимость от формата ответа бэка.

### 7.2. Упаковка

- Только модалка `PackFromOtkModal.jsx`; список партий с `inventory_form: unpacked`, `status: available`.  
- Сообщения об ошибках из `data.error` / `data.message`.

### 7.3. Продажа

- `SaleModal`: баннер склада, качество брака, пересчёт штук, блокировка submit при `catalogProductMissing`, предупреждение при превышении остатка.

### 7.4. Аналитика

- Две сетки фильтров; поля id; графики Recharts; при ошибке `ErrorState` с объектом ответа.

### 7.5. ОТК

- Fallback списка очереди на общий список `batches/` если `otk/pending/` недоступен — пользователь может видеть **не ту** выборку относительно ожидаемой «очереди ОТК», в зависимости от бэка.

### 7.6. Страницы с большим объёмом текста

- `ShiftParamsModal` hint при открытии смены.  
- `LineHistorySessionModal` пояснение про «данные с текущей страницы ленты».  
- `MyShiftPage` описательные абзацы на старте смены.

### 7.7. Двойные заголовки (сводка фактов)

- **MyShiftPage:** layout + `h1` приветствия.  
- **MaterialsPage:** layout «Сырьё и остатки» + `h1` «Склад сырья».  
- **RecipesPage:** layout «Рецептуры» + `h1` «Рецепты».  
- **ChemistryPage:** layout + `h1` с тем же словом «Химия».

---

## 8. Числа / ввод / decimal

### 8.1. Где используется `DecimalInput`

Файлы (grep по проекту):  
`RecipesPage.jsx`, `WarehousePage.jsx`, `LinesPage.jsx` (смена), `OTKPage.jsx`, `ChemistryPage.jsx`, `ProductionBatchModal.jsx`, `PackFromOtkModal.jsx`, `ProductionBatchDetailModal.jsx`, `MaterialsPage.jsx`, `SalesPage.jsx`.

### 8.2. Где дробь обрезается до целого

- **`ProductionBatchModal`:** `pieces` → `Math.floor(Number(parseLocaleNumber(pieces)))` перед API — **дробное количество штук невозможно отправить**, даже если ввести в `DecimalInput`.  
- **`ProductionBatchDetailModal`:** то же для сохранения.  
- **`PackFromOtkModal`:** `itemsPerPackage` и `packagesCount` через `Math.floor`.  
- **`SalesPage` `computePiecesForApi`:** для `piece` и `package` используется **`Math.floor`**.  
- **`OTK` `acceptBatch`:** `Math.trunc` для принято/брак.

### 8.3. Где `length_per_piece` / метры остаются дробными

- `ProductionBatchModal` / `ProductionBatchDetailModal`: длина через `parseLocaleNumber` **без** `Math.floor` (но проверка `> 0`).

### 8.4. Обычные `input type="number"` / `datetime-local"`

- **Аналитика:** год — `input type="number"`.  
- **Приход сырья:** `datetime-local`.  
- Прочие числа часто в `type="text"` с `DecimalInput` или без.

### 8.5. Округление отображения

- **`formatQuantityDisplay`:** `Math.round(value * 1e9) / 1e9` для number.  
- **`formatNumberForInput`:** отбрасывание хвостовых нулей и научная нотация для малых/больших — см. реализацию.

### 8.6. Конфликт placeholder / 0

- В формах смены линии placeholder **`"0"`** при обязательных полях — ввод нуля визуально совпадает с «пустым» подсказочным состоянием до ввода (факт из разметки).

### 8.7. Где ввод дроби важен и не обрезается на submit

- **Приход сырья** (`ReplenishModal`): количество и цена — `parseLocaleNumber`, без floor.  
- **Состав химии / рецепта:** строки с `DecimalInput` и проверки `> 0` / `>= 0`.

---

## 9. API глазами фронта (кратко по страницам)

| Страница | Основные endpoints (относительно `API_BASE`) | Нормализация / fallback |
|----------|---------------------------------------------|-------------------------|
| Моя смена | `shifts/my/`, `shifts/open/`, `shifts/close/`, `shifts/notes/`, `shifts/history/`, `shifts/{id}/`, `activity/my/`, `users/` | Ответы с `shift` или прямой объект; заметки `data` массив или `items` |
| Сотрудники | `users/`, `roles/`, `PATCH users`, `shifts/` для отчёта | `parseApiListResponse` |
| Линии | `lines/` и эндпоинты смен/истории из `linesApi` | Много маппинга снапшотов смены в компоненте |
| Материалы | `materials/balances/`, `incoming/`, `materials/movements/`, сырьё | `items` или `[]`; движения 404 → пустой список в fetcher |
| Химия | `chemistry/elements/`, балансы, `chemistry/batches/`, produce | Балансы: `items` или массив |
| Профили | `plastic-profiles/`, `recipes/` | — |
| Рецепты | `recipes/`, `recipes/{id}/`, `availability/`, справочники | Имена полей рецепта множественные (`recipe`/`name`/…) |
| Производство | `batches/`, `batches/{id}/`, submit-for-otk | Лейблы из `batchMeta.js` |
| ОТК | `otk/pending/` **или** `batches/` | Явный fallback в `otkApi.js` |
| Склад | `warehouse/batches/`, reserve, pack | `resolveInventoryForm`, множество ключей упаковки |
| Клиенты | `clients/`, history, fallback `sales/` | Поля имени/телефона с альтернативными ключами |
| Продажи | `sales/`, `warehouse/batches/`, waybill | Сложный маппинг партии и качества |
| Аналитика | `analytics/summary/` | Две загрузки для трендов; объект ошибки в `ErrorState` |

---

## 10. Итоговые выводы (только зафиксированные паттерны кода)

### Что в UI выглядит согласованным / цельным

- Повторяющаяся система модалок (`modal__*`), toast-уведомлений (`useToast`), подтверждений (`ConfirmModal`).  
- Навигация и права завязаны на одном списке доступов и `ProtectedRoute`.

### Что в UI выглядит перегруженным

- Таблицы с большим числом колонок: производство, ОТК, партии химии, строка «Открытие» на линиях.  
- Модалка продажи: много условных блоков и вычисляемых полей в одной форме.

### Что в UI дублируется

- Заголовки уровня layout и страницы (см. разд. 7.7).  
- Кнопки primary в desktop и mobile sticky.  
- Кнопки «Добавить жалобу» на «Моя смена».  
- Отправка `notes` и `comment` одним значением в форме линии.

### Что в UI отличается по названиям от навигации

- «Сырьё и остатки» в меню vs **«Склад сырья»** на странице.  
- «Рецептуры» в меню vs **«Рецепты»** на странице.

### Какие экраны самые проблемные с точки зрения «сырого» или технического представления данных

- **`AvailabilityModal`** — вывод JSON в `<pre>`.  
- **`ProductionBatchDetailModal`** — заголовок с **`ProductionBatch`** и id.  
- **Аналитика** — фильтры по сырым **id** без подбора имён из справочников на фронте.

### Какие формы самые проблемные для дробных и «граничных» чисел

- Любые формы с **`Math.floor` / `Math.trunc`** по количеству штук или упаковок: партия производства, упаковка, продажа, ОТК.  
- Поля с placeholder **`"0"`** при обязательности (смена линии).

### Какие ответы API ломают или усложняют клиентский UX (по коду обработки)

- Ответ **`recipes/{id}/availability/`** без единого контракта — фронт показывает как есть.  
- Очередь ОТК при отсутствии `otk/pending/` — **подмена** списком `batches/`.  
- Ошибки с полем `details` / `missing` — разбор вручную в строку (`OTKPage`, `SalesPage`).  
- Списки без `items` — везде опора на **`parseApiListResponse`**.

---

*Конец документа. Файлы вне `src/` (например корневой README) в аудит не включались.*
