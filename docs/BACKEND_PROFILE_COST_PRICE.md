# Backend: себестоимость профиля (read-only)

Дополнение к `BACKEND_OTK_SIMPLIFICATION.md`. Фронт не отправляет `cost_price` — только читает.

---

## Требование

**`cost_price` (себестоимость за 1 шт)** — поле **только для чтения** с API.

---

## Что сделать

### 1. Serializer PlasticProfile

- `cost_price` — **read_only** в GET (list + detail).
- POST/PATCH — **игнорировать** `cost_price` из тела (или 400).
- Если не рассчитана — отдавать **`null`**, не `0`.

### 2. Автоматический расчёт

После учёта в ОТК, когда известна себестоимость заготовки:

```
cost_price = blank_cost_per_kg × weight_kg_per_piece
```

**Когда:** при `POST workshop/otk-blanks/{id}/account/` для каждой line обновить профиль.

### 3. Пример ответа

```json
{
  "cost_price": "125.50",
  "markup_amount": "30.00"
}
```

До первого учёта: `"cost_price": null`

### 4. Наценка и итоговая цена

- `markup_amount` — редактируется пользователем.
- % считает фронт: `markup / cost_price × 100`.
- Прочие расходы и `sale_unit_price` — см. `BACKEND_PLASTIC_PROFILE_BLANK_EXPENSES.md`:

```text
sale_unit_price = cost_price + other_expenses_total + markup_amount
```

---

## Тест

1. Создать профиль → `cost_price: null`
2. PATCH с `cost_price: 999` → не сохраняется
3. OTK account → `cost_price > 0` в GET
