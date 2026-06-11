# Backend: учёт ОТК v2 — единая форма, смена день/ночь, несколько упаковщиков

Дополнение к `BACKEND_OTK_SIMPLIFICATION.md`, `BACKEND_PLASTIC_PROFILE_BLANK_EXPENSES.md`.

Фронт вызывает **`POST /api/workshop/otk-account/`** (не привязан к одной заготовке в URL).

---

## 1. Новый эндпоинт

### `POST /api/workshop/otk-account/`

Один учёт может включать профили с **разными** `blank_id`. Кг списываются с пула заготовки **профиля**, не с «выбранной строки» в UI.

**Тело:**

```json
{
  "lines": [
    { "profile_id": 3, "pieces": 13 },
    { "profile_id": 7, "pieces": 5 }
  ],
  "defect_kg": "10.5",
  "defect_blank_id": 12,
  "shift_period": "day",
  "operator_id": 4,
  "chemist_id": 5,
  "packer_ids": [6, 8, 9],
  "comment": ""
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `lines` | да | `profile_id`, `pieces > 0` |
| `defect_kg` | нет | Брак **только в кг**. Пусто / 0 — без брака |
| `defect_blank_id` | если `defect_kg > 0` | С какой заготовки списать брак. По умолчанию — `blank_id` первой line |
| `shift_period` | да | `"day"` \| `"night"` |
| `operator_id` | нет | FK User |
| `chemist_id` | нет | FK User |
| `packer_ids` | нет | Массив FK User (0..N упаковщиков) |
| `comment` | нет | |

**Убрать из нового API:** `defect.unit = pieces`, одиночный `packer_id` (можно оставить read-only в GET для старых записей).

---

## 2. Логика списания

Для каждой line:

```text
line_kg = pieces × profile.weight_kg_per_piece
blank_id = profile.blank_id   // обязателен на профиле
```

Группировка по `blank_id`:

```text
consumed_by_blank[blank_id] = Σ line_kg для профилей этой заготовки
if defect_kg > 0:
  consumed_by_blank[defect_blank_id] += defect_kg
```

Валидация **по каждой** заготовке:

```text
consumed_by_blank[blank_id] <= otk_blank_pool[blank_id].remaining_kg
profile.blank_id задан и profile.is_active
```

Иначе **400** с деталями по `blank_id`.

**Транзакция (атомарно):**

1. Для каждого `blank_id`: `pool.remaining_kg -= consumed_by_blank[blank_id]`
2. Склад ГП: +pieces по каждой line
3. Брак `defect_kg` → prepared-blanks (цех), с `defect_blank_id`
4. `OtkAccountSession` (+ строки по заготовкам или одна сессия с `blank_allocations` — на усмотрение бэка)
5. `warehouse/operations/` kind=`otk_account`
6. Пересчёт `cost_price` профилей (см. `BACKEND_PROFILE_COST_PRICE.md`)
7. WS: `otk`, `warehouse`, `shift`

---

## 3. Смена день / ночь

При сохранении учёта бэкенд **привязывает сотрудников к смене** выбранного периода:

| `shift_period` | Смысл |
|----------------|--------|
| `day` | Дневная смена (текущая дата, период «день») |
| `night` | Ночная смена (текущая дата или предыдущий календарный день — по правилам цеха) |

**Сотрудники для привязки:** `operator_id`, `chemist_id`, все `packer_ids` (уникальные, не null).

**Рекомендуемая логика:**

1. Найти или создать **коллективную смену** `Shift` с полями:
   - `period`: `day` \| `night`
   - `date`: дата смены
   - `source`: `otk_account`
2. Для каждого user_id создать `ShiftParticipant` / `ShiftAssignment` или записать в `OtkAccountSession.staff_links`
3. Если у сотрудника уже открыта личная смена того же периода — связать учёт с ней

**Модель (пример):**

```python
class OtkAccountSession(models.Model):
    shift_period = models.CharField(max_length=8, choices=[('day','day'),('night','night')])
    operator = models.ForeignKey(User, null=True, ...)
    chemist = models.ForeignKey(User, null=True, ...)
    packers = models.ManyToManyField(User, related_name='otk_packer_accounts', blank=True)
    shift = models.ForeignKey('Shift', null=True, on_delete=models.SET_NULL)
```

---

## 4. Ответ `GET /api/workshop/otk-accounting/`

Дополнить элемент:

```json
{
  "id": 900,
  "blank_id": 12,
  "blank_name": "Подоконник состав",
  "consumed_kg": "84.500",
  "defect_kg": "10.500",
  "shift_period": "day",
  "operator_id": 4,
  "operator_name": "Иван",
  "chemist_id": 5,
  "chemist_name": "Пётр",
  "packer_ids": [6, 8],
  "packer_names": ["Анна", "Олег"],
  "lines": [...],
  "created_at": "..."
}
```

Для учётов с несколькими заготовками — варианты:

- **A)** несколько записей в журнале (по blank_id)
- **B)** одна запись + `blank_breakdown: [{ blank_id, consumed_kg }]`

Фронт сейчас показывает `blank_name` одной строки; для multi-blank лучше **B** или primary blank + breakdown.

---

## 5. Deprecated

`POST /api/workshop/otk-blanks/{blank_id}/account/` — оставить для совместимости или 410. Фронт использует только `workshop/otk-account/`.

---

## 6. Чеклист

- [ ] `POST workshop/otk-account/` с валидацией по `profile.blank_id`
- [ ] `defect_kg` optional, без unit=pieces
- [ ] `packer_ids[]`, `shift_period`
- [ ] Привязка сотрудников к смене day/night
- [ ] GET journal: `shift_period`, `packer_ids`, `packer_names`
- [ ] WS + тесты multi-blank и overage per blank
