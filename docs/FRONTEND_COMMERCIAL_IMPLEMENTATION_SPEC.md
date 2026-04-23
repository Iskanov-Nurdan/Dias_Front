# FRONTEND COMMERCIAL IMPLEMENTATION SPEC

Документ: техническое ТЗ для реализации коммерческого фронтенда без изменения backend API.

Область:
1. `Заявки` (`/orders`)
2. `Отгрузки` (`/sales`)
3. `Оплаты` (`/payments`)
4. `Возвраты` (`/returns`)
5. `Брак и переделка` (`/defects` + `/rework-requests`)

Базовый API:
- `API_BASE`: `/api/`
- auth: `Bearer token`
- list-параметры: `page`, `page_size`

---

## 1. Заявки (`/orders`)

## 1.1 Список

- Маршрут: `/orders`
- Endpoint (GET): `GET /api/orders/`
- Query params:
  - `page: number`
  - `page_size: number`
  - `search: string`
  - `status: string`
- Колонки (порядок):
  1. `Номер` (`order_number`)
  2. `Дата` (`date` или `created_at`)
  3. `Клиент` (`client_name`)
  4. `Статус` (`status`)
  5. `Сумма` (`total_amount`)
  6. `Оплачено` (`paid_amount`)
  7. `Осталось отгрузить` (`remaining_to_ship`) — вычислять на фронте, если backend не отдает готовое поле
  8. `Действия`
- Кликабельность:
  - клик по `Номер` -> открыть карточку заявки
  - `Действия` -> dropdown
- Фильтры:
  - `Статус` -> отправка `status`
  - `Период` -> при поддержке backend `date_from/date_to`; если не поддерживается, фильтровать локально
  - `Клиент` -> при поддержке backend `client_id`; если не поддерживается, фильтровать локально
- Поиск:
  - отправлять в `search`
  - backend должен искать по `order_number`, `client_name`
- Pagination:
  - серверная, по `page/page_size`
- WebSocket:
  - слушать `order`, `sale`, `payment`
  - на событие `change` -> `refetch` списка

## 1.2 Карточка (detail)

- Endpoint (GET):
  - основной: `GET /api/orders/{id}/`
  - fallback (если detail не содержит связей): использовать `GET /api/sales/?linked_order={id}` и `GET /api/payments/?linked_order={id}`
- Структура данных:
  - `id`, `order_number`, `date`, `client`, `client_name`, `status`, `comment`
  - `lines[]`:
    - `id`
    - `product`
    - `product_type`
    - `ordered_quantity`
    - `unit_price`
    - `comment`
  - агрегаты: `total_amount`, `paid_amount`
- Блоки карточки:
  - `Общее`: номер, дата, клиент, статус, сумма, оплачено
  - `Строки`: товар, заказано, цена, сумма строки
  - `Связанные отгрузки`: номер, дата, сумма, статус
  - `Связанные оплаты`: дата, тип, сумма
  - `История`: статусные переходы/действия (если backend отдает; иначе локальный журнал действий)
- Кнопки:
  - `Редактировать`
  - `Сменить статус`
  - `Создать отгрузку`
  - `Принять оплату`
  - `Накладная`
- Действия по статусам:
  - `new`: редактировать, сменить статус, принять оплату, создать отгрузку
  - `confirmed`: редактировать, принять оплату, создать отгрузку
  - `in_progress`: редактировать, принять оплату, создать отгрузку
  - `partially_shipped`: принять оплату, создать отгрузку
  - `shipped`: принять оплату
  - `closed`: только просмотр/документы
  - `canceled`: только просмотр

## 1.3 Создание

- Endpoint (POST): `POST /api/orders/`
- Payload (точный JSON):
```json
{
  "client": 123,
  "date": "2026-04-23",
  "source_type": "manager",
  "comment": "строка",
  "responsible_user_id": 7,
  "lines": [
    {
      "product": "Профиль A",
      "product_type": "profile",
      "ordered_quantity": 100,
      "unit_price": 55.5,
      "comment": "строка"
    }
  ]
}
```
- Поля формы:
  - `Клиент` (`select`, optional -> `client`)
  - `Дата` (`date`, required -> `date`)
  - `Источник` (`select`, required -> `source_type`)
  - `Комментарий` (`textarea`, optional -> `comment`)
  - `Ответственный` (`select user`, optional -> `responsible_user_id`)
  - `Строки`:
    - `Товар` (`text/select`, required -> `product`)
    - `Тип товара` (`select`, optional -> `product_type`)
    - `Количество` (`number`, required, >0 -> `ordered_quantity`)
    - `Цена` (`number`, optional -> `unit_price`)
    - `Комментарий` (`text`, optional -> `comment`)
- Валидации:
  - минимум 1 строка
  - у строки обязательны `product` и `ordered_quantity > 0`
  - `date` обязательна
- Success:
  - закрыть форму
  - toast `Заявка сохранена`
  - `refetch` списка
- Ошибки:
  - показывать `getApiErrorMessage`
  - field-level ошибки из `details` привязать к полям

## 1.4 Редактирование

- Endpoint (PATCH): `PATCH /api/orders/{id}/`
- Изменяемые поля:
  - `client`, `date`, `source_type`, `comment`, `responsible_user_id`, `lines`
- Нельзя менять:
  - `id`
  - `order_number`
  - системные audit-поля
- Ограничения:
  - если статус `closed/canceled`, редактирование заблокировать

## 1.5 Действия

### Смена статуса заявки
- Кнопка: dropdown в строке и в карточке
- Endpoint: `PATCH /api/orders/{id}/status/`
- Payload:
```json
{ "status": "confirmed" }
```
- Что меняется: `status`
- Refetch: список + карточка
- Ошибки: статус недоступен -> показать backend message

### Создать отгрузку из заявки
- Кнопка: в карточке заявки
- Endpoint: `POST /api/sales/`
- Payload (минимум):
```json
{
  "date": "2026-04-23",
  "sale_date": "2026-04-23",
  "sale_status": "draft",
  "client": 123,
  "linked_order": 777,
  "lines": [
    {
      "order_line": 1,
      "product": "Профиль A",
      "quantity": 50,
      "unit_price": 55.5
    }
  ]
}
```
- Что меняется: появляется sale, обновляется shipping-прогресс заявки
- Refetch: `orders`, `sales`, карточка заявки
- Ошибки: превышение доступного количества, недоступный статус

### Принять оплату по заявке
- Кнопка: в карточке заявки
- Endpoint: `POST /api/payments/`
- Payload:
```json
{
  "date": "2026-04-23",
  "client": 123,
  "linked_order": 777,
  "payment_type": "prepayment",
  "payment_method": "cash",
  "amount": 10000
}
```
- Что меняется: платеж, `paid_amount` заявки
- Refetch: `orders`, `payments`, карточка заявки
- Ошибки: `amount <= 0`, бизнес-ограничения backend

---

## 2. Отгрузки (`/sales`)

## 2.1 Список

- Маршрут: `/sales`
- Endpoint (GET): `GET /api/sales/`
- Query params:
  - `page`, `page_size`
  - рекомендуется добавить (если backend поддерживает): `search`, `client_id`, `status`, `linked_order`
- Колонки (порядок):
  1. `Номер` (`sale_number`)
  2. `Дата` (`sale_date`)
  3. `Клиент` (`client_name`)
  4. `Статус` (`sale_status`)
  5. `Сумма` (`revenue`)
  6. `Оплачено` (`paid_amount`)
  7. `Остаток` (`revenue - paid_amount`)
  8. `Действия`
- Кликабельность:
  - `Номер` -> карточка
  - dropdown действий
- Фильтры:
  - клиент
  - статус
  - период
  - связанная заявка
- Поиск:
  - по `sale_number`, `client_name`
- Pagination:
  - серверная
- WebSocket:
  - `sale`, `warehouse_batch`, `order`, `payment`, `return`
  - на событие -> `refetch` списка

## 2.2 Карточка (detail)

- Endpoint (GET): `GET /api/sales/{id}/`
- Структура:
  - `id`, `sale_number`, `sale_date`, `client`, `client_name`, `linked_order`, `sale_status`, `comment`, `is_defect_sale`
  - `lines[]`:
    - `id`
    - `order_line_id`
    - `product`
    - `warehouse_batch_id`
    - `stock_form`
    - `quantity`
    - `unit_price`
    - `comment`
  - `revenue`, `paid_amount`
- Блоки:
  - `Общее`
  - `Строки отгрузки`
  - `Связанные оплаты`
  - `Связанные возвраты`
  - `История`
- Кнопки:
  - `Редактировать`
  - `Накладная`
  - `Квитанция`
  - `Принять оплату`
  - `Создать возврат`
- Действия по статусам:
  - `draft`: редактировать, документы, удалить
  - `confirmed`: редактировать, принять оплату, возврат
  - `partially_shipped`: редактировать, принять оплату, возврат
  - `shipped`: принять оплату, возврат, документы
  - `closed`: только документы/просмотр
  - `canceled`: только просмотр

## 2.3 Создание

- Endpoint (POST): `POST /api/sales/`
- Payload:
```json
{
  "date": "2026-04-23",
  "sale_date": "2026-04-23",
  "sale_status": "draft",
  "client": 123,
  "linked_order": 777,
  "invoice_number": "INV-001",
  "receipt_number": "RCPT-001",
  "comment": "строка",
  "is_defect_sale": false,
  "lines": [
    {
      "order_line": 1,
      "product": "Профиль A",
      "warehouse_batch": 456,
      "stock_form": "packed",
      "quantity": 50,
      "unit_price": 55.5,
      "comment": "строка"
    }
  ]
}
```
- Поля формы:
  - `Дата`, `Клиент`, `Связанная заявка`, `Статус`, `Комментарий`
  - `Строки`: `Товар`, `Количество`, `Цена`, `Партия` (если нужна)
- Валидации:
  - минимум 1 строка
  - `product` обязателен
  - `quantity > 0`
- Success:
  - закрыть форму
  - toast
  - refetch списка
- Ошибки:
  - показывать backend details по строкам

## 2.4 Редактирование

- Endpoint (PATCH): `PATCH /api/sales/{id}/`
- Можно менять:
  - `sale_status`, `comment`, `lines`, `linked_order`, `client`, `date`
- Нельзя менять:
  - `id`, `sale_number`
- Ограничения:
  - в `closed/canceled` редактирование запрещено

## 2.5 Действия

### Частичная отгрузка
- Кнопка: карточка продажи / создание из заявки
- Endpoint: `PATCH /api/sales/{id}/`
- Payload:
```json
{
  "sale_status": "partially_shipped",
  "lines": [
    {
      "id": 10,
      "product": "Профиль A",
      "quantity": 20,
      "unit_price": 55.5
    }
  ]
}
```
- Что меняется: количества строк, статус продажи, прогресс заявки
- Refetch: `sales`, `orders`, detail
- Ошибки: qty > доступного/некорректный status transition

### Принять оплату по продаже
- Кнопка: в карточке продажи
- Endpoint: `POST /api/payments/`
- Payload:
```json
{
  "date": "2026-04-23",
  "client": 123,
  "linked_sale": 900,
  "payment_type": "payment",
  "payment_method": "transfer",
  "amount": 5000
}
```
- Refetch: `sales`, `payments`, detail

### Создать возврат из продажи
- Кнопка: в карточке продажи
- Endpoint: `POST /api/returns/`
- Payload:
```json
{
  "sale": 900,
  "date": "2026-04-23",
  "return_reason": "строка",
  "lines": [
    {
      "sale_line": 1001,
      "product": "Профиль A",
      "quantity": 5,
      "return_target": "warehouse",
      "condition_type": "good"
    }
  ]
}
```
- Refetch: `returns`, `sales`, detail

---

## 3. Оплаты (`/payments`)

## 3.1 Список

- Маршрут: `/payments`
- Endpoint (GET): `GET /api/payments/`
- Query params:
  - `page`, `page_size`
  - `payment_type`
  - `client_id`
- Колонки:
  1. `Дата`
  2. `Клиент`
  3. `Тип`
  4. `Способ`
  5. `Сумма`
  6. `Связанный документ` (`linked_order`/`linked_sale`)
  7. `Действия`
- Кликабельность:
  - дата/номер платежа -> карточка
- Фильтры:
  - клиент (`client_id`)
  - тип оплаты (`payment_type`)
- Поиск:
  - при поддержке backend -> `search` (номер платежа/клиент)
- Pagination:
  - серверная
- WebSocket:
  - `payment`, `sale`, `order`
  - refetch списка

## 3.2 Карточка (detail)

- Endpoint:
  - если есть detail endpoint: `GET /api/payments/{id}/`
  - если нет, брать запись из списка
- Структура:
  - `payment_number`, `date`, `client`, `payment_type`, `payment_method`, `amount`, `linked_order`, `linked_sale`, `comment`
- Блоки:
  - `Общее`
  - `Связанные документы`
  - `История изменений` (если доступна)
- Кнопки:
  - `Редактировать`
  - `Удалить`

## 3.3 Создание

- Endpoint (POST): `POST /api/payments/`
- Payload:
```json
{
  "date": "2026-04-23",
  "client": 123,
  "linked_order": 777,
  "linked_sale": 900,
  "payment_type": "prepayment",
  "payment_method": "cash",
  "amount": 10000,
  "comment": "строка"
}
```
- Поля формы:
  - `Дата` (required)
  - `Клиент` (optional but recommended)
  - `Связанная заявка` (optional)
  - `Связанная продажа` (optional)
  - `Тип оплаты` (required)
  - `Способ оплаты` (required)
  - `Сумма` (required)
  - `Комментарий` (optional)
- Валидации:
  - `amount > 0`
  - минимум одна связь `client`/`linked_order`/`linked_sale` по бизнес-правилу проекта
- Success:
  - закрыть форму, toast, refetch
- Ошибки:
  - backend message

## 3.4 Редактирование

- Endpoint: `PATCH /api/payments/{id}/`
- Можно менять:
  - `date`, `payment_type`, `payment_method`, `amount`, `comment`, `linked_order`, `linked_sale`
- Нельзя менять:
  - `id`, `payment_number`

## 3.5 Действие: принять оплату

- Используется в контексте заявки/продажи, но создает сущность в `/payments`.
- Endpoint: `POST /api/payments/`
- Refetch:
  - текущий экран источника (`orders` или `sales`)
  - `payments`
  - карточка клиента (summary)

---

## 4. Возвраты (`/returns`)

## 4.1 Список

- Маршрут: `/returns`
- Endpoint (GET): `GET /api/returns/`
- Query params:
  - `page`, `page_size`
  - `sale_id`
- Колонки:
  1. `Номер`
  2. `Дата`
  3. `Продажа`
  4. `Клиент`
  5. `Причина`
  6. `Статус`
  7. `Действия`
- Кликабельность:
  - номер -> карточка
- Фильтры:
  - продажа (`sale_id`)
  - период (локально или backend param)
- Поиск:
  - по номеру возврата/продажи (если backend поддерживает `search`)
- Pagination:
  - серверная
- WebSocket:
  - `return`, `defect_record`, `rework_request`, `sale`
  - refetch списка

## 4.2 Карточка (detail)

- Endpoint (GET): `GET /api/returns/{id}/`
- Структура:
  - `id`, `return_number`, `date`, `sale`, `return_reason`, `comment`
  - `lines[]`: `sale_line`, `product`, `quantity`, `return_target`, `condition_type`, `comment`
- Блоки:
  - `Общее`
  - `Строки возврата`
  - `Связанные сущности` (брак/переделка при маршрутизации)
  - `История`
- Кнопки:
  - `Редактировать`
  - `Акт возврата`
  - `Отправить в брак` (для релевантных строк)
  - `Отправить в переделку` (для релевантных строк)

## 4.3 Создание

- Endpoint (POST): `POST /api/returns/`
- Payload:
```json
{
  "sale": 900,
  "date": "2026-04-23",
  "return_reason": "Повреждение",
  "comment": "строка",
  "lines": [
    {
      "sale_line": 1001,
      "product": "Профиль A",
      "quantity": 5,
      "return_target": "defect",
      "condition_type": "defect",
      "comment": "строка"
    }
  ]
}
```
- Поля формы:
  - `Продажа` (required)
  - `Дата` (required)
  - `Причина` (optional)
  - `Строки`: товар/количество/маршрут/состояние
- Валидации:
  - `sale` обязателен
  - минимум 1 строка
  - строка: `product` и `quantity>0`
- Success:
  - закрыть форму, toast, refetch

## 4.4 Редактирование

- Endpoint: `PATCH /api/returns/{id}/`
- Можно менять:
  - `date`, `return_reason`, `comment`, `lines`
- Нельзя менять:
  - `id`, `return_number`
- Ограничения:
  - закрытые/финализированные возвраты только read-only (по backend rules)

## 4.5 Действия

### Отправить в брак
- Кнопка: в карточке возврата на строке с маршрутом `В брак`
- Endpoint: фактически создается запись через `POST /api/defects/` (если backend не автосоздает от return webhook)
- Payload:
```json
{
  "source_type": "return",
  "source_id": 555,
  "product": "Профиль A",
  "quantity_pcs": 5,
  "status": "new",
  "defect_reason": "Возврат клиента"
}
```
- Refetch: `returns`, `defects`, detail

### Отправить в переделку
- Кнопка: в карточке возврата на строке `На переделку`
- Endpoint: `POST /api/rework-requests/`
- Payload:
```json
{
  "return_doc": 555,
  "product": "Профиль A",
  "quantity_kg": 12.5,
  "status": "pending",
  "comment": "из возврата"
}
```
- Refetch: `returns`, `rework-requests`, detail

---

## 5. Брак и переделка (`/defects` + `/rework-requests`)

## 5.1 Брак (`/defects`) — список

- Endpoint (GET): `GET /api/defects/`
- Query params:
  - `page`, `page_size`
  - `status`
- Колонки:
  1. `Продукт`
  2. `Количество`
  3. `Источник`
  4. `Статус`
  5. `Причина`
  6. `Действия`
- WebSocket:
  - `defect_record`, `sale`, `rework_request`
  - refetch списка

## 5.2 Брак — карточка

- Endpoint (GET):
  - если есть detail endpoint: `GET /api/defects/{id}/`
  - иначе запись из списка
- Блоки:
  - `Общее`
  - `Связанные продажи брака`
  - `Связанные переделки`
  - `История`
- Кнопки:
  - `Редактировать`
  - `Отправить на переработку`
  - `Продать брак`
  - `Списать`

## 5.3 Брак — создание/редактирование

- POST: `POST /api/defects/`
- PATCH: `PATCH /api/defects/{id}/`
- Payload POST/PATCH:
```json
{
  "source_type": "return",
  "source_id": 555,
  "product": "Профиль A",
  "quantity_pcs": 5,
  "kg_coefficient": 2.5,
  "defect_reason": "Повреждение",
  "status": "new",
  "comment": "строка"
}
```
- Можно менять:
  - `product`, `quantity_pcs`, `kg_coefficient`, `defect_reason`, `status`, `comment`
- Нельзя менять:
  - `id`
- Ограничения:
  - для `sold/written_off` редактирование ограничено

## 5.4 Переделка (`/rework-requests`) — список

- Endpoint (GET): `GET /api/rework-requests/`
- Query params:
  - `page`, `page_size`
  - `status`
- Колонки:
  1. `Номер`
  2. `Продукт`
  3. `Количество, кг`
  4. `Статус`
  5. `Результат`
  6. `Действия`
- WebSocket:
  - `rework_request`, `defect_record`, `warehouse_batch`
  - refetch списка

## 5.5 Переделка — создание/редактирование/завершение

- POST create: `POST /api/rework-requests/`
- PATCH update: `PATCH /api/rework-requests/{id}/`
- POST complete: `POST /api/rework-requests/{id}/complete/`

- Payload create/update:
```json
{
  "return_doc": 555,
  "defect_record": 333,
  "original_sale": 900,
  "product": "Профиль A",
  "quantity_kg": 12.5,
  "status": "pending",
  "comment": "строка"
}
```

- Payload complete:
```json
{
  "result_warehouse_batch_id": 456
}
```

## 5.6 Действия (обязательные)

### Отправить на переработку (из брака)
- Кнопка: в строке/карточке брака
- Endpoint: `POST /api/defects/{id}/send-to-rework/`
- Payload:
```json
{}
```
- Refetch: `defects`, `rework-requests`, detail

### Завершить переделку
- Кнопка: в строке/карточке переделки
- Endpoint: `POST /api/rework-requests/{id}/complete/`
- Payload:
```json
{
  "result_warehouse_batch_id": 456
}
```
- Refetch: `rework-requests`, `defects`, `warehouse` (если экран открыт)

### Продать брак
- Кнопка: в строке/карточке брака
- Endpoint: `POST /api/defects/{id}/sell/`
- Payload:
```json
{
  "client_id": 123,
  "price": 1000,
  "quantity": 5,
  "date": "2026-04-23"
}
```
- Refetch: `defects`, `sales`, `payments` (если автосвязь), detail

### Списать брак
- Кнопка: в строке/карточке брака
- Endpoint: `POST /api/defects/{id}/writeoff/`
- Payload:
```json
{
  "writeoff_reason": "Невосстановимый дефект"
}
```
- Refetch: `defects`, detail

---

## 6. Статусы (code -> UI -> color -> действия)

## 6.1 Orders
- `new` -> `Новая` -> gray -> редактировать, смена статуса, принять оплату, создать отгрузку
- `confirmed` -> `Подтверждена` -> blue -> редактировать, принять оплату, создать отгрузку
- `in_progress` -> `В работе` -> blue -> редактировать, принять оплату, создать отгрузку
- `partially_shipped` -> `Частично отгружена` -> orange -> принять оплату, создать отгрузку
- `shipped` -> `Отгружена` -> green -> принять оплату
- `closed` -> `Закрыта` -> green -> просмотр, документы
- `canceled` -> `Отменена` -> red -> просмотр

## 6.2 Sales
- `draft` -> `Черновик` -> gray -> редактировать, удалить
- `confirmed` -> `Подтверждена` -> blue -> редактировать, оплата, возврат
- `partially_shipped` -> `Частично отгружена` -> orange -> редактировать, оплата, возврат
- `shipped` -> `Отгружена` -> green -> оплата, возврат, документы
- `closed` -> `Закрыта` -> green -> документы
- `canceled` -> `Отменена` -> red -> просмотр

## 6.3 Payments
- `prepayment` -> `Предоплата` -> blue
- `payment` -> `Оплата` -> green
- `surcharge` -> `Доплата` -> orange
- `refund` -> `Возврат` -> red

## 6.4 Defects
- `new` -> `Новый` -> gray -> переработка/продажа/списание
- `on_stock` -> `На складе брака` -> blue -> переработка/продажа/списание
- `sent_to_rework` -> `На переработке` -> orange -> просмотр
- `reworked` -> `Переработан` -> green -> просмотр
- `sold` -> `Продан` -> green -> просмотр
- `written_off` -> `Списан` -> red -> просмотр

## 6.5 Rework requests
- `pending` -> `Ожидает` -> gray -> редактировать, завершить
- `in_progress` -> `В работе` -> blue -> редактировать, завершить
- `completed` -> `Завершена` -> green -> просмотр
- `canceled` -> `Отменена` -> red -> просмотр

---

## 7. Формы (поля, options, скрытие технических полей)

Общее правило:
- не показывать в UI: `id`, `order_line_id`, `sale_line_id`, `user_id`, `source_id`, `return_target` codes;
- пользователь выбирает человекочитаемые значения, фронт маппит в backend поля.

## 7.1 Select options и загрузка
- `Клиент`: `GET /api/clients/?page_size=500`
- `Заявка`: `GET /api/orders/?page_size=500`
- `Продажа`: `GET /api/sales/?page_size=500`
- `Партия склада`: `GET /api/warehouse/batches/?page_size=500` (или `status=available` при необходимости)
- debounce поиска в select: 300ms (если используется remote search)

## 7.2 Disable-логика
- submit disabled если:
  - есть обязательные пустые поля;
  - строка с quantity <= 0;
  - идет запрос (`submitting=true`).
- кнопки статусных действий disabled при `busyId` строки.

## 7.3 Ошибки форм
- при `400/422`: показывать field-level ошибки под полями.
- при `409`: показывать конфликт состояния.
- при `403`: `Нет доступа`.
- при network: `Нет соединения с сервером`.

---

## 8. PAYLOAD MAPPING (UI -> backend)

## 8.1 Orders
- `Клиент` -> `client`
- `Дата` -> `date`
- `Источник` -> `source_type`
- `Комментарий` -> `comment`
- `Ответственный` -> `responsible_user_id`
- `Строки[].Товар` -> `lines[].product`
- `Строки[].Тип товара` -> `lines[].product_type`
- `Строки[].Количество` -> `lines[].ordered_quantity`
- `Строки[].Цена` -> `lines[].unit_price`
- `Строки[].Комментарий` -> `lines[].comment`

## 8.2 Sales
- `Клиент` -> `client`
- `Связанная заявка` -> `linked_order`
- `Дата` -> `date` и `sale_date`
- `Статус` -> `sale_status`
- `Номер накладной` -> `invoice_number`
- `Номер квитанции` -> `receipt_number`
- `Продажа брака` -> `is_defect_sale`
- `Строки[].Товар` -> `lines[].product`
- `Строки[].Количество` -> `lines[].quantity`
- `Строки[].Цена` -> `lines[].unit_price`
- `Строки[].Партия` -> `lines[].warehouse_batch`
- `Строки[].Форма` -> `lines[].stock_form`
- `Строки[].Связь со строкой заявки` -> `lines[].order_line`

## 8.3 Payments
- `Клиент` -> `client`
- `Связанная заявка` -> `linked_order`
- `Связанная продажа` -> `linked_sale`
- `Тип оплаты` -> `payment_type`
- `Способ` -> `payment_method`
- `Сумма` -> `amount`
- `Дата` -> `date`
- `Комментарий` -> `comment`

## 8.4 Returns
- `Продажа` -> `sale`
- `Дата` -> `date`
- `Причина` -> `return_reason`
- `Комментарий` -> `comment`
- `Строки[].Строка продажи` -> `lines[].sale_line`
- `Строки[].Товар` -> `lines[].product`
- `Строки[].Количество` -> `lines[].quantity`
- `Строки[].Куда` -> `lines[].return_target`
- `Строки[].Состояние` -> `lines[].condition_type`
- `Строки[].Комментарий` -> `lines[].comment`

## 8.5 Defects/Rework
- `Источник` -> `source_type`
- `ID источника` -> `source_id` (скрыто от пользователя, заполняется системой)
- `Продукт` -> `product`
- `Количество` -> `quantity_pcs` или `quantity_kg`
- `Причина` -> `defect_reason` / `writeoff_reason`
- `Статус` -> `status`
- `Комментарий` -> `comment`
- `Результирующая партия` -> `result_warehouse_batch_id`

---

## 9. WebSocket: поэкранное поведение

## 9.1 Orders
- События: `order`, `sale`, `payment`
- Refetch: список + открытая карточка
- Если открыт модал: показать `Данные обновлены`, не затирать несохраненные поля

## 9.2 Sales
- События: `sale`, `warehouse_batch`, `order`, `payment`, `return`
- Refetch: список + карточка
- При открытом edit-модале: маркер обновления + soft refresh после сохранения/закрытия

## 9.3 Payments
- События: `payment`, `sale`, `order`
- Refetch: список + summary карточки клиента + detail

## 9.4 Returns
- События: `return`, `defect_record`, `rework_request`, `sale`
- Refetch: список + detail

## 9.5 Defects/Rework
- Defects: `defect_record`, `sale`, `rework_request`
- Rework: `rework_request`, `defect_record`, `warehouse_batch`
- Refetch: список + detail соответствующей вкладки

---

## 10. Документы: endpoint / кнопка / fallback / ошибка

## 10.1 Заявка
- Кнопка: `Накладная` (список/карточка orders)
- Endpoint: `GET /api/orders/{id}/nakladnaya/`
- Fallback: если backend вернул пустой blob -> показать ошибку, не создавать fake-файл
- Ошибка: `Не удалось скачать накладную заявки`

## 10.2 Отгрузка
- Кнопка: `Накладная`
- Endpoint-порядок:
  1. `GET /api/sales/{id}/nakladnaya/`
  2. `GET /api/sales/{id}/waybill/`
  3. `GET /api/sales/{id}/invoice/`
- Fallback: локальный `nakladnaya-{id}-draft.html` (реализован)
- Ошибка: если все endpoint недоступны и fallback невозможен -> показать сообщение

## 10.3 Квитанция
- Кнопка: `Квитанция`
- Endpoint: `GET /api/sales/{id}/receipt/`
- Fallback: нет
- Ошибка: `Не удалось скачать квитанцию`

## 10.4 Возврат
- Кнопка: `Акт возврата` / `Накладная`
- Endpoint: `GET /api/returns/{id}/nakladnaya/`
- Fallback: нет
- Ошибка: `Не удалось скачать акт возврата`

---

## 11. Что нельзя делать в реализации

- Не добавлять новые backend endpoint.
- Не переименовывать backend поля в API payload.
- Не отправлять технические поля, которых нет в контракте.
- Не показывать внутренние id пользователю в таблицах и формах.

Документ завершен: по каждому экрану указаны route, endpoint, payload, действия, refetch и правила отображения.

