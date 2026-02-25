# Лиды + Воронка — спецификация для бэкенда

---

## 1. Расширение модели Lead

Добавить поля к существующей модели:

| Поле | Тип | Описание |
|------|-----|----------|
| `source` | string, nullable | Источник: `target`, `reels`, `stories`, `direct`, `post` |
| `target_type` | string, nullable | Тип клиента: `adult`, `children` |
| `sport_id` | FK → Sport, nullable | Вид спорта |
| `trainer_id` | FK → Trainer, nullable | Тренер |
| `trial_status` | string, nullable | Пробная: `came`, `rescheduled`, `no_contact`, `rejected` |
| `result_status` | string, nullable | Результат: `bought`, `thinking`, `rejected` |
| `amount` | decimal, nullable | Сумма |
| `comment` | text, nullable | Комментарии и возражения |
| `stage_id` | FK → FunnelStage, nullable | Текущий этап воронки |
| `created_at` | datetime | Дата создания (авто) |

В ответах API возвращать camelCase: `source`, `targetType`, `sportId`, `trainerId`, `trialStatus`, `resultStatus`, `stageId`, `createdAt`.

> **Убрать:** поле `pre_trial_status` / `preTrialStatus` больше не используется.

---

## 2. Новая модель FunnelStage (Этап воронки)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | ID |
| `name` | string | Название этапа |
| `order` | number | Порядок (для сортировки) |

---

## 3. Обновлённые эндпоинты лидов

### PATCH /api/leads/:id/

Принимает дополнительно к существующим полям:
```json
{
  "source": "reels",
  "targetType": "adult",
  "sportId": 3,
  "trainerId": 7,
  "trialStatus": "came",
  "resultStatus": "bought",
  "amount": 5000,
  "comment": "Клиент хочет скидку",
  "stageId": 2
}
```

- `stageId: null` — убрать из воронки
- Если `status` меняется на `accepted` и передан `stageId` — поставить этот этап
- Если `status` = `accepted`/`rejected` уже стоит → 409 Conflict (как раньше), **кроме** полей карточки (source, targetType, sport, trainer, trialStatus, resultStatus, amount, comment, stageId) — **их редактировать разрешить даже после принятия**

> **Важно:** блокировать только смену `status` и удаление. Остальные поля карточки всегда редактируемы.

### GET /api/leads/

Query-параметры:
- `stageId` — фильтр по этапу воронки
- `search` — **поиск** (обязательно!)

**Требования к поиску `search`:** см. общий файл `BACKEND_SEARCH_SPEC.md`. Кратко: без учёта регистра (`icontains`), по полям `name`, `phone`, `channel`.

---

## 4. Новые эндпоинты: Этапы воронки

**GET /api/leads/funnel-stages/**
Ответ: массив этапов, отсортированных по `order`:
```json
[
  { "id": 1, "name": "Лид квалифицирован", "order": 1 },
  { "id": 2, "name": "Запись на пробную", "order": 2 }
]
```

**POST /api/leads/funnel-stages/**
Body: `{ "name": "Название" }`
`order` назначать автоматически (последний + 1).

**PATCH /api/leads/funnel-stages/:id/**
Body: `{ "name": "Новое название" }`

**DELETE /api/leads/funnel-stages/:id/**
При удалении этапа — обнулить `stage_id` у всех лидов этого этапа (не удалять лидов).

---

## 5. Логика «Принять» на фронте

Когда менеджер нажимает «Принять»:
1. Фронт загружает список этапов → берёт первый (минимальный `order`)
2. Отправляет `PATCH /api/leads/:id/` с `{ "status": "accepted", "stageId": <id первого этапа> }`
3. Лид попадает в колонку первого этапа воронки

Если этапов нет — отправляет просто `{ "status": "accepted" }` без `stageId`.

---

## 6. Миграция

```
python manage.py makemigrations leads
python manage.py migrate
```
