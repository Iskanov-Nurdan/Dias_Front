# Backend: товар (профиль) — заготовка, прочие расходы, цена

Дополнение к `BACKEND_PROFILE_COST_PRICE.md` и `BACKEND_OTK_SIMPLIFICATION.md`.

Фронт уже шлёт поля ниже. Бэкенд должен сохранить, отдавать в GET и использовать в ОТК/продажах.

---

## 1. Модель `PlasticProfile`

### Новые поля (редактируемые)

| Поле API | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `blank_id` | FK → `WorkshopBlank` | **обязательно** на POST | Заготовка, из которой списывается кг в ОТК |
| `extra_rubber` | Decimal(12,2) | 0 | Резинка, сом/шт |
| `extra_label` | Decimal(12,2) | 0 | Этикетка |
| `extra_labor` | Decimal(12,2) | 0 | Рабочая сила |
| `extra_electricity` | Decimal(12,2) | 0 | Свет |
| `extra_repair` | Decimal(12,2) | 0 | Ремонт |

### Read-only (как `cost_price`)

| Поле API | Формула |
|----------|---------|
| `blank_name` | `blank.name` (в list/detail) |
| `other_expenses_total` | `extra_rubber + extra_label + extra_labor + extra_electricity + extra_repair` |
| `sale_unit_price` | `cost_price + other_expenses_total + markup_amount` (если `cost_price` null → null) |

Существующие поля без изменений:

- `cost_price` — read-only, см. `BACKEND_PROFILE_COST_PRICE.md`
- `markup_amount` — редактируется пользователем
- `weight_kg_per_piece` — вес 1 шт

---

## 2. Эндпоинты `plastic-profiles/`

### `GET /api/plastic-profiles/` и `GET /api/plastic-profiles/{id}/`

Пример элемента:

```json
{
  "id": 3,
  "name": "Профиль белый 6м",
  "code": "GP...",
  "is_active": true,
  "weight_kg_per_piece": "0.017",
  "blank_id": 12,
  "blank_name": "ПВХ белая смесь",
  "cost_price": "125.50",
  "markup_amount": "30.00",
  "extra_rubber": "5.00",
  "extra_label": "2.00",
  "extra_labor": "15.00",
  "extra_electricity": "3.00",
  "extra_repair": "1.00",
  "other_expenses_total": "26.00",
  "sale_unit_price": "181.50"
}
```

До первого учёта в ОТК: `"cost_price": null`, `"sale_unit_price": null`.

### `POST /api/plastic-profiles/`

```json
{
  "name": "Профиль белый 6м",
  "code": "GP...",
  "is_active": true,
  "weight_kg_per_piece": 0.017,
  "blank_id": 12,
  "markup_amount": 30,
  "extra_rubber": 5,
  "extra_label": 2,
  "extra_labor": 15,
  "extra_electricity": 3,
  "extra_repair": 1,
  "comment": ""
}
```

**Валидация:**

- `blank_id` — обязателен, существующая активная заготовка
- все `extra_*` ≥ 0
- `cost_price`, `other_expenses_total`, `sale_unit_price` в теле — **игнорировать** (или 400)

### `PATCH /api/plastic-profiles/{id}/`

Можно менять: `name`, `weight_kg_per_piece`, `blank_id`, `markup_amount`, все `extra_*`, `is_active`, `comment`.

`cost_price` — не принимать из PATCH.

---

## 3. ОТК — привязка профиля к заготовке

### `POST /api/workshop/otk-blanks/{blank_id}/account/`

Дополнительная валидация для каждой `lines[].profile_id`:

```text
profile.blank_id == blank_id из URL
profile.is_active == true
```

Иначе **400**:

```json
{
  "error": "Профиль не привязан к этой заготовке",
  "profile_id": 3,
  "expected_blank_id": 12
}
```

Списание кг из пула заготовки — без изменений (`pieces × weight_kg_per_piece`).

После учёта — пересчёт `cost_price` профиля (как в `BACKEND_PROFILE_COST_PRICE.md`).

---

## 4. Продажи / склад

- Цена за шт в продаже: **`sale_unit_price`** (не только `cost_price + markup_amount`).
- `GET warehouse/gp-stock/` — опционально `sale_unit_price` / `unit_sale_price` из профиля.
- Аналитика `product-unit-costs` — отдельно `cost_price`, `other_expenses_total`, `sale_unit_price`.

---

## 5. Миграция

1. Добавить `blank_id` (nullable → заполнить вручную/скриптом → NOT NULL).
2. Добавить `extra_*` с default 0.
3. Старые профили без `blank_id` — админ выбирает заготовку в UI.

---

## 6. WebSocket

После PATCH профиля: `plastic_profile`, `workshop`.

После OTK account: как в `BACKEND_OTK_SIMPLIFICATION.md` + обновление `cost_price` / `sale_unit_price`.

---

## 7. Чеклист

- [ ] `blank_id` + `blank_name` в serializer
- [ ] 5 полей `extra_*` + computed `other_expenses_total`, `sale_unit_price`
- [ ] POST/PATCH принимают поля; read-only поля не пишутся из клиента
- [ ] OTK account: `profile.blank_id == pool.blank_id`
- [ ] Продажи берут `sale_unit_price`
- [ ] Тест: создать товар с заготовкой → учёт в ОТК только этой заготовки → `cost_price` и `sale_unit_price` в GET
