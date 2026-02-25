# Аналитика лидов — спецификация для бэкенда

Документ описывает эндпоинт аналитики по заявкам и воронке лидов. Сейчас агрегация выполняется на фронте (загрузка до 2000 лидов + расчёт). Цель — перенести на бэк для масштабируемости.

---

## 1. Принцип: Вариант 1

**Подсчитываются только существующие (не удалённые) лиды.**

- При удалении лида он исключается из всех отчётов
- Фильтр по периоду: `created_at` лида попадает в выбранный год/месяц/день
- Без soft-delete: удалённые записи физически отсутствуют, дополнительная логика не нужна

---

## 2. Эндпоинт

**GET /api/analytics/leads/**

### Query-параметры

| Параметр | Тип   | Обязательный | Описание                                      |
|----------|-------|---------------|-----------------------------------------------|
| `year`   | number| да*           | Год фильтра. Без года — считать все лиды      |
| `month`  | number| нет           | Месяц (1–12). Без месяца — весь год           |
| `day`    | number| нет           | День (1–31). Без дня — весь месяц             |

\* Если `year` не передан, считать агрегаты по всем лидам за всё время.

### Фильтрация по периоду

- `year` — лиды где `EXTRACT(YEAR FROM created_at) = year`
- `year` + `month` — дополнительно `EXTRACT(MONTH FROM created_at) = month`
- `year` + `month` + `day` — дополнительно `EXTRACT(DAY FROM created_at) = day`

---

## 3. Формат ответа

```json
{
  "byStatus": {
    "total": 120,
    "accepted": 85,
    "rejected": 25,
    "pending": 10
  },
  "byChannel": [
    { "key": "instagram", "count": 45, "label": "Instagram" },
    { "key": "whatsapp", "count": 32, "label": "WhatsApp" },
    { "key": "tiktok", "count": 18, "label": "TikTok" },
    { "key": "other", "count": 25, "label": "Другое" }
  ],
  "byStage": [
    { "stageId": 1, "stageName": "Лид квалифицирован", "count": 30 },
    { "stageId": 2, "stageName": "Запись на пробную", "count": 25 }
  ],
  "byResult": [
    { "key": "bought", "count": 40, "label": "Купили" },
    { "key": "thinking", "count": 15, "label": "Ушли подумать" },
    { "key": "rejected", "count": 20, "label": "Отказались" },
    { "key": "none", "count": 10, "label": "Без результата" }
  ],
  "bySource": [
    { "key": "target", "count": 35, "label": "Реклама (таргет)" },
    { "key": "reels", "count": 28, "label": "Reels" },
    { "key": "direct", "count": 18, "label": "Direct" }
  ],
  "byTargetType": [
    { "key": "adult", "count": 70, "label": "Взрослый" },
    { "key": "children", "count": 35, "label": "Дети" },
    { "key": "none", "count": 15, "label": "Не указано" }
  ],
  "bySport": [
    { "sportId": 1, "sportName": "Бокс", "count": 45 },
    { "sportId": 2, "sportName": "Кикбоксинг", "count": 30 }
  ],
  "byTrainer": [
    { "trainerId": 5, "trainerName": "Иванов И.И.", "count": 22 },
    { "trainerId": 7, "trainerName": "Петров П.П.", "count": 18 }
  ],
  "byTrialStatus": [
    { "key": "came", "count": 50, "label": "Пришли" },
    { "key": "rescheduled", "count": 12, "label": "Перенесли" },
    { "key": "no_contact", "count": 8, "label": "Не вышли на связь" },
    { "key": "rejected", "count": 5, "label": "Отказались" }
  ]
}
```

---

## 4. Логика агрегатов

### 4.1 byStatus

- **total** — все лиды за период
- **accepted** — `status = 'accepted'`
- **rejected** — `status = 'rejected'`
- **pending** — все остальные (новые заявки без решения)

### 4.2 byChannel

Группировка по `channel`. Допустимые значения: `instagram`, `whatsapp`, `tiktok`. Остальное — `other`.

| key       | label    |
|-----------|----------|
| instagram | Instagram|
| whatsapp  | WhatsApp |
| tiktok    | TikTok   |
| other     | Другое   |

Вернуть только записи с `count > 0`.

### 4.3 byStage

Только лиды с `status = 'accepted'` и непустым `stage_id`.  
Этапы — из таблицы `FunnelStage`, отсортированы по `order`.  
Для каждого этапа: `stageId`, `stageName`, `count` (в т.ч. 0, если лидов нет).

### 4.4 byResult

Только лиды с `status = 'accepted'`.  
Группировка по `result_status`:

| key     | label         |
|---------|---------------|
| bought  | Купили        |
| thinking| Ушли подумать |
| rejected| Отказались   |
| none    | Без результата|

Вернуть только записи с `count > 0`.

### 4.5 bySource

Группировка по `source`. Допустимые: `target`, `reels`, `stories`, `direct`, `post`. Остальное — `other`.

| key   | label             |
|-------|-------------------|
| target| Реклама (таргет)  |
| reels | Reels            |
| stories| Stories         |
| direct| Direct           |
| post  | Пост/лента       |
| other | Другое           |

Вернуть только `count > 0`.

### 4.6 byTargetType

Группировка по `target_type`:

| key     | label    |
|---------|----------|
| adult   | Взрослый |
| children| Дети    |
| none    | Не указано|

Вернуть только `count > 0`.

### 4.7 bySport

Группировка по `sport_id`. `sportName` — из таблицы Sport.  
Сортировка по `count` по убыванию. Ограничение: топ-8 или все, если меньше.

### 4.8 byTrainer

Группировка по `trainer_id`. `trainerName` — из таблицы Trainer (`fio` или `name`).  
Сортировка по `count` по убыванию. Ограничение: топ-10.

### 4.9 byTrialStatus

Только лиды с `status = 'accepted'`.  
Группировка по `trial_status`:

| key        | label              |
|------------|--------------------|
| came       | Пришли             |
| rescheduled| Перенесли          |
| no_contact | Не вышли на связь  |
| rejected   | Отказались         |
| none       | Не указано         |

Вернуть только `count > 0`.

---

## 5. Регистр полей

Сравнивать без учёта регистра: `LOWER(status) = 'accepted'`, `LOWER(channel) IN ('instagram','whatsapp','tiktok')` и т.п.

---

## 6. Интеграция с фронтом

**Реализовано.** Фронт:

1. Вызывает `GET /api/analytics/leads/?year=2025&month=2` с параметрами `year`, `month`, `day` (как у остальной аналитики)
2. Использует готовые агрегаты из `response.data` (бэк возвращает `{ "data": { ... } }`)
3. Не загружает `/api/leads/`, `/api/leads/funnel-stages/`, `/api/sports/` для блока лидов — всё приходит из одного эндпоинта

---

## 7. Пример SQL-логики (PostgreSQL)

```sql
-- Базовый фильтр по периоду
WITH filtered AS (
  SELECT *
  FROM leads
  WHERE (EXTRACT(YEAR FROM created_at) = :year OR :year IS NULL)
    AND (:month IS NULL OR EXTRACT(MONTH FROM created_at) = :month)
    AND (:day IS NULL OR EXTRACT(DAY FROM created_at) = :day)
)
-- Далее: GROUP BY по нужным полям с COUNT
```

---

## 8. Связанные документы

- `BACKEND_LEADS_SPEC.md` — модель Lead, этапы, эндпоинты лидов
- Существующие эндпоинты аналитики: `/api/analytics/summary/`, `/api/analytics/client-statuses/` и др. — используют те же параметры `year`, `month`, `day`
