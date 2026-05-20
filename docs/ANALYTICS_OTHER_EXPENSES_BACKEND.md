# Прочие расходы — контракт API

**Статус:** реализовано на бэке (`AnalyticsOtherExpense`, тесты 15/15). Фронт: `OtherExpensesModal`, `AnalyticsPage`.

---

## Бизнес-правила

| Действие | Поведение |
|----------|-----------|
| **Создать** | Статус `pending`, в P&L **не входит** |
| **Принять** | Статус `accepted`, сумма входит в **расходы месяца даты расхода** (не месяца создания) |
| **Отказать** | Запись **удаляется** (или soft-delete, в списке не показывается) |

**Расходы периода на дашборде:**

`period_expenses_total` = `purchase_total` + `other_expenses_total`

где `other_expenses_total` — сумма **принятых** прочих расходов с `date` в выбранном периоде (год/месяц/день).

**Маржа:** `revenue_total − period_expenses_total`

**Тренды:** в каждой точке `purchase_total` + `other_expenses_total` (принятые за этот день/месяц).

---

## 1. `GET /api/analytics/other-expenses/`

**Права:** `analytics`

**Query:** `year` (обяз.), `month?`, `day?`

**Response `200`:**

```json
{
  "items": [
    {
      "id": 1,
      "name": "Аренда офиса",
      "amount": "5000.00",
      "date": "2026-05-15",
      "status": "pending"
    },
    {
      "id": 2,
      "name": "Доставка",
      "amount": "1200.00",
      "date": "2026-05-10",
      "status": "accepted"
    }
  ]
}
```

| Поле | Описание |
|------|----------|
| `id` | int |
| `name` | string |
| `amount` | decimal string или number |
| `date` | `YYYY-MM-DD` — **дата расхода** (в какой месяц попадёт в P&L после принятия) |
| `status` | `pending` \| `accepted` (отклонённые не отдавать) |

Фильтр списка: по **дате расхода** `date` в границах query (как приход сырья).

---

## 2. `POST /api/analytics/other-expenses/`

**Body:**

```json
{
  "name": "Ремонт",
  "amount": "3500",
  "date": "2026-05-20"
}
```

**Response `201`:** созданная запись, `status: "pending"`.

**Валидация:** `name` не пусто, `amount` > 0, `date` валидная.

---

## 3. `POST /api/analytics/other-expenses/{id}/accept/`

- Статус → `accepted`
- Сумма учитывается в `summary.cards.other_expenses_total` и `trends[].other_expenses_total` для **месяца/дня поля `date`**
- WebSocket / realtime: событие `other_expense` (фронт перезапрашивает summary)

**Response `200`:** обновлённая запись.

**Ошибки:** `404`, `409` если уже accepted.

---

## 4. `POST /api/analytics/other-expenses/{id}/reject/`

- Запись **удалить** из БД (или не возвращать в GET)
- В расходы **не** попадает

**Response `204` или `200` с `{ "deleted": true }`**

---

## 5. Изменения в `GET /api/analytics/summary/`

### `cards` — добавить:

```json
{
  "purchase_total": "26291",
  "other_expenses_total": "2200",
  "period_expenses_total": "28491",
  "operating_expenses_total": "28491"
}
```

`period_expenses_total` = `purchase_total` + `other_expenses_total` (только **accepted**, по `date`).

### `trends[]` — добавить в каждую точку:

```json
{
  "period": "2026-05",
  "revenue": 65051,
  "purchase_total": 26291,
  "other_expenses_total": 2200
}
```

Фронт: маржа = `revenue − (purchase_total + other_expenses_total)` или `revenue − period_expenses_total`.

---

## 6. Модель (рекомендация)

`OtherExpense` / `AnalyticsMiscExpense`:

- `name`, `amount`, `date`, `status` (`pending` / `accepted`)
- `created_at`, `created_by` (опционально)
- при reject — delete

Индекс по `date`, `status`.

---

## 7. Тесты

1. POST → pending, не в `other_expenses_total` summary за месяц даты
2. accept → в summary за май, если `date` в мае
3. accept май, фильтр апрель → не в апреле
4. reject → нет в GET, не в summary
5. trends: точка месяца с `other_expenses_total`
6. `period_expenses_total` = purchase + other
7. Права `analytics`

---

## 8. Чеклист

- [x] CRUD + accept/reject эндпоинты
- [x] `other_expenses_total` в summary и trends
- [x] `period_expenses_total` включает прочие (accepted)
- [x] Realtime `other_expense`
- [x] Тесты
