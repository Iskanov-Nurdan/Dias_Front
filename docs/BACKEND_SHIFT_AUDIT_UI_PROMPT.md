# Журнал смены: контракт UI (бэк + фронт)

> **Бэкенд (DIas_ERP): реализовано** — `audit_messages.py`, `field_labels` в activity, `old_display`/`new_display`.
> **Фронт (Dias_Front):** `summary` как есть; детали — `field_labels` + display с API; `activityAuditUtils.js` — только fallback для старых строк.

---

## Фронт (актуально)

| Источник | Использование |
|----------|----------------|
| `summary` / `description` | Список «Действия за смену» — показываем как пришло |
| `field_labels` | Колонка «Что» в модалке деталей |
| `changes[].old_display` / `new_display` | Колонки «Было» / «Стало» |
| `activityAuditUtils.js` | Санитизация только если строка тех. (`POST /api/…`, `#id`) |

---

## Промпт для бэкенда (архив требований)

## 1. `description` / `summary` (список «Действия за смену»)

**Не писать:**
- `POST /api/shifts/open/`, `Смена #2: POST …`
- ISO-даты в скобках `(2026-05-25T16:23:00+03:00)`
- `sales.client #4`, `materials.materialbatch #12`

**Писать примеры:**
| Событие | summary |
|---------|---------|
| Открытие личной смены | `Открыта смена` |
| Закрытие | `Смена закрыта` |
| Приход сырья | `Приход: Дыма — 1 кг, 25.05.2026 16:23` |
| Клиент | `Создан клиент: Иванов` |
| Заметка | `Заметка к смене` |

Файл: `apps/production/views.py` → `_audit_shift_row` (сейчас `f'Смена #{shift.pk}: {endpoint}'`).

## 2. `payload.changes[]` для оператора

В каждой строке diff по возможности заполнять **`old_display` / `new_display`** (русские подписи FK, enum, даты).

Скрывать в diff для UI (или не включать в create-снимок):
- `created_at`, `updated_at` — служебные
- пустые `supplier_*`, пустой `comment`

Для FK `material` → `new_display: "Дыма"` (имя сырья), не id.

## 3. Справочник подписей полей (опционально)

В ответ activity добавить `field_labels: { "quantity_initial": "Начальное количество", ... }` по `entity_type` — фронт подхватит без дублирования.

## 4. Файлы для правки

| Файл | Что |
|------|-----|
| `apps/production/views.py` | `_audit_shift_row`, close/open |
| `apps/activity/audit_service.py` | шаблоны summary, `_fk_display`, `_enum_label` |
| `apps/activity/mixins.py` | `_activity_description` для incoming |
| `apps/materials/models.py` | `MaterialBatch.__str__` уже ок — использовать в description |

После правок бэка фронт в `activityAuditUtils.js` можно упростить, но текущая санитизация останется как fallback.
