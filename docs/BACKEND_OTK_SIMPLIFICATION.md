# Backend: упрощение производства, ОТК, склада (промпт для бэкенда)

Документ для реализации API под обновлённый фронт (`Dias_Front`).  
Цель: убрать заявки, упаковку, отдельную приёмку на складе; ОТК — единая точка учёта профилей и брака.

---

## 1. Общий поток

```
Профиль (plastic-profiles): вес шт, себестоимость, наценка
    ↓
POST workshop/blank-production-runs/  — только blank_id (без product_id)
    ↓
Пул ОТК по заготовке (кг суммируются)
    ↓
POST workshop/otk-account/  — учёт v2 (см. BACKEND_OTK_ACCOUNT_V2.md)
POST workshop/otk-blanks/{blank_id}/account/  — deprecated
    ↓
Склад ГП (шт/кг) — сразу, без accept-gp и без упаковки
```

---

## 2. Plastic Profile (`plastic-profiles/`)

### Новые поля модели

| Поле | Тип | Описание |
|------|-----|----------|
| `cost_price` | Decimal | Себестоимость за 1 шт, сом |
| `markup_amount` | Decimal | Наценка за 1 шт, сом (% считает фронт: `markup / cost * 100`) |

### API

- `GET/POST/PATCH plastic-profiles/` — отдавать и принимать `cost_price`, `markup_amount`.
- `weight_kg_per_piece` — без изменений (кг + граммы на фронте).

---

## 3. Производство — выпуск заготовки

### `POST workshop/blank-production-runs/`

**Убрать обязательность:** `product_id`, `weight_kg_per_piece`.

**Тело запроса (новое):**

```json
{
  "blank_id": 12,
  "blank_total_kg": 100,
  "blank_used_in_production_kg": 100,
  "vat_max_kg_demo": 180
}
```

**Поведение:**

1. Списать `blank_used_in_production_kg` из `workshop/prepared-blanks/` (как сейчас).
2. **Увеличить пул ОТК** для `blank_id` на `blank_used_in_production_kg`.
3. Создать запись **intake** (история прихода) — см. §4.
4. WebSocket: топик `otk` / `workshop`.

**Удалить / deprecated:**

- Привязку выпуска к одному `product_id`.
- `POST production/requests/{id}/start/` — модуль заявок снимается с фронта.

---

## 4. ОТК — пул по заготовке

### Модель `OtkBlankPool` (или аналог)

| Поле | Тип |
|------|-----|
| `blank_id` | FK WorkshopBlank |
| `remaining_kg` | Decimal — доступно для учёта |
| `total_intake_kg` | Decimal — сумма всех приходов (опционально, для отчётов) |

**Правила:**

- Одна строка на `blank_id`.
- Каждый `POST blank-production-runs/` → `remaining_kg += blank_used_in_production_kg`.
- Каждый учёт → `remaining_kg -= consumed_kg` (профили + брак в кг).
- `can_account = remaining_kg >= 0.001` — фронт скрывает «Учесть» при 0.
- Брак в **кг** тоже списывается из пула; возврат массы брака — в `prepared-blanks` (цех).

### Модель `OtkBlankIntake` (история)

| Поле | Тип |
|------|-----|
| `id` | PK |
| `blank_id` | FK |
| `run_id` | FK BlankProductionRun, nullable |
| `kg` | Decimal |
| `created_at` | datetime |

---

## 5. API ОТК (новые эндпоинты)

### `GET /api/workshop/otk-blanks/`

Список пулов с остатком > 0 (или все, фронт фильтрует).

**Ответ (элемент):**

```json
{
  "blank_id": 12,
  "blank_name": "ПВХ белая смесь",
  "remaining_kg": "220.000",
  "total_intake_kg": "320.000",
  "can_account": true,
  "last_intake_at": "2026-06-02T11:52:00Z"
}
```

Пагинация: `{ items, meta, links }` или DRF `{ results, count }` — как в проекте.

---

### `GET /api/workshop/otk-blanks/intakes/`

История каждого «Произвести».

**Query:** `blank_id`, `date_from`, `date_to`, `ordering=-created_at`.

**Ответ (элемент):**

```json
{
  "id": 501,
  "blank_id": 12,
  "blank_name": "ПВХ белая смесь",
  "kg": "100.000",
  "run_id": 88,
  "created_at": "2026-06-02T10:00:00Z",
  "source": "produce"
}
```

---

### `POST /api/workshop/otk-blanks/{blank_id}/account/`

**Учёт: фактическая приёмка + брак + склад.**

**Тело:**

```json
{
  "lines": [
    { "profile_id": 3, "pieces": 13 },
    { "profile_id": 7, "pieces": 5 }
  ],
  "defect": {
    "unit": "kg",
    "value": "10.5"
  },
  "operator_id": 4,
  "chemist_id": 5,
  "packer_id": 6,
  "comment": ""
}
```

**Брак в штуках:**

```json
"defect": {
  "unit": "pieces",
  "value": "2",
  "profile_id": 3
}
```

Пересчёт: `defect_kg = pieces * profile.weight_kg_per_piece`.

**Валидация:**

```text
consumed_kg = Σ(lines.pieces × weight_kg_per_piece) + defect_kg
consumed_kg <= pool.remaining_kg  (+ epsilon)
lines.pieces > 0, profile активен
profile.blank_id == blank_id пула (см. BACKEND_PLASTIC_PROFILE_BLANK_EXPENSES.md)
```

**Транзакция (атомарно):**

1. `pool.remaining_kg -= consumed_kg`
2. Для каждой line: **увеличить склад ГП** (`warehouse/gp-stock`) на `pieces` и `pieces × weight`
3. Брак: `defect_kg` → **вернуть в prepared-blanks** (или отдельное поле `from_defect_kg`)
4. Создать `OtkAccountSession` + `OtkAccountLine`
5. Запись в `warehouse/operations/` kind=`otk_account`
6. WS: `warehouse`, `otk`

**Ответ 201:**

```json
{
  "id": 900,
  "blank_id": 12,
  "consumed_kg": "84.500",
  "defect_kg": "10.500",
  "remaining_kg_after": "125.000",
  "warehouse_posted": true,
  "lines": [
    { "profile_id": 3, "profile_name": "...", "pieces": 13, "kg": "22.100" }
  ],
  "operator_id": 4,
  "chemist_id": 5,
  "packer_id": 6,
  "created_at": "..."
}
```

---

### `GET /api/workshop/otk-accounting/`

Журнал учётов ОТК (вкладка «История» → блок «Учёты ОТК»).

**Ответ (элемент):** как `OtkAccountSession` выше + имена сотрудников.

---

## 6. Склад ГП

### `GET /api/warehouse/gp-stock/`

Остатки **только в штуках** (агрегация по `profile_id` + опционально `blank_id`).

```json
{
  "items": [
    {
      "product_id": 3,
      "product_name": "Пластиковый профиль белый",
      "blank_id": 12,
      "blank_name": "ПВХ белая смесь",
      "pieces": 130,
      "kg": "221.000"
    }
  ]
}
```

### Удалить / deprecated на фронте

- `POST workshop/blank-production-runs/{id}/accept-gp/` — приёмка перенесена в ОТК
- `POST warehouse/gp-packages/` — упаковка
- `GET warehouse/gp-unpacked-balance/` — неупакованное
- Вкладки «К приёмке», «Не упаковано», «Упаковано»

### `GET warehouse/operations/`

Добавить kind `otk_account` с полями `product_name`, `pieces`, `kg`, `blank_name`.

---

## 7. Заявки (Orders) — снять с API

Фронт убрал `/cash/orders`. Рекомендации:

- `orders/`, `production/requests/` → deprecated или 410
- Продажи `POST sales/` — **не требовать** `order`, `order_line`, `order_paid_amount_applied`
- `unit_type` только `pieces` (упаковки deprecated)

---

## 8. Миграция данных

1. Активные `blank-production-runs` без учёта → перенести `blank_used_in_production_kg` в `OtkBlankPool.remaining_kg`.
2. Уже принятые на склад (`gp_accepted_at`) → строки в `gp-stock`.
3. Legacy `otk-defect` по run → по возможности свернуть в первый `account` или закрыть run.

---

## 9. WebSocket

События после изменений:

| Событие | Топик |
|---------|--------|
| produce | `workshop`, `otk`, `production` |
| otk account | `otk`, `warehouse`, `workshop` (возврат брака) |

---

## 10. Ошибки (примеры)

| Код | Когда |
|-----|--------|
| 400 | `consumed_kg > remaining_kg` |
| 400 | нет `weight_kg_per_piece` у профиля |
| 404 | `blank_id` не в пуле |
| 409 | параллельный учёт (optimistic lock на pool) |

---

## 11. Чеклист для бэкенд-разработчика

- [ ] Поля `cost_price`, `markup_amount` на PlasticProfile
- [ ] Produce без `product_id`
- [ ] `OtkBlankPool` + intake history
- [ ] `POST otk-blanks/{id}/account/`
- [ ] `GET otk-blanks/`, `GET otk-blanks/intakes/`, `GET otk-accounting/`
- [ ] `GET warehouse/gp-stock/`
- [ ] Списание/начисление prepared-blanks при produce/account/defect
- [ ] Deprecated: accept-gp, gp-packages, orders, production/requests
- [ ] WS нотификации

---

*Фронт синхронизирован с бэкендом: прямые вызовы `workshop/otk-blanks/*`, `warehouse/gp-stock/` без legacy-fallback.*
