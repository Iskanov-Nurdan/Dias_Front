# Operational WebSocket (контракт фронта)

## Подключение

- **URL:** `wss://{host}/ws/operational/?token={access_jwt}` (или `REACT_APP_WS_URL` + `?token=`)
- **Auth:** access JWT в query `token`
- **Отказ:** close code `4001` — невалидный/просроченный токен (фронт разлогинивает)

## Версия протокола

`protocol_version: 1` в каждом JSON-кадре.

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
  "resource": "workshop_blank",
  "action": "updated",
  "id": 45,
  "at": "2026-05-29T12:00:00Z"
}
```

- `resource` — строковый ключ (см. `WEBSOCKET_BACKEND_PROMPT.md`, таблица ресурсов)
- `action` — `created` | `updated` | `deleted` | `changed`
- `id` — опционально, ID сущности
- `at` — ISO8601 UTC (не `ts`)
- Доп. поля (`line_id`, `order_id`, `blank_id`, …) — опционально, refetch только по `resource`

### Heartbeat

Сервер каждые 30 с: `{"event":"ping","protocol_version":1}`.  
Клиент отвечает: `{"event":"pong","protocol_version":1}`.

## Поведение клиента

- Один WS на сессию (`OperationalRealtimeProvider`)
- Страницы подписаны через `useOperationalRefetch([resources], refetch)`
- При `change` с известным `resource` — REST refetch списка/деталки
- `connected` → статус «онлайн»; автопереподключение с backoff (кроме code `4001`)
- На `ping` — всегда `pong`
