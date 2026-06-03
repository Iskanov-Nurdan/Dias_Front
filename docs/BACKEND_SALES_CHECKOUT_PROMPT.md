# Промпт для бэкенда: продажи (касса)

Скопируйте текст ниже в задачу бэкенду. Фронт `Dias_Front` уже реализован; без этих API касса будет работать частично.

---

## Задача

Доработать API продаж под новый UI кассы: только **штуки**, цена из профиля, дата продажи, смешанная оплата, реквизит карты/телефона.

## 1. Создание и preview продажи

### `POST /api/sales/preview/` и `POST /api/sales/`

```json
{
  "client": 1,
  "sale_date": "2026-06-03",
  "unit_type": "pieces",
  "sale_lines": [
    { "warehouse_batch": 12, "quantity": "2" }
  ],
  "payment_type": "full",
  "payment_method": "cash",
  "paid_amount": "32"
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `client` | да | ID клиента |
| `sale_date` | да | `YYYY-MM-DD` |
| `sale_lines[]` | да | Только `warehouse_batch` + `quantity` (шт). `unit_type: pieces` или опустить |
| `unit_price` | нет | Если передан — сверка с `cost_price + markup_amount` профиля (допуск 0.01) |
| `payment_type` | да | `full` \| `partial` \| `debt` |
| `payment_method` | да | `cash` \| `card` (перевод = карта, отдельного `transfer` не нужно) |
| `paid_amount` | да* | Сумма, зачтённая в продажу (*при `debt` = 0) |

### Смешанная оплата (желательно)

```json
{
  "payment_type": "full",
  "payment_method": "card",
  "paid_amount": "32",
  "payment_splits": [
    { "payment_method": "cash", "amount": "10" },
    { "payment_method": "card", "amount": "22" }
  ],
  "payment_reference": "+996701111544"
}
```

- `payment_splits` — разбивка нал + карта; `paid_amount` = сумма splits.
- `payment_reference` — номер карты или телефон (строка, для отчётов).

Если `payment_splits` не поддерживается — принять только `paid_amount` + один `payment_method` (фронт шлёт основной способ).

## 2. Цена строки

Автоматически: `unit_price = profile.cost_price + profile.markup_amount`.

- В `sale_lines` можно не передавать `unit_price`.
- Preview возвращает `total_amount`, `sale_lines[].unit_price`, `line_total`.

## 3. `GET /api/sales/select-sources/`

По клиенту (опционально `?client=`):

```json
{
  "profile_stock": [
    {
      "id": 12,
      "profile_id": 5,
      "product_name": "Пластиковый профиль 6 м премиум",
      "available_pieces": 9,
      "unit_sale_price": "129"
    }
  ]
}
```

- Только штуки, без упаковок (`available_gp_packages` — deprecated).
- Остатки можно агрегировать по `profile_id` или отдавать партии — фронт группирует сам.

## 4. Список продаж

В ответе: `sale_date` или `date`, `total_amount`, `paid_amount`, `debt_amount`, `payment_type`, `payment_method`.

## 5. Клиенты

`POST /api/clients/` — без изменений (физ/юр, телефон). Ответ: `{ "id": 123, "name": "...", ... }` — фронт сразу подставляет в продажу.

## 6. Чеклист

- [ ] `sale_date` в create + preview
- [ ] Авто `unit_price` из профиля
- [ ] Select-sources: `profile_stock` / партии в штуках + `profile_id`
- [ ] Deprecated: упаковки в sales API
- [ ] `payment_splits` + `payment_reference` (опционально, но нужно для смешанной оплаты)
- [ ] `payment_method`: только `cash` и `card`

## 7. Примеры сценариев

**Наличные, сдача на кассе:** клиент дал 35, к оплате 32 → `paid_amount: "32"`, `payment_type: "full"`, `payment_method: "cash"`. Сдача считается на фронте.

**Только карта:** `payment_method: "card"`, `paid_amount: "32"`, `payment_reference: "4111..."`.

**Смешанная:** 10 нал + 22 карта → `payment_splits` как выше.

**В долг:** `payment_type: "debt"`, `paid_amount: "0"`.

---

Подробности по складу и профилям: `BACKEND_SALES_SIMPLIFICATION.md`, `BACKEND_PROFILE_COST_PRICE.md`.
