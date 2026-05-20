# Промпт для бэкенда: аналитика «Финансы» и «Динамика»

Фронт готов (`AnalyticsPage.jsx`). Нужно, чтобы API совпадало с бизнес-правилами ниже.

---

## Бизнес-правила (финальные)

| Показатель | Что считать | Дата |
|------------|-------------|------|
| **Выручка** | Только **продажи** (без draft/canceled) | `Sale.date` в выбранном периоде |
| **Расходы** | **Приход сырья** + **принятые прочие расходы** | Сырьё — дата прихода; прочие — дата расхода (см. `ANALYTICS_OTHER_EXPENSES_BACKEND.md`) |
| **Маржа** | `выручка − расходы` | — |
| **Затраты производства** | **Не показываем** в P&L и не включаем в расходы UI | — |
| **Себестоимость товара** | Справочник: профиль → цена **1 шт сейчас** | Период **не** влияет |

Фронт **сам** считает маржу: не полагается на `profit` / `profit_total` в карточках и трендах.

---

## 1. `GET /api/analytics/summary/`

**Права:** `access_key = analytics`

**Query:** `year`, `month?`, `day?`, `date_from?`, `date_to?`, `line_id?`, `client_id?`, `trend_group=day|month`

### `cards` (обязательно)

```json
{
  "cards": {
    "revenue_total": "65051.00",
    "purchase_total": "26291.00",
    "period_expenses_total": "26291.00",
    "operating_expenses_total": "26291.00",
    "sales_count": 12,
    "sold_units_total": 500,
    "client_debt_total": "0.00"
  }
}
```

| Поле | Правило |
|------|---------|
| `revenue_total` | Сумма продаж за период |
| `purchase_total` | Сумма приходов сырья за период (**по дате прихода**) |
| `period_expenses_total` | **= `purchase_total`** (без `production_cost_total`) |
| `operating_expenses_total` | **= `purchase_total`** (то же) |
| `production_cost_total` | Можно отдавать для других отчётов, **фронт в «Расходы» не использует** |
| `sales_cost_total` | Опционально (legacy), **не в расходы UI** |
| `profit_total` | Опционально, **фронт для маржи не использует** |

**Проверка:** при выручке 65 051 и приходе 26 291 → `period_expenses_total` = 26 291 (не 65 051 и не выручка).

### `trends[]` (критично для графика «Динамика»)

В **каждой** точке периода (день или месяц) — **и выручка, и приход сырья** за **этот же** интервал:

```json
{
  "trends": [
    {
      "period": "2026-05",
      "revenue": "65051.00",
      "purchase_total": "26291.00"
    }
  ]
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `period` | да | `YYYY-MM-DD` или `YYYY-MM` (как сейчас) |
| `revenue` | да | Продажи за этот день/месяц |
| `purchase_total` | **да** | Приход сырья за этот день/месяц |

**Алиасы, которые понимает фронт:** `purchase_total`, `purchase`, `expenses`, `period_expenses_total`, `period_expenses`.

**Не использовать для графика:** `trends[].profit` — фронт игнорирует. Маржа на UI: `revenue − purchase_total`.

**Баг сейчас:** если в тренде только `revenue` и `profit = revenue` — линия «маржи» совпадает с выручкой. Нужен **`purchase_total` по каждому `period`**.

**Согласованность:** сумма `trends[].purchase_total` за месяц ≈ `cards.purchase_total` при тех же query (допуск на округление).

### Остальные блоки `summary/` (без изменений логики UI)

- `sales_by_profile[]` — `profile_id`, `profile_name`, `sold_units`, `revenue`
- `otk_summary` — `accepted`, `defect`, `defect_percent`
- `warehouse_summary` — `available`, `reserved` (срез на сейчас)
- `debt_as_of`, `client_debt_total` — как сейчас
- `packaging_summary` — опционально

---

## 2. `GET /api/analytics/product-unit-costs/` (уже есть — не ломать)

Справочник, период в query **игнорируется**.

```json
{
  "items": [
    {
      "profile_id": 1,
      "profile_name": "Профиль 60",
      "product_name": null,
      "code": "P-60",
      "is_active": true,
      "unit_cost_per_piece": "125.5"
    }
  ]
}
```

Себестоимость 1 шт: последняя `ProductionBatch` → иначе средневзвешенная по складу → иначе `null`.  
Алиасы в строке: `unit_cost_per_piece`, `cost_per_piece`, `material_cost_per_piece`, `current_unit_cost`, `unit_cost`.

---

## 3. Детализации (пути без переименования)

| Эндпоинт | Для чего на UI |
|----------|----------------|
| `GET /api/analytics/revenue-details/` | Кнопка «Детали» у **Выручки** |
| `GET /api/analytics/purchase-details/` | Кнопка «Детали» у **Расходов** (список приходов сырья за период, **дата = дата прихода**) |
| `GET /api/analytics/product-unit-costs/` | Кнопка «Себестоимость товара» в шапке «Финансы» |

**Не в UI расходов:** `production-cost-details/`, `sales-cost-details/` (можно оставить в API).

**Query** у детализаций — те же, что у `summary/`.

---

## 4. Что убрать / не смешивать

- ❌ `production_cost_total` в `period_expenses_total` / `operating_expenses_total`
- ❌ `sales_cost_total` в расходы периода на дашборде
- ❌ `trends[].profit` как замена маржи без `purchase_total`
- ❌ Привязка расходов к дате продажи — только **дата прихода сырья**

---

## 5. Тесты (добавить/обновить)

1. `summary` за май: `revenue_total` только из продаж; `purchase_total` только из приходов с датой в мае.
2. `period_expenses_total === purchase_total` (производство не входит).
3. `trends` за месяц с продажами и приходом: в точке `revenue` и `purchase_total`; фронт-маржа = разница.
4. Приход в марте, продажа в апреле: в марте `purchase_total > 0`, `revenue` может быть 0; в апреле наоборот.
5. `product-unit-costs`: 2 профиля — разные `unit_cost_per_piece`.
6. Пустой период → `200`, нули, `trends: []` или нулевые точки.

---

## 6. Чеклист готовности

- [ ] `cards.purchase_total` по дате прихода
- [ ] `cards.period_expenses_total` = `purchase_total`
- [ ] `trends[].purchase_total` на каждой точке
- [ ] Сумма трендов ≈ `cards` за тот же фильтр
- [ ] `product-unit-costs/` работает
- [ ] `purchase-details/` с датами прихода
- [ ] Тесты зелёные

---

## Пример полного фрагмента `summary` для фронта

```json
{
  "cards": {
    "revenue_total": "65051.00",
    "purchase_total": "26291.00",
    "period_expenses_total": "26291.00",
    "operating_expenses_total": "26291.00"
  },
  "trends": [
    {
      "period": "2026-05",
      "revenue": "65051.00",
      "purchase_total": "26291.00"
    }
  ]
}
```

Ожидание на UI: **Маржа** = 38 760; на графике «Динамика» зелёная выручка 65 051, синяя маржа 38 760.
