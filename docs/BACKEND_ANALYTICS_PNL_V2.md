# Backend: аналитика P&L v2 — себестоимость продаж и прочие расходы товара

Дополнение к `ANALYTICS_PNL_BACKEND_PROMPT.md`, `BACKEND_PLASTIC_PROFILE_BLANK_EXPENSES.md`.

Фронт готов (`AnalyticsPage.jsx`). Нужны поля в `summary/` и новая детализация.

---

## Термины (не путать)

| Термин | Что это |
|--------|---------|
| **Прочие расходы** | Общие расходы компании (`analytics/other-expenses/`, accepted) — аренда, связь и т.д. |
| **Прочие расходы товара** | Поля профиля `extra_rubber`, `extra_label`, `extra_labor`, `extra_electricity`, `extra_repair` × **проданные шт** |
| **Себестоимость продаж** | `cost_price` профиля на момент продажи × **проданные шт** |
| **На проданный товар** | `sales_cost_total + product_other_expenses_total` (без сырья и общих прочих) |

---

## Формулы

```text
sold_goods_cost_total = sales_cost_total + product_other_expenses_total

period_expenses_total =
  purchase_total
  + other_expenses_total
  + sales_cost_total
  + product_other_expenses_total

profit_total = revenue_total − period_expenses_total
```

Фронт **сам** считает прибыль, если бэк отдаёт компоненты. `profit_total` в cards — опционально.

---

## 1. `GET /api/analytics/summary/` — дополнить `cards`

```json
{
  "cards": {
    "revenue_total": "453.00",
    "purchase_total": "107305.00",
    "other_expenses_total": "1950.00",
    "sales_cost_total": "820.00",
    "product_other_expenses_total": "156.00",
    "sold_goods_cost_total": "976.00",
    "period_expenses_total": "110231.00",
    "profit_total": "-109778.00",
    "sales_count": 4,
    "sold_units_total": 33
  }
}
```

| Поле | Правило |
|------|---------|
| `revenue_total` | Продажи за период (`Sale.date`) |
| `purchase_total` | Приход сырья по **дате прихода** |
| `other_expenses_total` | Принятые **общие** прочие по дате расхода |
| `sales_cost_total` | Σ по строкам продаж: `quantity × cost_price_at_sale` |
| `product_other_expenses_total` | Σ по строкам продаж: `quantity × other_expenses_per_piece` |
| `other_expenses_per_piece` | `extra_rubber + extra_label + extra_labor + extra_electricity + extra_repair` профиля |
| `sold_goods_cost_total` | `sales_cost_total + product_other_expenses_total` |
| `period_expenses_total` | Сумма четырёх статей расходов |

### `trends[]` — на каждую точку

```json
{
  "period": "2026-06",
  "revenue": "453.00",
  "purchase_total": "107305.00",
  "other_expenses_total": "1950.00",
  "sales_cost_total": "820.00",
  "product_other_expenses_total": "156.00",
  "period_expenses_total": "110231.00"
}
```

---

## 2. `GET /api/analytics/sales-cost-details/`

Уже есть — расширить/проверить ответ:

```json
{
  "total_sales_cost": "820.00",
  "items": [
    {
      "date": "2026-06-02",
      "sale_id": 101,
      "profile_id": 3,
      "profile_name": "Профиль белый",
      "product_name": null,
      "quantity": 10,
      "cost_per_unit": "62.00",
      "total_cost": "620.00"
    }
  ]
}
```

- Фильтр: те же query, что у `summary/`
- `cost_per_unit` — `cost_price` профиля на дату продажи (snapshot или текущий)

---

## 3. `GET /api/analytics/product-other-expenses-details/` (новый)

Прочие расходы **товара** по продажам за период.

```json
{
  "total_product_other_expenses": "156.00",
  "items": [
    {
      "date": "2026-06-02",
      "sale_id": 101,
      "profile_id": 3,
      "profile_name": "Профиль белый",
      "quantity": 10,
      "unit_other_expenses": "15.60",
      "other_per_unit": "15.60",
      "total_other_expenses": "156.00",
      "breakdown": {
        "extra_rubber": "5.00",
        "extra_label": "2.00",
        "extra_labor": "5.00",
        "extra_electricity": "2.00",
        "extra_repair": "1.60"
      }
    }
  ]
}
```

`unit_other_expenses` = сумма `extra_*` профиля на 1 шт (read-only поле `other_expenses_total` из профиля).

---

## 4. `GET /api/analytics/profit-details/` (опционально)

Можно отдавать построчно по продажам:

```json
{
  "totals": {
    "revenue": "453.00",
    "purchase_total": "107305.00",
    "other_expenses_total": "1950.00",
    "sales_cost_total": "820.00",
    "product_other_expenses_total": "156.00",
    "period_expenses_total": "110231.00",
    "profit": "-109778.00"
  },
  "items": []
}
```

Фронт для модалки «Прибыль» использует в первую очередь `cards` из `summary/` + опционально `items[]`.

---

## 5. Snapshot при продаже (рекомендуется)

Чтобы аналитика не «плыла» после изменения профиля:

- В `SaleLine` сохранять: `unit_cost_price`, `unit_other_expenses`, `unit_sale_price`
- Аналитика считает по snapshot, не по текущему профилю

---

## 6. Чеклист

- [ ] `cards.sales_cost_total`, `product_other_expenses_total`, `sold_goods_cost_total`
- [ ] `period_expenses_total` = 4 компонента
- [ ] `trends[]` с теми же полями
- [ ] `GET product-other-expenses-details/`
- [ ] `sales-cost-details/` по продажам периода
- [ ] Не смешивать `other_expenses_total` (общие) и `product_other_expenses_total` (профиль)
- [ ] Тесты: продажа 10 шт → sales_cost и product_other = 10 × unit

---

## Пример UI

| Показатель | Значение |
|------------|----------|
| Выручка | 453 |
| Расходы (итого) | 110 231 |
| — Приход сырья | 107 305 |
| — Прочие расходы | 1 950 |
| — Себестоимость продаж | 820 |
| — Прочие расходы товара | 156 |
| На проданный товар | 976 |
| **Прибыль** | **−109 778** |
