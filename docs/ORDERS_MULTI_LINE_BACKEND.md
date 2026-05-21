# Промпт для бэкенда: несколько товаров (профилей) в одной заявке

Фронт при создании уже шлёт `order_lines[]`. В списке `GET /api/orders/` часто отдаётся только **первая** строка в полях корня (`profile_id`, `quantity`) — в таблице виден один товар.

---

## POST `POST /api/orders/` (уже есть)

```json
{
  "client": 1,
  "date": "2026-05-21",
  "order_lines": [
    { "profile": 5, "quantity": 20 },
    { "profile": 12, "quantity": 10 }
  ],
  "payment_type": "debt",
  "payment_method": "cash",
  "total_amount": "50000",
  "paid_amount": "0"
}
```

Корневые `profile` / `quantity` — legacy (первая строка), можно оставить для совместимости.

---

## GET `GET /api/orders/` и `GET /api/orders/{id}/`

**В каждом объекте заявки обязательно:**

```json
{
  "id": 42,
  "client_id": 1,
  "client_name": "Abylov diyar",
  "request_status": "draft",
  "order_lines": [
    {
      "id": 101,
      "profile_id": 5,
      "profile_name": "Пластиковый профиль 5м",
      "recipe_id": null,
      "recipe_name": null,
      "quantity": "20"
    },
    {
      "id": 102,
      "profile_id": 12,
      "profile_name": "Профиль 60×40",
      "recipe_id": 7,
      "recipe_name": "Рецепт А",
      "quantity": "10"
    }
  ]
}
```

| Поле | Обязательно |
|------|-------------|
| `order_lines` | да, массив **всех** позиций |
| `profile_id` / `profile_name` | в каждой строке |
| `quantity` | в каждой строке |
| `recipe_id` / `recipe_name` | опционально |

**Алиасы (фронт понимает):** `lines`, `items`, `request_lines`, `positions`, `products`.

**Не достаточно:** только `profile_id` и `quantity` на корне заказа — тогда в UI один товар.

Опционально: `lines_count` — число позиций (для списка без разбора массива).

---

## Проверка

1. Создать заявку с 2+ профилями.
2. `GET /api/orders/` — в ответе у этой заявки `order_lines.length >= 2`.
3. `GET /api/orders/{id}/` — тот же массив.

Фронт: подгружает `GET orders/{id}/`, если в списке одна строка; при наличии `order_lines` в списке — показывает все сразу.
