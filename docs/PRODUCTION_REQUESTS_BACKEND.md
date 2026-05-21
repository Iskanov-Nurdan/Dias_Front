# Производство → вкладка «Заявки»

## GET `GET /api/production/requests/`

В каждой заявке — полный массив позиций (как в `GET /api/orders/`):

```json
{
  "id": 42,
  "client_name": "…",
  "allowed_blank_ids": [1, 2],
  "order_lines": [
    { "profile_id": 5, "profile_name": "Пластиковый профиль 5м", "quantity": "20" },
    { "profile_id": 12, "profile_name": "Пластиковый профиль 6м", "quantity": "10" }
  ]
}
```

Без `order_lines` фронт подгружает `GET /api/orders/{id}/`.

---

## POST `POST /api/production/requests/<id>/start/`

**Одна заготовка (как сейчас):**

```json
{ "blank": 1 }
```

**Несколько профилей — привязка заготовки к позиции (актуально):**

```json
{
  "line_starts": [
    { "order_line_id": 101, "blank": 1 },
    { "order_line_id": 102, "blank": 2 }
  ]
}
```

→ **отдельный** `BlankProductionRun` в ОТК на каждый профиль. Подробно: `PRODUCTION_LINE_BLANK_OTK_BACKEND.md`.

`{ "blanks": [1, 2] }` без позиций — **устарело**, не использовать для заявок с несколькими `order_lines`.

---

## Смена и линия (обязательно по новой логике)

- Фронт **не** передаёт `line` в `POST …/start/`.
- В UI **нет** выбора линии; оператор работает через **личную смену** (`GET/POST shifts/my/`, `line = null`).
- **`start/` не должен** вызывать `resolve_line_and_shift_for_user` / требовать открытую смену **на линии**.
- Достаточно открытой личной смены текущего пользователя (или старт без привязки к линии вообще — по вашей модели).
- Тексты ошибок для пользователя **без** «на линии»; код `NO_OPEN_SHIFT` → «Откройте „Моя смена“».
- Заголовки `X-Shift-Id` / `X-Audit-Shift-Id` — id **личной** смены, если нужен аудит.
