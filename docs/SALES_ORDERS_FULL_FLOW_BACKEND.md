# Промпт для бэкенда: заявка с несколькими профилями (Касса → Производство → ОТК → Продажа)

Один документ на весь флоу. Фронт готов; нужны согласованные ответы API.

---

## 1. Заявка — `order_lines[]` везде

### POST `/api/orders/`

```json
{
  "client": 1,
  "date": "2026-05-21",
  "order_lines": [
    { "profile": 5, "quantity": 20 },
    { "profile": 12, "quantity": 10 }
  ]
}
```

### GET `/api/orders/` и GET `/api/orders/{id}/`

В **каждой** заявке полный массив:

```json
{
  "id": 42,
  "client_id": 1,
  "client_name": "Abytov diyar",
  "date": "2026-05-21",
  "request_status": "ready",
  "lines_count": 2,
  "order_lines": [
    { "id": 101, "profile_id": 5, "profile_name": "Пластиковый профиль 5м", "quantity": "20" },
    { "id": 102, "profile_id": 12, "profile_name": "Пластиковый профиль 6м", "quantity": "10" }
  ]
}
```

**Не достаточно** только `profile_id` / `quantity` на корне заказа.

---

## 2. Производство → Заявки

### GET `/api/production/requests/`

Как в п.1 + на позиции (или на заявке fallback):

- `allowed_blank_ids` — заготовки для профиля + универсальные (`plastic_profile=null`)

### POST `/api/production/requests/{order_id}/start/`

**Без `line` в теле. Смена — личная (`shifts/my/`), не «смена на линии». Ошибки без слова «линия».**

**Несколько профилей:**

```json
{
  "line_starts": [
    { "order_line_id": 101, "blank": 1 },
    { "order_line_id": 102, "blank": 2 }
  ]
}
```

**Одна позиция:** `{ "blank": 1, "order_line_id": 101 }`

**Не использовать** `{ "blanks": [1, 2] }` без привязки к `order_line_id` — в ОТК будет неясно, что к чему.

**Поведение:** на каждый элемент `line_starts` — отдельный `BlankProductionRun`, `product_*` из профиля строки, `blank_*` из выбранной заготовки, связь `order_line_id` + `client_request_id`.

**Ошибки:** `LINE_STARTS_REQUIRED`, `MISSING_LINE_BLANK`, `UNKNOWN_ORDER_LINE`, `BLANK_PROFILE_MISMATCH`, `BLANK_NOT_FOUND`, `BLANK_INSUFFICIENT_STOCK`, `NO_OPEN_SHIFT` (текст: «Откройте Моя смена»).

---

## 3. ОТК — отдельная строка на профиль

### GET `/api/workshop/blank-production-runs/`

Одна запись = один профиль + одна заготовка:

```json
{
  "id": 55,
  "product_id": 5,
  "product_name": "Пластиковый профиль 5м",
  "blank_id": 1,
  "blank_name": "Заготовка ПВХ смесь №1",
  "order_line_id": 101,
  "client_request_id": 42,
  "created_at": "2026-05-21T12:00:00Z"
}
```

**Не** объединять несколько профилей одной заявки в один run.

---

## 4. Продажа — заявка целиком, товары из всех `order_lines`

### GET `/api/sales/select-sources/?client={id}`

**`available_orders` (или `orders`):**

- **Один объект на одну заявку** (`id` уникален). Не дублировать одну заявку несколькими строками списка (по одной на профиль).
- В объекте обязательно `order_lines[]` (все позиции) и `lines_count`.
- Даты: `date` / `order_date` / `created_at` — для подписи в UI «21.05.2026 — 2».

Пример:

```json
{
  "available_orders": [
    {
      "id": 42,
      "client_id": 1,
      "date": "2026-05-21",
      "lines_count": 2,
      "payment_type": "partial",
      "payment_method": "cash",
      "total_amount": "100000",
      "paid_amount": "40000",
      "amount_remaining": "60000",
      "order_lines": [
        { "id": 101, "profile_id": 5, "profile_name": "Пластиковый профиль 5м", "quantity": "20" },
        { "id": 102, "profile_id": 12, "profile_name": "Пластиковый профиль 6м", "quantity": "10" }
      ],
      "prepaid_amount": "5000"
    }
  ],
  "available_warehouse_batches": [ ... ]
}
```

Фронт при выборе заявки также вызывает `GET /api/orders/{id}/` — ответ должен совпадать по `order_lines`.

### POST `/api/sales/` и POST `/api/sales/preview/`

```json
{
  "client": 1,
  "order": 42,
  "sale_lines": [
    {
      "warehouse_batch": 10,
      "quantity": "20",
      "unit_price": "150",
      "unit_type": "pieces",
      "order_line": 101
    },
    {
      "warehouse_batch": 11,
      "quantity": "10",
      "unit_price": "180",
      "unit_type": "pieces",
      "order_line": 102
    }
  ],
  "payment_type": "full",
  "payment_method": "cash"
}
```

- Одна продажа на заявку — **несколько** `sale_lines`, по одной на `order_line`.
- `order_line` / `order_line_id` — id из `order_lines[].id`.
- `quantity` в `sale_lines` — из `order_lines[].quantity` (фронт подставляет, не больше остатка партии).
- **Оплата:** в `available_orders` и `GET orders/{id}/` те же поля, что при создании заявки: `payment_type`, `payment_method`, `total_amount`, `paid_amount`, `amount_remaining`. Фронт: аванс по заявке + доплата при продаже (`paid_amount` в sale + `order_paid_amount_applied`).
- Списание со склада — по выбранной `warehouse_batch` и количеству.

---

## 5. Сводка логики

| Этап | UI | Бэкенд |
|------|-----|--------|
| Касса | Одна заявка, несколько профилей в таблице | `order_lines[]` в list/detail |
| Производство | Каждый профиль — своя заготовка, свой Старт | `line_starts` → N runs |
| ОТК | N строк (товар + заготовка) | N `BlankProductionRun` |
| Продажа | Одна заявка в селекте «дата — N», N товаров в корзине | `available_orders` + `sale_lines[]` с `order_line` |

---

## 6. Проверка (smoke)

1. Создать заявку: 2 профиля → `GET orders/42/` → `order_lines.length === 2`.
2. Производство: 2 заготовки → `line_starts` → 2 записи в `blank-production-runs/`, разные `product_name`.
3. Продажа: выбрать заявку → в UI 2 позиции в корзине; `POST sales/preview/` с 2 `sale_lines` и разными `order_line` → 200.

Тесты: `test_production_requests_api.py`, тесты sales select-sources + create sale с multi-line order.
