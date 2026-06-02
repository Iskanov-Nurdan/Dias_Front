# Operational WebSocket (DIAS) — спецификация

> **Статус:** реализовано на бэке (`apps/realtime`). Актуальный контракт и close codes — `docs/WEBSOCKET_API.md`.  
> Этот файл — историческая спека + чеклист; фронт синхронизирован с фактическим каталогом `resource`.

---

## Цель

Один канал WebSocket для операционных экранов. После любой значимой мутации REST API сервер рассылает компактное событие `change`; клиент делает **refetch** затронутых списков (не присылаем полные объекты в WS).

Нужна стабильная работа для разделов:

| Раздел UI | Что обновлять |
|-----------|----------------|
| **Моя смена** | смена, заметки, жалобы, журнал activity |
| **Сырьё** | справочник, остатки, приходы, списания, движения |
| **Заготовка** | справочник заготовок, состав, пластиковые профили (товары) |
| **Цех** | prepared-blanks, бочки, остатки по заготовкам |
| **Производство** | заявки, партии, старт в ОТК, список заготовок |
| **ОТК** | blank-production-runs, брак, статусы |
| **Склад** | ГП, упаковки, приёмка, операции |
| **Касса** | клиенты, заявки, продажи, оплаты, возвраты |
| **Смены** (отчёт) | список смен, жалобы, activity |

---

## Endpoint

```
WS  /ws/operational/?token=<access_jwt>
```

- Тот же JWT, что для `Authorization: Bearer` REST.
- При невалидном/истёкшем токене: **закрыть** соединение с кодом **`4001`** (без тела).
- Поддержать `ws` / `wss` за reverse proxy (nginx: `Upgrade`, `Connection`).

Опционально env на фронте: `REACT_APP_WS_URL=wss://api.example.com/ws/operational/`

---

## Протокол (version 1)

Все кадры — JSON UTF-8. В каждом кадре поле:

```json
"protocol_version": 1
```

### 1. После успешного handshake

```json
{
  "event": "connected",
  "protocol_version": 1,
  "user_id": 12
}
```

### 2. При изменении данных

```json
{
  "event": "change",
  "protocol_version": 1,
  "resource": "workshop_blank",
  "action": "updated",
  "id": 45,
  "at": "2026-05-29T12:34:56.789Z"
}
```

| Поле | Обязательно | Описание |
|------|-------------|----------|
| `event` | да | `change` |
| `resource` | да | см. таблицу ниже (строка, snake_case) |
| `action` | да | `created` \| `updated` \| `deleted` |
| `id` | нет | ID записи |
| `at` | нет | ISO8601 UTC |

Доп. поля (`order_id`, `line_id`, …) допустимы — фронт их не парсит, только `resource`.

---

## Каталог `resource` (обязательно совпасть с фронтом)

Фронт подписан на эти имена (`useOperationalRefetch`). **Используйте те же строки.**

### Смены и аудит

| resource | Когда слать |
|----------|-------------|
| `shift` | открытие/закрытие/пауза смены, смена статуса |
| `shift_note` | заметка к смене |
| `shift_complaint` | жалоба по смене |
| `activity` | запись в журнале действий пользователя |

### Сырьё

| resource | Когда слать |
|----------|-------------|
| `raw_material` | CRUD справочника сырья |
| `incoming` | приход сырья |
| `material_balance` | пересчёт остатка |
| `material_writeoff` | списание |
| `material_movement` | движение |

### Заготовка / цех / ОТК

| resource | Когда слать |
|----------|-------------|
| `workshop_blank` | CRUD заготовки, изменение состава |
| `prepared_blank` | prepared-blanks, add-barrel, остатки цеха |
| `blank_production_run` | выпуск, run в производстве, **ОТК defect**, accept-gp |
| `plastic_profile` | CRUD пластикового профиля (товар для производства) |

*Алиас:* можно **дублировать** событие с `resource: "workshop_run"` = то же, что `blank_production_run` (фронт слушает оба).

### Производство и заявки

| resource | Когда слать |
|----------|-------------|
| `order` | заявка клиента, статусы |
| `orders` | массовые изменения списка заявок (опционально, дубль `order`) |
| `production_batch` | партия производства |
| `batch` | алиас к `production_batch` (если уже есть в коде) |

### Склад

| resource | Когда слать |
|----------|-------------|
| `warehouse_batch` | партия/остаток на складе |
| `warehouse_package` | упаковка (короб/паллета) |

### Касса / продажи

| resource | Когда слать |
|----------|-------------|
| `sale` | продажа |
| `payment` | оплата, отмена платежа |
| `return` | возврат |
| `client` | клиент (деактивация, долг) — **добавить на фронте при внедрении** |

### Справочники / прочее (уже на других экранах)

`recipe`, `recipes`, `line`, `line_history`, `defect_record`, `rework_request`, `other_expense` — слать по существующим мутациям, если экраны используются.

---

## Правила рассылки

1. **После успешного commit в БД** — не до транзакции.
2. Одна мутация → один или несколько `change` (если затронуто несколько агрегатов, например accept-gp → `blank_production_run` + `warehouse_batch`).
3. **Права:** пользователь получает только события по ресурсам, к которым у него есть доступ (или глобально для роли admin — по политике продукта). Минимум: не слать чужие персональные смены без права «Смены».
4. **Не слать** события отменённым запросам / failed validation.
5. **Дедупликация:** если за 100 ms уходит 5 одинаковых `resource`+`id`, можно слить в одно (не обязательно в v1).
6. **Broadcast:** всем подключённым с нужным permission (операционный зал), не только инициатору.

---

## Стабильность (обязательно)

| Требование | Детали |
|------------|--------|
| Heartbeat | ping/pong каждые 30 s или JSON `{"event":"ping"}` / `pong` |
| Idle timeout | ≥ 60 s без pong → close |
| Reconnect | клиент переподключается; сервер stateless по сокетам |
| Redis / channel layer | при нескольких воркерах — Channels + Redis, иначе события теряются |
| Порядок | порядок не гарантируется; клиент всегда refetch |
| Rate limit | не чаще ~20 событий/с на одного клиента (burst допустим) |

---

## Маппинг REST → resource (чеклист для разработки)

Примеры (дополнить по вашим ViewSet):

```
POST/PATCH/DELETE  /api/workshop/blanks/              → workshop_blank
POST             .../prepared-blanks/.../add-barrel/ → prepared_blank
POST/PATCH       .../blank-production-runs/          → blank_production_run
POST             .../otk-defect/                     → blank_production_run
POST             .../accept-gp/                      → blank_production_run, warehouse_batch
POST             /api/raw-materials/...              → raw_material, material_balance
POST             /api/incoming/...                  → incoming, material_balance
POST             /api/shifts/open|close/             → shift, activity
POST             /api/shifts/.../notes/             → shift_note, activity
POST             /api/sales/...                     → sale, payment?, warehouse_batch?
POST             /api/orders/...                    → order
POST             /api/production/.../start/         → production_batch, order, workshop_blank
POST             /api/gp-packages/...               → warehouse_package, warehouse_batch
```

---

## Тесты приёмки

1. Два браузера, один пользователь (или два с правами цеха): в одном добавили бочку → во втором список цеха обновился без F5.
2. ОТК: ввод брака в одной вкладке → вторая вкладка ОТК обновила статус run.
3. Склад: упаковка в модалке → список ГП обновился у коллеги.
4. Просроченный token → close `4001`, фронт на логин.
5. Рестарт воркера → клиенты переподключились, `connected` пришёл снова.
6. Нагрузка: 10 параллельных мутаций — нет падения consumer, нет утечки сокетов.

---

## Стек (рекомендация Django)

- Django Channels 4 + Redis channel layer
- `OperationalConsumer` на `ws/operational/`
- JWT middleware из query `token` (тот же validator, что REST)
- Хелпер `broadcast_operational(resource, action, id=None, user_ids=None)`

```python
# псевдокод
async def broadcast_operational(resource: str, action: str, id=None):
    await channel_layer.group_send(
        "operational",
        {
            "type": "operational.message",
            "payload": {
                "event": "change",
                "protocol_version": 1,
                "resource": resource,
                "action": action,
                "id": id,
                "at": timezone.now().isoformat(),
            },
        },
    )
```

Вызов `broadcast_operational(...)` — в `transaction.on_commit(...)` после успешных сервисов/сигналов.

---

## Контакт с фронтом

- Контракт: `docs/WEBSOCKET_API.md` в репозитории Dias_Front
- Константа версии: `OPERATIONAL_WS_PROTOCOL_VERSION = 1`
- Close code токена: `4001`

После реализации пришлите список фактических `resource`, если добавите новые — фронт допишем в `useOperationalRefetch`.
