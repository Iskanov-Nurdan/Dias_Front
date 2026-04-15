# FRONTEND_BUSINESS_AND_UI_DOC

Документ описывает только то, что присутствует в репозитории `Dias_Front` на момент составления: файлы, маршруты, компоненты, вызовы HTTP API и явная клиентская логика.

Базовый URL API: `src/shared/config/api.js` — `API_BASE = (process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000/api').replace(/\/?$/, '/')`. Все пути ниже — относительно этого префикса (axios `baseURL` в `src/shared/api/client.js`).

---

# Общая карта фронтенда

## Маршруты (React Router)

Файл: `src/app/routes/AppRoutes.jsx`.

| Путь | Доступ (`requiredAccess`) | Компонент страницы |
|------|---------------------------|-------------------|
| `/login` | нет | `LoginPage` (`src/features/auth/components/LoginPage/LoginPage.jsx`) |
| `/` (index) | авторизация | редирект: `getDefaultHomePath(user.accesses)` → `src/shared/config/navigation.js` |
| `/users` | `users` | `UsersPage` |
| `/lines` | `lines` | `LinesPage` |
| `/production` | `production` | `ProductionPage` |
| `/materials` | `materials` | `MaterialsPage` |
| `/chemistry` | `chemistry` | `ChemistryPage` |
| `/recipes` | `recipes` | `RecipesPage` |
| `/profiles` | `recipes` (тот же ключ, что и рецепты) | `PlasticProfilesPage` |
| `/otk` | `otk` | `OTKPage` |
| `/warehouse` | `warehouse` | `WarehousePage` |
| `/analytics` | `analytics` | `AnalyticsPage` |
| `/my-shift` | `my_shift` | `MyShiftPage` |
| `/shifts` | `shifts` | `ShiftsReportPage` |
| `/clients` | `clients` | `ClientsPage` — **рендерится только если** `STAGE2_TABS_ENABLED` (`src/shared/config/constants.js`) истинно |
| `/sales` | `sales` | `SalesPage` — условие то же |
| `/forbidden` | — | заглушка «Нет доступа» |
| `*` | — | `Navigate` на `/` |

Обёртка: `MainLayout` + `ProtectedRoute` без `requiredAccess` для вложенных маршрутов (кроме явных `requiredAccess` на дочерних `Route`).

## Боковое меню и «вкладки»

Файл: `src/app/components/MainLayout/MainLayout.jsx` + `src/shared/config/navigation.js` (`getNavSections()`).

Секции меню (подписи в UI):

1. **Смена** — `/my-shift` (`my_shift`)
2. **Подготовка** — `/materials`, `/chemistry`, `/profiles` (лейбл «Профили»), `/recipes` (лейбл «Рецепты») — все под доступом `materials` / `chemistry` / `recipes` по отдельности
3. **Производство** — `/lines`, `/production`, `/otk`
4. **Склад** — `/warehouse`
5. **Сбыт** — `/clients`, `/sales` — **только если** `STAGE2_TABS_ENABLED === true` (сейчас в коде `true` в `constants.js`)
6. **Отчёты** — `/analytics`, `/shifts`
7. **Администрирование** — `/users`

Пункты фильтруются по массиву `user.accesses` из `useAuth()`.

## Связи между разделами (по коду навигации и URL)

- **Профили → Рецепты**: `PlasticProfilesPage` вызывает `navigate('/recipes?profile_id=…&open=recipe')` и `navigate('/recipes?filter_profile_id=…')` (`src/features/recipes/components/PlasticProfilesPage/PlasticProfilesPage.jsx`).
- **Рецепты**: читает query `filter_profile_id`, `open=recipe`, `profile_id` в `RecipesPage.jsx` для фильтра списка и автo-открытия модалки создания с зафиксированным профилем.
- **Производство ↔ Линии**: создание партии — компонент `ProductionBatchModal` (`src/features/lines/components/ProductionBatchModal.jsx`) используется и на `/production`, и на `/lines` (с предзаполненной линией).
- **Склад ГП ↔ Продажи**: `SalesPage` подгружает `GET warehouse/batches/?status=available` для выбора партии; резерв на складе опционально принимает `sale_id` (`WarehousePage.jsx`).
- **Аналитика**: опциональные query-параметры к `GET analytics/summary/` (см. модуль Аналитика).

## Заголовки HTTP аудита смены

`src/shared/api/client.js`: при ненулевом `getAuditShiftId()` добавляются заголовки `X-Audit-Shift-Id` и `X-Shift-Id`.

`setAuditShiftId` вызывается в `MyShiftPage` (`src/features/shifts/components/MyShiftPage/MyShiftPage.jsx`) при открытой личной смене. Иных мест установки в коде не найдено.

## Прочие модули в коде, не входящие в список заказчика

В репозитории есть страницы **Пользователи**, **Линии**, **Моя смена**, **Журнал смен** — они не перечислены в ТЗ как отдельные разделы документа, но **Линии** жёстко связаны с производством (смена на линии, `ProductionBatchModal`). Кратко: `LinesPage` — `src/features/lines/components/LinesPage/LinesPage.jsx`, API — `src/features/lines/api/linesApi.js`.

---

# Модуль: Склад сырья

Маршрут: `/materials`. Страница: `MaterialsPage` — `src/features/materials/components/MaterialsPage/MaterialsPage.jsx`. API-обёртки: `src/features/materials/api/materialsApi.js`.

## A. Страницы и компоненты

- **Одна страница** с четырьмя горизонтальными вкладками (`MAIN_TAB`): «Справочник», «Остатки», «Партии», «История движения».
- **Таблицы**: CSS-grid таблицы в карточке `materials-card` (разная разметка по вкладкам).
- **Модалки**: `AddCatalogMaterialModal`, `EditMaterialModal`, `ReplenishModal`; подтверждения `ConfirmModal` (удаление, деактивация).

## B. Действия пользователя

- Создать позицию справочника сырья; оформить приход; редактировать карточку; деактивировать; удалить (если бэкенд отдал `deletable: true`).
- Фильтры на вкладке «Справочник»: select «Все / Ниже минимума / Норма», поиск по названию.
- Просмотр партий (`incoming/`) и движений (`materials/movements/`).

## C. Поля форм

**Добавить сырьё** (`AddCatalogMaterialModal`, заголовок h3 «Добавить сырьё»)

| Поле | Обязательное | Тип UI | Примечание |
|------|----------------|--------|------------|
| Название | да (`required`) | text | |
| Единица измерения | да | `Select` UNITS `kg`/`g` | |
| Минимальный остаток | нет | `DecimalInput` | опционально в POST |
| Комментарий | нет | text | |
| Статус | да | `Select` активен/неактивен → `is_active` | |

**Редактировать сырьё** (`EditMaterialModal`, «Редактировать сырьё»)

| Поле | Обязательное | Тип | disabled |
|------|----------------|-----|----------|
| Название | да | text | |
| Единица | да | `Select` | если `unitLocked` (см. `isUnitLocked` в файле) |
| Статус | да | `Select` | |
| Минимальный остаток | нет | `DecimalInput` | |
| Комментарий | нет | text | |

**Приход сырья** (`ReplenishModal`, «Приход сырья»)

- Режим выбора сырья: `pickMaterial: true` — `Select` по списку из `GET raw-materials/?page_size=500`; иначе сырьё фиксировано текстом.
- Количество * — `DecimalInput`; единица — **readOnly** input из карточки.
- Цена за единицу (сом) * — `DecimalInput`; сумма партии показывается как `qty * price` на клиенте.
- Дата прихода * — `datetime-local` → в POST `received_at` ISO.
- Поставщик, номер документа, комментарий — опционально.

## D. UI-логика

- Остатки и справочник объединены: данные остатков `GET materials/balances/`; в справочнике поля `material_id` / `id` / `raw_material_id` нормализуются через `getMaterialId`.
- `isUnitLocked`: блокировка смены единицы по флагам бэка или признакам движений/приходов.
- `canDeleteMaterial`: удаление только при `deletable === true`.
- Realtime: `useOperationalRefetch` с типами `raw_material`, `incoming`, `material_balance`, `material_writeoff`, `material_movement`.
- Вкладка «История»: при 404 от `materials/movements/` возвращается пустой список без падения; в `EmptyState` текст про подключение эндпоинта на бэкенде.

## E. API

| Метод | Endpoint | Где вызывается | Тело / query | Ответ (использование) |
|-------|----------|----------------|--------------|------------------------|
| GET | `materials/balances/` | прямой `apiClient` в `refetchBalances` | — | `res.data.items` → строки таблиц |
| GET | `incoming/` | `useServerQuery` | `page`, `page_size`, `ordering` | `items` — партии |
| GET | `materials/movements/` | `useServerQuery` + кастомный fetcher | пагинация + `ordering` | `items` или 404 → `[]` |
| GET | `raw-materials/` | `ReplenishModal` pick mode | `page_size: 500` | `items` для select |
| POST | `raw-materials/` | `createRawMaterial` | `{ name, unit, is_active, min_balance?, comment? }` | успех → refetch |
| PATCH | `raw-materials/{id}/` | `updateRawMaterial` | правки / `{ is_active: false }` | |
| DELETE | `raw-materials/{id}/` | `deleteRawMaterial` | — | |
| POST | `incoming/` | `createIncoming` | `{ material_id, quantity, unit_price, received_at, supplier_name?, document_number?, comment? }` | |

Поля ответа балансов обрабатываются с fallback: `material_name`/`name`, `min_balance`/`min_stock`, `comment`/`note`/`notes`, и т.д. (см. хелперы в начале файла).

## F. Бизнес-правила на фронте

- Списание сырья в UI не вводится вручную: текст на вкладке «История движения» про FIFO и системные списания.
- Удаление и деактивация разделены; удаление зависит от флага `deletable` с бэка.

## G. Проблемные места

- Дублирование загрузки балансов: и `materialsApi.getBalances`, и прямой `apiClient.get('materials/balances/')` в компоненте (функционально то же).
- Много альтернативных имён полей в отображении — признак ожидания разных версий API.

---

# Модуль: Химия

Маршрут: `/chemistry`. Страница: `ChemistryPage.jsx` — `src/features/chemistry/components/ChemistryPage/ChemistryPage.jsx`. API: `src/features/chemistry/api/chemistryApi.js`.

## A. Страницы и компоненты

- Вкладки через URL `?tab=stock|batches` (по умолчанию каталог); `setSearchParams` в `react-router-dom`.
- Встроенные модалки: `AddChemistryModal`, `EditChemistryModal`, `CompositionModal`, `ProduceChemistryModal`; `ConfirmModal` деактивация/удаление.
- Таблицы: справочник, остатки, партии (`chemistry/batches/`).

## B. Действия

- CRUD справочника элементов; отдельное окно «Состав» (сырьё + нормы); «Произвести»; деактивация; удаление при `deletable === true`.

## C. Поля форм

**Добавить химию**

- Название *; Единица * (`Select` kg/g); Мин. остаток; Комментарий; Статус *.
- POST `createChemicalElement` с `recipe_lines: []` и опциональными `min_balance`, `comment`.

**Редактировать**

- Как выше + блокировка единицы при `hasProductionHistory(row)` (`has_batches`, `batches_count`).

**Состав химии** (`CompositionModal`)

- Строки: сырьё * (`Select` из `GET raw-materials/`), «Кг сырья на 1 кг химии» * (`DecimalInput`).
- PATCH `updateChemicalElement` с `{ recipe_lines: [{ raw_material_id, quantity_per_unit }] }`. Запрет дубликатов `raw_material_id` на клиенте.

**Произвести химию** (`ProduceChemistryModal`)

- Химия * (`Select` только `is_active !== false`); Количество *; Комментарий опционально.

## D. UI-логика

- Каталог обогащается остатками: merge `GET chemistry/elements/` и `GET chemistry/balances/` по id (`balanceChemId`).
- При открытии «Состав» — `GET chemistry/elements/{id}/` для `recipe_lines`.
- Realtime: `chemistry`, `chemistry_element`, `chemistry_balance`, `chemistry_batch`, `material_balance`.

## E. API

| Метод | Endpoint | Назначение |
|-------|----------|------------|
| GET | `chemistry/elements/` | список |
| GET | `chemistry/elements/{id}/` | деталь для состава |
| POST | `chemistry/elements/` | создание |
| PATCH | `chemistry/elements/{id}/` | метаданные / `recipe_lines` |
| DELETE | `chemistry/elements/{id}/` | удаление |
| GET | `chemistry/balances/` | остатки (массив в `items` или корень) |
| GET | `chemistry/batches/` | партии |
| POST | `chemistry/elements/produce/` | `produceChemistry` — тело `{ chemistry_id, quantity, comment? }` |

Дополнительно страница тянет `raw-materials/` для селектов состава.

## F. Бизнес-правила на фронте

- В тексте UI: химия не закупается как сырьё; выпуск — источник остатка; списание химии при производстве профиля (не в этом модуле).
- Состав — только сырьё, не другая химия (текст подсказки в модалке).

## G. Проблемные места

- В `AddChemistryModal` overlay закрывает по клику без цепочки discard (в отличие от других модалок с `useDiscardOnClose`) — иное UX-поведение.

---

# Модуль: Профили

Маршрут: `/profiles`. Страница: `PlasticProfilesPage.jsx` — `src/features/recipes/components/PlasticProfilesPage/PlasticProfilesPage.jsx`. CRUD профилей через `src/features/production/api/productionApi.js` (`plastic-profiles/`).

## A. Компоненты

- Таблица-плитка профилей + блок «Рецепты: …» под строкой.
- `ProfileMetaModal`; `ConfirmModal` деактивация/удаление.

## B. Действия

- Создать/редактировать/деактивировать/удалить (`deletable === true`); перейти к созданию рецепта; перейти к списку рецептов с фильтром.

## C. Поля «Добавить/Редактировать профиль» (`ProfileMetaModal`)

| Поле | Обязательное | Тип |
|------|----------------|-----|
| Название | да (кнопка submit `disabled` без `name` и `code`) | text |
| Код | да | text |
| Комментарий | нет | text |
| Статус * | да | `Select` активен/неактивен |

POST/PATCH тело: `{ name, code, is_active, comment: '' | string }`.

## D. UI-логика

- Поиск по `name`, `code`, `id` (клиентский фильтр `filtered`).
- Список рецептов по профилю строится из `GET recipes/?page_size=500` в `Map` по `profile_id`.

## E. API

- `GET plastic-profiles/?page=1&page_size=500&ordering=name` через `useServerQuery`.
- `POST plastic-profiles/`, `PATCH plastic-profiles/{id}/`, `DELETE plastic-profiles/{id}/` — функции `createPlasticProfile`, `updatePlasticProfile`, `deletePlasticProfile`.

## F. Бизнес-правила на фронте

- Текст: без рецепта производить нельзя; на профиле может быть несколько рецептов.

## G. Проблемные места

- Импорт API из фичи `production` для страницы в папке `recipes` — связность модулей неочевидна по структуре каталогов.

---

# Модуль: Рецепты

Маршрут: `/recipes`. Страница: `RecipesPage.jsx` — `src/features/recipes/components/RecipesPage/RecipesPage.jsx`. API: `src/features/recipes/api/recipesApi.js`.

## A. Компоненты

- Таблица рецептов; модалки: `RecipeMetaModal`, `RecipeCompositionModal`, `RecipeDetailModal`, `AvailabilityModal`; подтверждения удаления/деактивации.

## B. Действия

- Создать/редактировать метаданные; состав; просмотр по клику на строку; «Проверить доступность»; деактивация (`PATCH` `is_active: false`); удаление при `deletable === true`. Поиск: поле `query.search` уходит в `useServerQuery('recipes/', query)`.

## C. Поля форм

**RecipeMetaModal** («Добавить рецепт» / «Редактировать рецепт»)

- Профиль *: либо заблокирован текстом при `lockedProfileId`, либо `Select` по `plasticProfiles`.
- Название рецепта * (в POST дублируется: `recipe`, `product` — одинаковое значение).
- Комментарий; Статус *.
- При создании дополнительно: `base_unit: 'per_meter'`, `components: []`.

**RecipeCompositionModal** («Состав рецепта»)

- Единый `Select` компонента: префиксы `raw:id` / `chem:id` из списков `raw-materials/` и `chemistry/elements/`.
- Норма «кг/м» * при добавлении строки; таблица строк с редактированием `DecimalInput` и удалением.
- Сохранение: `PATCH recipes/{id}/` с `components`: каждый элемент `{ type: 'raw_material'|'chemistry', quantity_per_meter, unit: 'кг', material_id? , chemistry_id? }`.

**AvailabilityModal**

- Только отображение: `GET recipes/{id}/availability/` — вывод JSON/string в `<pre>`.

## D. UI-логика

- `filter_profile_id` в URL фильтрует список на клиенте.
- Эффект `open=recipe` + `profile_id` открывает модалку создания с зафиксированным профилем и очищает query.
- После выбора профиля в мета-модалке список профилей из предзагруженного `plastic-profiles/`.
- Realtime: `recipe`, `recipes`.

## E. API

| Функция | Метод | Endpoint |
|---------|-------|----------|
| `getRecipes` | GET | `recipes/` |
| `getRecipe` | GET | `recipes/{id}/` |
| `getRecipeAvailability` | GET | `recipes/{id}/availability/` |
| `createRecipe` | POST | `recipes/` |
| `updateRecipe` | PATCH | `recipes/{id}/` |
| `deleteRecipe` | DELETE | `recipes/{id}/` |

Дополнительно: прямые `GET raw-materials/`, `GET chemistry/elements/` для состава и просмотра.

## F. Бизнес-правила на фронте

- Рецепт привязан к профилю (`profile_id` обязателен в submit).
- Текст: рецепт не списывает материалы и не создаёт партии (нормы только).

## G. Проблемные места

- В `RecipeDetailModal` overlay с классом `modal-overlay--no-dismiss` — клик по фону не закрывает (намеренно или нет — в коде явно).

---

# Модуль: Производство

Маршрут: `/production`. Страница: `ProductionPage.jsx` — `src/features/production/components/ProductionPage/ProductionPage.jsx`. Модалки: `ProductionBatchModal` (`src/features/lines/components/ProductionBatchModal.jsx`), `ProductionBatchDetailModal` (`src/features/production/components/ProductionBatchDetailModal/ProductionBatchDetailModal.jsx`). Логика статусов: `src/features/production/lib/batchMeta.js`. API партий: `src/features/production/api/productionApi.js`.

## A. Компоненты

- Таблица партий `GET batches/`; поиск по строке (линия, профиль, рецепт, id, комментарий).
- Кнопки: «Обновить», «Новая партия», «Детали», «В ОТК» (условно).

## B. Действия

- Создать партию; просмотреть/редактировать партию в модалке деталей; отправить в ОТК из списка или из деталей.

## C. Поля «Новая партия» (`ProductionBatchModal`)

| Поле | Обязательное | Тип |
|------|----------------|-----|
| Линия * | если нет `lineId` prop | `Select` только из линий `isLineEligibleForBatch` |
| Профиль * | да | `Select` |
| Рецепт * | да | `Select` фильтр `recipesForProfile` по `profileId` |
| Количество штук * | да | `DecimalInput` → в POST `Math.floor` |
| Длина одной штуки, м * | да | `DecimalInput` |
| Комментарий | нет | textarea |

POST `createProductionBatch`: `{ profile, recipe, line, pieces, length_per_piece, comment? }` — имена полей как в коде (не `profile_id`).

**Детали партии** (`ProductionBatchDetailModal`): просмотр; в режиме редактирования — только штуки, длина, комментарий (`PATCH` с теми же ключами). Кнопка «Отправить в ОТК» недоступна в режиме редактирования (`disabled={otkSending || edit}`).

## D. UI-логика

- Список линий для модалки: `fetchLinesWithShiftSnapshot({ page_size: 200, eligible_for_recipe_run: true })` — параметр query передаётся на бэк.
- При смене профиля `recipeId` сбрасывается (`useEffect` на `profileId`).
- `canSendProductionBatchToOtk` / `batchMetaEditable` — см. `batchMeta.js`.
- Отображение метров: `batchTotalMetersDisplay` — сначала `total_meters` с бэка, иначе `pieces * length_per_piece`.
- Текст на странице: «RecipeRun не списывает остатки» — пояснение цепочки, отдельного UI RecipeRun нет.

## E. API

| Функция | Метод | Endpoint | Тело |
|---------|-------|----------|------|
| `getPlasticProfiles` | GET | `plastic-profiles/` | для модалки |
| `createProductionBatch` | POST | `batches/` | см. выше |
| `getProductionBatches` | GET | `batches/` | список на странице |
| `getProductionBatch` | GET | `batches/{id}/` | детали |
| `updateProductionBatch` | PATCH | `batches/{id}/` | pieces, length_per_piece, comment |
| `submitProductionBatchForOtk` | POST | `batches/{id}/submit-for-otk/` | `{}` |

В `productionApi.js` комментарий: **`total_meters` только read-only на сервере — не отправлять.**

## F. Бизнес-правила на фронте

- Партия без открытой непрерывной смены на линии (и без паузы) не создаётся — фильтр `isLineEligibleForBatch`.
- `pieces` целое через `Math.floor`.
- Редактирование метаданных партии (профиль/рецепт/линия) через эту страницу **в коде не найдено** — только шт/длина/комментарий.

## G. Проблемные места

- В таблице заголовки «₽/м», «₽/шт», а `moneyCell` форматирует число без символа валюты — несоответствие подписи и формата.

---

# Модуль: ОТК

Маршрут: `/otk`. Страница: `OTKPage.jsx` — `src/features/otk/components/OTKPage/OTKPage.jsx`. API: `src/features/otk/api/otkApi.js`.

## A. Компоненты

- Вкладки «Ожидают» / «История».
- Таблицы `otk-table`; модалки: `AcceptModal`, `HistoryDetailModal`; мобильные `FiltersModal` / `FilterBar`.

## B. Действия

- Фильтрация/поиск/сортировка через query state; пагинация по `meta`.
- «Проверить» → ввод принято/брак и сохранение.

## C. Поля «Проверка партии» (`AcceptModal`)

| Поле | Обязательное | Поведение |
|------|----------------|-----------|
| Принято, шт | логически для submit | `DecimalInput`; при известном `produced` автокоррекция второго поля |
| Брак, шт | аналогично | взаимная подстройка с принятым если `produced > 0` |
| Причина брака | обязательна если брак > 0 | text |
| Комментарий | нет | |
| Инспектор | нет | text → `inspectorName` |
| Дата проверки | нет | `datetime-local` → ISO в `checkedAt` |

Submit допускается только если `a + d > 0`; при `produced > 0` требуется `a + d === produced`. Поле `inspectorId` в форме **в коде не найдено** (в `handleAcceptSubmit` передаётся только из данных формы; в `AcceptModal` `inspectorId` не задаётся — всегда `undefined` в `acceptBatch`).

## D. UI-логика

- `getBatchesAwaitingOtk`: сначала `GET otk/pending/`, при 404/405 fallback на `GET batches/` с теми же query.
- `getOtkHistory`: `GET batches/` с query из UI (`otk_status`, `ordering`, …).
- Realtime: `production_batch`, **`recipe_run`** (идентификатор типа события; отдельного экрана RecipeRun нет).
- Подсказки по рецепту: функция `recipeContextHint` читает разные поля партии.

## E. API

`acceptBatch` → `POST batches/{id}/otk_accept/` с телом после нормализации:

- `otk_accepted`, `otk_defect` — **строки** с целыми числами (комментарий в `otkApi.js`).
- Также дубли: `accepted`, `rejected` (числа).
- `otk_status`: `'rejected'` если defect>0 и accepted===0, иначе `'accepted'`.
- Опционально: `otk_defect_reason`, `otk_comment`, `otk_inspector`, `otk_inspector_name`, `otk_checked_at`.

## F. Бизнес-правила на фронте

- Строгий баланс принято+брак = выпуск, если выпуск известен (`releasedQty`).
- При нулевом выпуске допускается submit если сумма > 0 (проверка `a + d <= 0` запрещает, но равенство `produced` не проверяется если `produced === 0`).

## G. Проблемные места

- `inspectorId` не собирается в UI, хотя `acceptBatch` его поддерживает.
- Fallback очереди ОТК на общий список `batches/` может показывать не те партии, если бэк не фильтрует — зависит от сервера.

---

# Модуль: Склад готовой продукции

Маршрут: `/warehouse`. Страница: `WarehousePage.jsx` — `src/features/warehouse/components/WarehousePage/WarehousePage.jsx`. Вспомогательные: `PackFromOtkModal.jsx`, `warehouseBatchCard.js`. API файл: `src/features/warehouse/api/warehouseApi.js` (только упаковка; остальное через `apiClient`).

## A. Компоненты

- Таблица `GET warehouse/batches/` с пагинацией/фильтрами в query.
- `WarehouseBatchDetailModal` (локальный в файле), `ReserveModal`, `PackFromOtkModal`, `FiltersModal` (мобильный), `ActionMenu`.

## B. Действия

- Поиск, фильтры статуса и `inventory_form`; клик по строке → детали; меню «Резерв» для `status === 'available'`; «Упаковать».

## C. Поля

**Резерв** (`ReserveModal`)

- Продукт: `readOnly` (передаётся `batch.product` — внимание: при открытии передаётся `product: productLabel` из строки таблицы в `setReserveTarget`; поле называется `product` в state резерва).
- Количество * — `DecimalInput`.
- Раскрывающийся блок: № продажи — необязательный `input type="number"`.

POST `warehouse/batches/reserve/`: `{ batch_id, quantity, sale_id? }`.

**Упаковать** (`PackFromOtkModal`)

- Продукт * — `Select` из уникальных продуктов строк `GET warehouse/batches/?page_size=200&status=available&inventory_form=unpacked`.
- Высота/ширина/уголь * — метры/градусы; «Штук в каждой», «Упаковок» *.
- Кнопка «Макс.» для упаковок при известном остатке.

POST `warehouse/batches/package/` через `packFromOtk`: тело включает `product_id`, `shift_height`, `shift_width`, `width_meters` (дубликат ширины), `angle_deg`, `pieces_per_package`, `packages_count`, `unit_meters` (= высота), `package_total_meters` (= округлённое `ipp * height`).

## D. UI-логика

- `sumNotPackedQtyMatchingParams` для расчёта доступного количества под выбранные габариты.
- Realtime ключ: `warehouse_batch`.

## E. API

- `GET warehouse/batches/` — основной список.
- `POST warehouse/batches/reserve/` — резерв.
- `POST warehouse/batches/package/` — `packFromOtk`.

## F. Бизнес-правила на фронте

- Резерв только для статуса `available` (сравнение строки `toLowerCase() === 'available'`).
- Упаковка только из неупакованных остатков с сопоставлением по продукту и тройке параметров.

## G. Проблемные места

- В `ReserveModal` в readOnly поле прокидывается `batch.product`, а при открытии в `setReserveTarget` кладётся `product: productLabel` — если структура изменится, возможна путаница имён.

---

# Модуль: Клиенты

Маршрут: `/clients` (при `STAGE2_TABS_ENABLED`). Файл: `ClientsPage.jsx` — `src/features/clients/components/ClientsPage/ClientsPage.jsx`.

## A. Компоненты

- Таблица клиентов; `ClientModal`; `HistoryModal`; подтверждение удаления.

## B. Действия

- Создать/редактировать по клику на строку; удалить из меню если `clientCanDelete` (нет продаж по счётчикам); «История».

## C. Поля `ClientModal`

Обязательное явно: только **Название / компания** (`required`). Остальные поля опциональны.

- Телефон, контактное лицо, WhatsApp/Telegram, email, чекбокс «Клиент активен», блок «Ещё»: доп. телефон, адрес, тип, комментарий (`textarea`).

PATCH/POST отправляет смешанный набор ключей: `phone`, `contact_person`, `messenger`, `whatsapp_telegram` (дубль), `email`, `phone_alt`, `address`, `client_type`, `notes` и `comment` (дубль строки комментария), `is_active`.

## D. UI-логика

- История: `GET clients/{id}/history/`; если `items` пустой — fallback `GET sales/?page_size=200&client_id=`.

## E. API

- `GET clients/` с `page`, `page_size`, `search`.
- `POST clients/`, `PATCH clients/{id}/`, `DELETE clients/{id}/`.
- `GET clients/{id}/history/`, условно `GET sales/`.

## F. Бизнес-правила на фронте

- В продажах в селект клиентов попадают только активные (`is_active !== false && active !== false` на стороне SalesPage при загрузке; здесь — отображение бейджа).

## G. Проблемные места

- Дублирование полей `notes`/`comment`, `messenger`/`whatsapp_telegram` в одном submit.

---

# Модуль: Продажи

Маршрут: `/sales` (при `STAGE2_TABS_ENABLED`). Файл: `SalesPage.jsx` — `src/features/sales/components/SalesPage/SalesPage.jsx`. Утилита накладной: `src/features/sales/api/salesApi.js` (`downloadSaleWaybill`).

## A. Компоненты

- Таблица продаж; `SaleModal` (создание/редактирование); фаза успеха с кнопкой накладной; подтверждение удаления; `ActionMenu` (накладная, удалить).

## B. Действия

- Создать, редактировать (клик по строке), удалить; скачать накладную (несколько URL по очереди).

## C. Поля `SaleModal`

- Дата продажи (`type="date"`).
- Клиент — `Select` с опцией «Без клиента».
- Партия склада * — `Select` по списку `products` из `GET warehouse/batches/?page_size=500&status=available`.
- Единица: радиокнопки «Упаковки» / «Штуки» — **«Упаковки» disabled если форма склада не `packed`**; **«Штуки» disabled если форма `packed`** (т.е. для упакованного — только упаковки).
- Количество: либо штуки, либо блок «упаковок × штук в каждой» с подсказкой и кнопкой «Макс.».
- Поле override «штук в упаковке» для продажи упаковками.
- Цена — `DecimalInput`; комментарий в `Collapse`.

## D. UI-логика

- Автоподстановка `saleUnit` при смене партии в зависимости от `resolveInventoryForm`.
- Автозаполнение `overridePiecesPerPackage` из метаданных партии для упакованных.
- Расчёт `sold_pieces` / проверка остатка: `computePiecesForApi`, `stockExceeded`.
- `piece_pick` / `stock_form` / `sale_mode` — см. комментарии и `useMemo` `piecePickForApi`, `sendPiecePick` в файле.
- Для редактирования: если в записи продажи нет id партии, попытка сопоставить склад по `product_id` через `sameWarehouseProductKey`.

## E. API

- `GET sales/?page&page_size` — список.
- `POST sales/`, `PATCH sales/{id}/`, `DELETE sales/{id}/`.
- Загрузка клиентов и складских партий — см. выше.
- Накладная: последовательные `GET` с `responseType: 'blob'`: `sales/{id}/nakladnaya/`, `…/waybill/`, `…/invoice/`; при неудаче — локальный HTML черновик.

Тело создания/обновления (основные ключи из кода): `client_id`/`client`, `product` (каталожный id), `warehouse_batch`/`warehouse_batch_id`, `sale_mode`, `sold_pieces`, `sold_packages?`, `length_per_piece?`, `quantity`, `quantity_unit`, `quantity_input`, `stock_form`, `piece_pick?`, `override_pieces_per_package?`, `price?`, `comment?`, `sale_date`/`date`.

## F. Бизнес-правила на фронте

- Submit запрещён без привязки продукта каталога к партии: `readCatalogProductIdFromWarehouseBatch` — иначе сообщение «выберите другую строку».
- Клиент в селекте — только активные из `GET clients/`.

## G. Проблемные места

- Можно сохранить продажу без выбранного клиента (опция «Без клиента») — бизнес-ограничение только на стороне бэка, если оно есть.

---

# Модуль: Аналитика

Маршрут: `/analytics`. Файл: `AnalyticsPage.jsx` — `src/features/analytics/components/AnalyticsPage/AnalyticsPage.jsx`. API-файл: `src/features/analytics/api/analyticsApi.js` (часть запросов дублируется прямым `apiClient` в странице).

## A. Компоненты

- Панель фильтров (год, месяц, день, сброс, доп. id-фильтры и даты).
- Секции карточек и графиков (recharts): финансы, тренды, продажи, клиенты, условный блок ОТК, производство, склад ГП, остатки сырья/химии.
- `DetailModal` для кликов по карточкам приход/расход/списания; для прибыли — без запроса, расчёт из уже загруженных `data`.

## B. Действия

- Менять фильтры → перезагрузка `GET analytics/summary/` с параметрами `year`, `month`, `day`, `line_id`, `client_id`, `profile_id`, `recipe_id`, `batch_id`, `status`, `date_from`, `date_to`.
- Открыть детализацию по карточкам прихода/расхода/списаний.

## C. Поля

- Фильтры — это не «форма сущности», а набор инпутов без отдельного имени формы: числовой год, `Select` месяца/дня, текстовые id, `type="date"` для периода, текстовое поле «Статус».

## D. UI-логика

- Два запроса `analytics/summary/` подряд с разными params для основного блока и трендов (`trendsParams`).
- `buildFullMonthTrendsData` дополняет пропущенные дни месяца нулями.
- `DetailModal` для `profit` не вызывает отдельный API — показывает `data` из пропсов.

## E. API

| Вызов | Endpoint |
|-------|----------|
| `apiClient.get('analytics/summary/', { params })` | основной + тренды |
| `getRevenueDetails` | `analytics/revenue-details/` |
| `getExpenseDetails` | `analytics/expense-details/` |
| `getWriteoffDetails` | `analytics/writeoff-details/` |

Ожидаемая форма ответа summary используется через вложенные объекты: `finances`, `sales`, `production`, `warehouse`, `stock_balances`, `trends`, опционально `otk`, `period` (для модалки деталей через `fullData.period`).

## F. Бизнес-правила на фронте

- Карточка «Списания сырья» суммирует поле из нескольких возможных имён (`writeoff_total`, `writeoffs`, …).

## G. Проблемные места

- В `DetailModal` для `profit` в разметке используются поля `data.revenue` / `data.expenses` / `data.profit` напрямую; проп называется `data` и передаётся как `detailModal.data` (= `finances`). Нужно совпадение структуры `finances` с этими ключами — иначе некорректное отображение (в коде нет ветвления на `finances.revenue` и т.д.).

---

# Ключевые выводы по фронтенду

## Что реализовано согласованно с заявленной цепочкой

- Навигация и комментарии в UI отражают цепочку: сырьё → химия → рецепты профиля → производство (партия) → ОТК → склад ГП → продажи.
- Создание производственной партии жёстко требует линию с открытой сменой, профиль и рецепт этого профиля; метраж и себестоимость вводятся не в форме создания.
- Рецепт профиля хранит нормы «кг/м» с раздельным выбором сырья и химии в одном списке компонентов.
- ОТК отправляет на бэк нормализованное тело с дублированием строковых/числовых полей для совместимости с DRF.

## Что выглядит незавершённым или зависит от бэкенда

- `materials/movements/` и ряд аналитических detail-эндпоинтов — в UI заложены сообщения при отсутствии реализации.
- Очередь ОТК с fallback на общий `batches/` без гарантии семантики фильтрации на сервере.
- Накладная продажи с многоступенчатым перебором URL и локальным HTML-черновиком.

## Что выглядит устаревшим или разъезжается с текущими названиями

- Query-параметр `eligible_for_recipe_run` при выборе линии для **производственной партии** (название из домена «recipe run», тогда как UI RecipeRun отсутствует).
- Подписи валюты/символа: производство (₽ в шапке таблицы) vs продажи/аналитика (сом) в разных экранах.

## Что может ломать бизнес-логику или вводить в заблуждение

- Расхождение подписей колонок себестоимости и фактического форматирования на `ProductionPage`.
- Жёсткая логика ОТК «принято+брак=выпуск» при ненулевом выпуске — расхождение с данными бэка даст блокировку submit.
- `DetailModal` прибыли в аналитике: потенциальная ошибка ключей объекта `finances`.
- Продажа без привязки `product` к каталогу для выбранной партии блокируется только на клиенте после выбора партии без id продукта.

---

*Конец документа.*
