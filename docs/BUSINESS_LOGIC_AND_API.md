# Бизнес-логика фронта и HTTP API

Документ описывает **как** фронт ходит в бэкенд: транспорт, заголовки, формат ответов и перечень путей. Источник — код (`src/shared/api`, `src/features/**/api`, прямые вызовы `apiClient` в страницах).

---

## 1. Транспорт

| Параметр | Значение |
|----------|----------|
| Клиент | Axios, инстанс `apiClient` (`src/shared/api/client.js`) |
| Base URL | `API_BASE` из `src/shared/config/api.js`: `process.env.REACT_APP_API_URL` или по умолчанию `http://127.0.0.1:8000/api/` (всегда с завершающим `/`) |
| Формат | `Content-Type: application/json`, `Accept: application/json` |
| Авторизация | `Authorization: Bearer <token>` из `localStorage.token` |
| Аудит смены | Если задан `setAuditShiftId` → заголовки `X-Audit-Shift-Id` и `X-Shift-Id` (`src/shared/lib/auditContext.js`) |
| Идемпотентность | Для POST/PATCH/PUT/DELETE без своего id — автоматически `X-Request-Id` (UUID или fallback) |
| Ошибки | 401 → очистка токенов, редирект `/login`; 403/409/429 → обогащение `userMessage` |

---

## 2. Списки и пагинация

- Ожидаемый контракт: **`{ items, meta, links }`** (DRF-подобная пагинация). См. `parseApiListResponse` в `src/shared/lib/apiList.js`.
- Хук `useServerQuery(url, queryState)` делает **GET** `url?` + query-string из объекта (массивы через `append` несколько раз). Результат: `items`, `meta`, `links`, `raw`.

---

## 3. Обновление данных в реальном времени

- `useOperationalRefetch(resources, refetch)` подписывается на WS (`OperationalRealtimeContext`): при `event: "change"` и совпадении `resource` вызывается `refetch()`.
- Типичные `resource`: `production_batch`, `line`, `line_history`, `shift`, `sale`, `warehouse_batch`, `material_balance`, `chemistry`, … — как шлёт бэкенд (в т.ч. устаревшие имена вроде `recipe_run`, если бэк их шлёт).

---

## 4. Модули и эндпоинты

Пути ниже — **относительно** `API_BASE` (без дублирования `/api`).

### 4.1 Авторизация (`src/features/auth/api/authApi.js`)

| Метод | Путь | Тело / примечание |
|-------|------|-------------------|
| POST | `auth/login` | `{ name, password }` |
| POST | `auth/logout` | `{ refresh }` из `localStorage.refresh` |
| GET | `me` | профиль |

### 4.2 Пользователи и роли

| Метод | Путь | Примечание |
|-------|------|------------|
| GET/POST | `users/` | список / создание |
| GET/PATCH/DELETE | `users/{id}/` | |
| PATCH | `users/{id}/access/` | `{ access_keys: string[] }` — вкладки UI |
| GET/POST | `roles/` | |
| GET/PATCH/DELETE | `roles/{id}/` | |

### 4.3 Линии (`src/features/lines/api/linesApi.js`)

| Метод | Путь | Примечание |
|-------|------|------------|
| CRUD | `lines/`, `lines/{id}/` | |
| POST | `lines/{id}/open/` | открыть смену на линии; тело: `height`, `width`, `angle_deg`, опц. `comment`, `session_title` |
| POST | `lines/{id}/close/` | закрыть смену |
| PATCH | `lines/{id}/shift-params/` | параметры открытой смены |
| POST | `lines/{id}/shift-pause/`, `lines/{id}/shift-resume/` | пауза / снятие |
| GET | `lines/{id}/history/` | история линии |
| GET | `lines/history/` | общая лента (`page`, `page_size`, …) |
| GET | `lines/{lineId}/history/session/` | `open_event_id` — таймлайн сессии |

Фильтр линий с открытой сменой без паузы: `eligible_for_recipe_run=true` на `GET lines/` (выбор линии для партии профиля в модалке на линии и на странице `/production`).

### 4.4 Смены и аудит (`src/features/shifts/api/shiftsApi.js`)

| Метод | Путь | Примечание |
|-------|------|------------|
| GET | `shifts/my/` | текущая личная открытая смена |
| POST | `shifts/open/`, `shifts/close/` | тело: опц. `line_id`, размеры для линии |
| GET/POST | `shifts/notes/` | заметки личной смены |
| GET | `shifts/`, `shifts/history/`, `shifts/{id}/` | |
| GET | `shifts/complaints/` | фильтры: `date`, `date_from`, `date_to`, `author_id`, … |
| POST | `shifts/complaints/` | |
| GET | `activity/my/`, `activity/my/{id}/` | журнал «мой» |
| GET | `activity/`, `activity/{id}/` | с правами админа; `user_id` для чужого |

### 4.5 Сырьё и приход (`src/features/materials/api/materialsApi.js`)

| Метод | Путь | Примечание |
|-------|------|------------|
| CRUD | `raw-materials/`, `raw-materials/{id}/` | |
| GET/POST | `incoming/` | приходы; в UI история по материалу: фильтр `material_id`, `ordering: -received_at` |
| GET | `materials/balances/` | агрегированные остатки |

### 4.6 Химия (`src/features/chemistry/api/chemistryApi.js`)

Модуль **только** справочник химии, остатки/партии химии и выпуск через `produce`. Производство профиля (партии пластика) сюда **не** относится — см. §4.8 и страницу `/production`.

| Метод | Путь | Примечание |
|-------|------|------------|
| CRUD | `chemistry/elements/`, `chemistry/elements/{id}/` | тело: `name`, `unit` (`kg`/`g`), `min_balance`, `is_active`; строки состава: **`recipe_lines`** (или алиас **`compositions`** при создании) — в каждой строке `raw_material_id`, `quantity_per_unit` (кг сырья на 1 кг химии). GET одной позиции отдаёт `recipe_lines`. |
| GET | `chemistry/balances/`, `chemistry/batches/` | остатки / партии химии (read-only) |
| POST | `chemistry/elements/produce/` | тело: **`chemistry_id`**, **`quantity`**, опц. `comment` — не `quantity_produced` |

**Бэкенд:** при PATCH, если в теле переданы `recipe_lines` / `compositions`, состав перезаписывается (`apps/chemistry/serializers.py` → `ChemistryCatalogSerializer.update` в репозитории DIas_ERP).

**UI:** `src/features/chemistry/components/ChemistryPage/ChemistryPage.jsx` — вкладки «Справочник и состав» (карточка + редактор `recipe_lines`) и «Остатки и выпуск».

### 4.7 Рецептуры (`src/features/recipes/api/recipesApi.js`)

| Метод | Путь |
|-------|------|
| CRUD | `recipes/`, `recipes/{id}/` |
| GET | `recipes/{id}/availability/` |

### 4.8 Профили и партии производства (`src/features/production/api/productionApi.js`)

Единая сущность производства профиля на фронте — **ProductionBatch** (`batches/`). Ввод только **`pieces`** и **`length_per_piece`**; метраж не вводится вручную.

| Метод | Путь | Примечание |
|-------|------|------------|
| CRUD | `plastic-profiles/`, `plastic-profiles/{id}/` | |
| CRUD | `batches/`, `batches/{id}/` | создание партии: обязательны `profile`, `recipe`, `line`, `pieces`, `length_per_piece`; **`total_meters` не слать** (read-only на сервере) |

**UI:**

- `src/features/production/components/ProductionPage/ProductionPage.jsx` — маршрут `/production`, доступ `production`: список `GET batches/`, «Новая партия».
- `src/features/lines/components/ProductionBatchModal.jsx` — то же создание партии с линии; если `lineId` не передан (страница производства), в модалке выбирается линия.

**Связка id партий:** `GET batches/?id__in=1,2,...` чанками по 40 id (`src/features/otk/api/otkApi.js` — `fetchBatchesByIds`).

**Устаревшее на фронте:** эндпоинты `chemistry/recipe-runs/` в коде приложения **не** используются (раньше замесы были привязаны к модулю химии).

### 4.9 ОТК (`src/features/otk/api/otkApi.js`)

| Метод | Путь | Примечание |
|-------|------|------------|
| GET | `otk/pending/` | очередь (если нет 404/405 — fallback на `batches/`) |
| GET | `batches/` | история / список с фильтрами |
| POST | `batches/{id}/otk_accept/` | тело формируется из UI: `otk_accepted`, `otk_defect` (строки с числами), `accepted`, `rejected`, `otk_status`, опц. `otk_defect_reason`, `otk_comment`, `otk_inspector` |

### 4.10 Склад ГП (`src/features/warehouse/api/warehouseApi.js` + страница)

| Метод | Путь | Примечание |
|-------|------|------------|
| GET | `warehouse/batches/` | список (`page`, `page_size`, `status`, `search`, `inventory_form`, …) |
| POST | `warehouse/batches/reserve/` | `{ batch_id, quantity, sale_id? }` |
| POST | `warehouse/batches/package/` | упаковка после ОТК: `product_id`, `shift_height`, `shift_width`, `angle_deg`, `pieces_per_package`, `packages_count`, `unit_meters`, `package_total_meters` (см. комментарии в коде) |

### 4.11 Клиенты (`src/features/clients/components/ClientsPage/ClientsPage.jsx`)

| Метод | Путь | Примечание |
|-------|------|------------|
| CRUD | `clients/`, `clients/{id}/` | |
| GET | `clients/{id}/history/` | |
| GET | `sales/` | `client_id`, `page_size` — продажи по клиенту |

### 4.12 Продажи (`src/features/sales/`)

| Метод | Путь | Примечание |
|-------|------|------------|
| GET | `sales/` | таблица продаж |
| POST/PATCH/DELETE | `sales/`, `sales/{id}/` | |
| GET | `clients/`, `warehouse/batches/` | справочники в форме (`page_size`, для складских партий часто `status: available`) |

**Накладная:** `downloadSaleWaybill` — последовательно GET с `responseType: 'blob'`: `sales/{id}/nakladnaya/`, `.../waybill/`, `.../invoice/`; при отсутствии — локальный HTML-черновик.

### 4.13 Аналитика (`src/features/analytics/api/analyticsApi.js`)

| Метод | Путь |
|-------|------|
| GET | `analytics/summary/` |
| GET | `analytics/revenue-details/` |
| GET | `analytics/expense-details/` |
| GET | `analytics/writeoff-details/` |

---

## 5. Доступ по ролям (UI)

Ключи секций: `ACCESS_KEYS` в `src/shared/config/constants.js` (`users`, `lines`, `materials`, `chemistry`, `recipes`, `orders`, `production`, `otk`, `warehouse`, `clients`, `sales`, `shipments`, `analytics`, `shifts`, `my_shift`). Соответствие правам бэка — через `users/{id}/access/`.

Маршруты вкладок: `ACCESS_ROUTE_MAP` и группы бокового меню — `getNavSections()` в `src/shared/config/navigation.js` (в т.ч. `/production` → ключ `production`).

---

## 6. Где смотреть код

| Задача | Файл(ы) |
|--------|---------|
| Axios и перехватчики | `src/shared/api/client.js` |
| Базовый URL | `src/shared/config/api.js` |
| Списки из ответа | `src/shared/lib/apiList.js` |
| Норматив выпуска рецепта (справочно) | `src/shared/lib/recipeRelease.js` |
| Партии производства (API) | `src/features/production/api/productionApi.js` |
| Партии производства (страница списка) | `src/features/production/components/ProductionPage/ProductionPage.jsx` |
| Навигация и `/production` | `src/shared/config/navigation.js`, `src/app/routes/AppRoutes.jsx` |

При расхождении с бэкендом приоритет у серверного контракта; этот документ отражает **текущий фронт**.
