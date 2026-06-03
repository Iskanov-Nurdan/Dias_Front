# Бэкенд: продажи без упаковки, цена из профиля, дата продажи

Фронт (`Dias_Front`) переведён на упрощённый сценарий. Нужны согласованные API.

## 1. Упаковка снята с продаж

- Не использовать `unit_type: packages`, `gp_package_id` в новых продажах.
- `POST /api/sales/` и `POST /api/sales/preview/`: только **штуки** (`unit_type: pieces` или поле опущено).
- `GET /api/sales/select-sources/`: отдавать партии/остатки **только в штуках** (как `warehouse/gp-stock/` — агрегат по профилю).
- Deprecated (410 или игнор): `available_gp_packages`, второй запрос с `unit_type=packages`.

## 2. Цена строки — не вводится кассиром

Цена за 1 шт на фронте:

```
unit_price = cost_price + markup_amount   // из plastic-profiles
line_total = quantity × unit_price
```

### Профиль (`plastic-profiles`)

Уже нужно (см. `BACKEND_PROFILE_COST_PRICE.md`):

- `cost_price` — read-only, > 0 после первого учёта ОТК
- `markup_amount` — редактируется в справочнике

### Продажа

**Вариант A (предпочтительно):** бэк сам считает цену:

```json
POST /api/sales/
{
  "client": 1,
  "sale_date": "2026-06-03",
  "sale_lines": [
    { "warehouse_batch": 12, "quantity": "9" }
  ],
  "payment_type": "full",
  "payment_method": "cash"
}
```

- `unit_price` в теле **опционален**; если передан — сверка с расчётом (допуск 0.01), иначе 400.
- Preview (`POST /api/sales/preview/`) — тот же расчёт.

**Вариант B:** фронт по-прежнему шлёт `unit_price` (уже считает из профиля); бэк валидирует равенство `cost + markup`.

### Select-sources

В каждой партии/строке остатка желательно:

```json
{
  "id": 12,
  "profile_id": 5,
  "product_name": "Пластиковый профиль 6 м премиум",
  "available_pieces": 9,
  "unit_sale_price": "129",
  "cost_price": "19",
  "markup_amount": "110"
}
```

Если `unit_sale_price` нет — фронт берёт профиль по `profile_id`.

## 3. Дата продажи

Принять в `POST /api/sales/` (и при необходимости в preview):

| Поле | Тип | Описание |
|------|-----|----------|
| `sale_date` | `YYYY-MM-DD` | Дата документа (не в будущем — по желанию) |

Альтернатива: `date`. Главное — задокументировать одно имя в OpenAPI.

Ответ списка продаж: `date` или `sale_date` для отображения.

## 4. Склад ГП

`GET /api/warehouse/gp-stock/` — остатки **по profile_id**, поле `pieces` (кг в UI склада не показываем).

Продажа списывает `pieces` с соответствующего остатка/партии.

## 5. Проверки при создании продажи

- `quantity` ≤ доступных шт
- У профиля есть `cost_price > 0` и задана `markup_amount` (или 0)
- Итог = Σ(qty × unit_price)
- Оплата: `payment_type`, `payment_method`, `paid_amount` — без изменений
- **Смешанная оплата:** `payment_splits` (cash + card), `payment_reference` (карта/телефон). См. **`BACKEND_SALES_CHECKOUT_PROMPT.md`** — готовый промпт для бэкенда.

## 6. Миграция

- Старые продажи с упаковками — только чтение в истории.
- Новые — только pieces.

## 7. Чеклист для бэкенда

- [ ] `sale_date` в create/preview
- [ ] Авто `unit_price` из профиля (или жёсткая валидация)
- [ ] Select-sources: `profile_id`, `available_pieces`, опционально `unit_sale_price`
- [ ] Убрать/deprecated упаковки в sales API
- [ ] Preview без ручной цены
