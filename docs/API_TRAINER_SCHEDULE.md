# API: график тренеров и занятия клиента

Сводка контракта (бэкенд Django реализован; фронт: `src/features/sports-trainers/api.js`, форма клиента).

## Соглашения

- **День недели:** **1 = понедельник … 7 = воскресенье**.
- **Время:** **`HH:mm`**, полуинтервалы слотов **`[start, end)`**; окно фильтра в списке тренеров тоже полуоткрытое; один параметр времени трактуется как **точка внутри слота**.
- **Карточка тренера:** обновление только **`PATCH /api/trainers/{id}/`**. **`PUT /api/trainers/{id}/` → 405**. Полный график — только **`PUT /api/trainers/{id}/schedule/`**.

---

## 1. График одного тренера

### `GET /api/trainers/{id}/schedule/`

Ответ: `{ "weekdays": [ ... ] }` (7 дней). Если графика нет — семь дней с `enabled: false` (ожидается **200**, не 404).

Синонимы в JSON: `week_days`, в интервалах — `time_slots`.

### `PUT /api/trainers/{id}/schedule/`

Полная замена. Валидация: при `enabled: true` есть интервалы; `start < end`; формат `HH:mm`; без пересечений интервалов внутри дня. На входе допускаются `time_slots` / `week_days` (как в сериализаторе).

---

## 2. Список тренеров

### `GET /api/trainers/`

| Query (camel / snake) | Назначение |
|----------------------|------------|
| `sport_id` | Фильтр по виду спорта |
| `weekday` / `week_day` | День 1–7 |
| `timeFrom` / `time_from`, `timeTo` / `time_to` | Фильтр по времени; **без** `weekday` — подходит любой день недели |
| `includeSchedule` / `include_schedule` | При `true` — в каждом элементе поле **`schedule`** в том же формате, что у `GET .../schedule/` |

Фронт в форме клиента запрашивает список с **`includeSchedule: true`**, чтобы строить выпадающий список слотов без лишнего запроса; при отсутствии `schedule` в элементе выполняется запасной **`GET .../schedule/`**.

---

## 3. Клиент

В БД: `training_weekday` (1–7, nullable), `training_time_from`, `training_time_to` (`HH:mm`, могут быть пустыми).

В API (сериализатор): **`trainingWeekday`**, **`trainingTimeFrom`**, **`trainingTimeTo`** и дубликаты в **snake_case** в ответе. Передача **`null`** для полей времени / дня **обнуляет** их при сохранении.

Форма клиента: выбор слота из графика тренера → в теле PATCH/POST уходят три поля; при сбросе слота фронт шлёт **`null`** по всем трём, чтобы очистить запись.

---

## 4. Прочее

Логика на бэкенде: `sports/schedule_utils.py`. Миграции: `sports/0002_trainer_schedule`, `clients/0006_client_training_schedule`. Описания в `config/schema_views.py` (MINIMAL_OPENAPI).
