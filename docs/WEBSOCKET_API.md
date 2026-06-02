# Operational WebSocket (контракт фронта ↔ бэк)

**Статус бэка:** реализовано в `apps/realtime` (Django Channels + Daphne/ASGI).  
**Статус фронта:** `OperationalRealtimeProvider`, `useOperationalRefetch`, ping/pong.

---

## Подключение

- **URL:** `ws://127.0.0.1:8000/ws/operational/?token={access_jwt}` (dev) или `wss://{host}/ws/operational/?token=…`
- **Переопределение:** `REACT_APP_WS_URL=wss://api.example.com/ws/operational/`
- **Auth:** тот же access JWT, что `Authorization: Bearer` в REST (query `token`)
- **Dev origins:** `:3000` (CRA), `:5173` (Vite)

### Close codes

| Code | Значение | Поведение фронта |
|------|----------|------------------|
| `4000` | Idle timeout (60 с без pong) | Автопереподключение |
| `4001` | Невалидный/просроченный JWT | Разлогин |

### Типичные ошибки DevTools

| Ошибка | Причина |
|--------|---------|
| `ERR_CONNECTION_REFUSED` | Бэкенд не запущен или порт 8000 занят — **не** отсутствие endpoint |
| WS Status `101` | Подключение OK, ждите кадр `connected` |

**Запуск dev:** `python manage.py runserver` (Daphne/ASGI на `:8000`).  
**Prod:** `REDIS_URL=redis://…` + `daphne config.asgi:application`.

---

## Версия протокола

`protocol_version: 1` в каждом JSON-кадре.

---

## События

### `connected` (сервер → клиент)

```json
{
  "event": "connected",
  "protocol_version": 1,
  "user_id": 12
}
```

### `change` (сервер → клиент)

```json
{
  "event": "change",
  "protocol_version": 1,
  "resource": "raw_material",
  "action": "updated",
  "id": 45,
  "at": "2026-05-29T12:00:00Z"
}
```

- `resource` — snake_case, см. каталог ниже
- `action` — `created` | `updated` | `deleted` | `changed`
- `id` — опционально
- `at` — ISO8601 UTC
- Рассылка: `signals.py` + `transaction.on_commit`, фильтр по `UserAccess` (`apps/realtime/access.py`)
- Клиент **не** парсит payload — только REST refetch по `resource`

### Heartbeat

Сервер каждые **30 с:** `{"event":"ping","protocol_version":1}`  
Клиент отвечает: `{"event":"pong","protocol_version":1}`

---

## Каталог `resource` (фактический, бэк)

```
shift, shift_note, shift_complaint, activity,
raw_material, incoming, material_balance, material_writeoff, material_movement,
workshop_blank, prepared_blank, blank_production_run, workshop_run, plastic_profile,
order, orders, production_batch, batch, recipe_run,
warehouse_batch, warehouse_package,
sale, payment, return, client,
recipe, recipes, line, line_history,
defect_record, rework_request,
chemistry*   (префикс: chemistry_batch, chemistry_element, …)
```

На фронте: `src/shared/realtime/operationalResources.js`, подписка `chemistry*` — по префиксу.

---

## Поведение клиента

- Один WS на сессию (`OperationalRealtimeProvider`)
- Страницы: `useOperationalRefetch([resources], refetch)` — debounce 300 ms
- `connected` → статус online
- Переподключение с backoff 1…30 s (кроме `4001`)
- На `ping` — всегда `pong`

---

## Проверка приёмки

1. Логин → DevTools → WS → кадр `connected` с `user_id`
2. Две вкладки «Сырьё» → `POST /api/incoming/` → вторая обновилась без F5
3. Просроченный token → close `4001` → редирект на логин
4. Перезапуск `runserver` → клиент переподключился

---

## Связанные файлы

| Слой | Путь |
|------|------|
| Бэк | `apps/realtime/` |
| Фронт WS | `src/shared/realtime/` |
| Константы | `operationalWsConstants.js`, `operationalResources.js` |
