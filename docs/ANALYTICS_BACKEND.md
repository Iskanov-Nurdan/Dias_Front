# Аналитика — контракт API (синхрон с бэкендом)

**Статус:** реализовано (`apps.analytics.tests.test_analytics_api`).

Фронт: `src/features/analytics/components/AnalyticsPage/AnalyticsPage.jsx`.

---

## `GET /api/analytics/summary/`

### Query

`year`, `month?`, `day?`, `date_from?`, `date_to?`, `line_id?`, `client_id?`, `trend_group=day|month`

### Response

| Блок | Поля |
|------|------|
| `cards` | `revenue_total`, `purchase_total`, **`period_expenses_total`** / **`operating_expenses_total`** (= **только** `purchase_total`), `sales_count`, `sold_units_total`, `client_debt_total`. См. **`docs/ANALYTICS_PNL_BACKEND_PROMPT.md`** |
| `trends[]` | `period`, `revenue`, `purchase_total`, `other_expenses_total` (или `period_expenses_total`). На графике «Динамика»: линии **выручка** и **расходы** (не маржа). |
| `sales_by_profile[]` | `profile_id`, `profile_name`, `sold_units`, `revenue` — топ 15, `sold_units` DESC |
| `otk_summary` | `accepted`, `defect`, `defect_percent` |
| `warehouse_summary` | `available`, `reserved` — срез **на сейчас**, шт. |
| `debt_as_of` | `current_outstanding_by_sale_date_in_period` |

**Не отдаётся:** `production_summary`, `production_by_line`, `sales_by_client`, лишние поля в `warehouse_summary`.

**P&L на фронте:** **выручка** = `revenue_total` (только продажи); **расходы** = `purchase_total` (приход сырья по дате прихода в периоде); **маржа** = выручка − расходы. `production_cost_total` в блок «Расходы» не входит. **Себестоимость товара** — отдельная кнопка в шапке «Финансы», `GET analytics/product-unit-costs/`.

### Долг (`client_debt_total`)

- В фильтр периода попадают продажи по `Sale.date` (без draft/canceled).
- Остаток долга — **на момент запроса** (активные платежи через `sale_payment_metrics`), не исторический срез на `date_to`.

---

## `GET /api/analytics/debt-details/`

Те же query, что у `summary/`.

```json
{
  "total_debt": "125000.00",
  "items": [
    {
      "client_id": 5,
      "client_name": "ООО Строй",
      "debt_amount": "80000.00",
      "sales_count": 3,
      "oldest_debt_date": "2026-04-10"
    }
  ]
}
```

`total_debt` = `cards.client_debt_total` при тех же query.

---

## Детализации (без изменения путей)

- `GET /api/analytics/revenue-details/`
- `GET /api/analytics/sales-cost-details/` — продажи за период (не модалка «Себестоимость товара»)
- `GET /api/analytics/product-unit-costs/` — справочник профилей и себестоимости за шт (**новый**, см. `ANALYTICS_PRODUCT_UNIT_COSTS_BACKEND.md`)
- `GET /api/analytics/profit-details/`

Те же query; продажи без draft/canceled.

---

## Прочее

- Пустой период → `200`, нули.
- Права: `access_key = analytics`.
- Тренды считаются в Python (не SQLite-агрегация).

---

## Расширение (опционально): упаковка за период в аналитике

**Проблема UX:** пользователь упаковал ГП на складе, но «Сводка» и «Продано по профилям» остаются нулями — потому что это не продажа.

**Решение:** добавить в `GET /api/analytics/summary/` объект **`packaging_summary`** (те же query по дате), чтобы на дашборде показывалась карточка «Упаковка за период».

### Поле `packaging_summary` (опционально)

```json
"packaging_summary": {
  "packages_count": 5,
  "pieces_total": 30,
  "weight_kg_total": 73.5
}
```

- **Фильтр даты:** дата события упаковки (как в модалке склада «Дата упаковки»), в границах `year`/`month`/`day` или `date_from`…`date_to`.
- **Согласованность:** те же `line_id`, `client_id`, если применимо к партиям/профилю.
- Альтернатива: отдельный `GET /api/analytics/packaging-details/` с `items[]` (дата, тип упаковки, шт, кг, profile_id, batch_id) — фронт пока не вызывает, достаточно summary для KPI.

Фронт уже отображает карточку, если в ответе есть ненулевые поля.
