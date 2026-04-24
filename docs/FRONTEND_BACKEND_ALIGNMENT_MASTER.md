# FRONTEND ↔ BACKEND ALIGNMENT MASTER

> Дата: 24.04.2026  
> Источник: реальный код фронтенда (src/). Docs-папка была пустой — все данные только из кода.  
> Назначение: полный источник истины перед финальной подгонкой фронта под backend.

---

## 1. Общая картина

### Коммерческие разделы в коде

| Раздел | Маршрут | Флаг | Access key |
|---|---|---|---|
| Клиенты | /clients | STAGE2_TABS_ENABLED | clients |
| Заявки | /orders | STAGE2_TABS_ENABLED | client_orders |
| Продажи | /sales | STAGE2_TABS_ENABLED | sales |
| Оплаты | /payments | STAGE2_TABS_ENABLED | payments |
| Возвраты | /returns | STAGE2_TABS_ENABLED | returns |
| Брак | /defects | STAGE2_TABS_ENABLED | defects |
| Переделка | /rework-requests | STAGE2_TABS_ENABLED | **defects** (ошибка) |

`STAGE2_TABS_ENABLED = true` в `src/shared/config/constants.js` — все разделы активны.

### Какие разделы уже работают по API

- /clients — CRUD + история (GET clients/{id}/history/)
- /orders — CRUD + смена статуса + создание отгрузки + принятие оплаты + накладная
- /sales — CRUD + накладная (preview + скачать) + квитанция
- /payments — CRUD + сводка по клиенту
- /returns — CRUD + накладная возврата
- /defects — CRUD + send-to-rework + writeoff + sell
- /rework-requests — CRUD + complete

### Какие разделы устарели или не доделаны

- `/rework-requests` — маршрут привязан к access key `defects` вместо отдельного ключа
- Пагинация отсутствует на SalesPage, ReturnsPage, DefectsPage, PaymentsPage, ReworkRequestsPage
- Поиск отсутствует на SalesPage, PaymentsPage, ReturnsPage, DefectsPage, ReworkRequestsPage
- Качество (`quality`) на складе фильтруется CLIENT-SIDE, а не через query param к backend
- Клиентский финансовый блок (кредитный лимит, долг) отсутствует везде, кроме сводки в Payments

---

## 2. Полная карта экранов

### /orders — OrdersPage

- **Файл компонента**: `src/features/orders/components/OrdersPage/OrdersPage.jsx`
- **API helper**: `src/features/orders/api/ordersApi.js`
- **Вложенные компоненты** (в том же файле):
  - `OrderModal` — создание/редактирование заявки
  - `OrderDetailModal` — карточка заявки
  - `CreateShipmentFromOrderModal` — создание отгрузки из заявки
  - `AcceptPaymentModal` — приём оплаты по заявке
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['order', 'sale', 'payment']`
- **UI**: `ActionMenu`, `Badge`, `ConfirmModal`, `EmptyState`, `ErrorState`, `IntegerInput`, `Loading`, `Pagination`, `Select`

---

### /sales — SalesPage

- **Файл компонента**: `src/features/sales/components/SalesPage/SalesPage.jsx`
- **API helper**: `src/features/sales/api/salesApi.js`
- **Вложенные компоненты**:
  - `SaleModal` — создание/редактирование продажи (в том же файле)
  - `WaybillPreviewModal` — предпросмотр накладной (`WaybillPreviewModal.jsx`)
- **Config**: `src/features/sales/config/waybillConfig.js`
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['sale', 'warehouse_batch', 'order', 'payment', 'return']`

---

### /payments — PaymentsPage

- **Файл компонента**: `src/features/payments/components/PaymentsPage/PaymentsPage.jsx`
- **API helper**: `src/features/payments/api/paymentsApi.js`
- **Вложенные компоненты**:
  - `PaymentModal` — создание/редактирование оплаты (в том же файле)
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['payment', 'sale', 'order']`

---

### /returns — ReturnsPage

- **Файл компонента**: `src/features/returns/components/ReturnsPage/ReturnsPage.jsx`
- **API helper**: `src/features/returns/api/returnsApi.js`
- **Вложенные компоненты**:
  - `ReturnModal` — создание/редактирование возврата (в том же файле)
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['return', 'defect_record', 'rework_request', 'sale']`

---

### /defects — DefectsPage

- **Файл компонента**: `src/features/defects/components/DefectsPage/DefectsPage.jsx`
- **API helper**: `src/features/defects/api/defectsApi.js`
- **Вложенные компоненты**:
  - `DefectModal` — создание/редактирование (в том же файле)
  - Inline-модалки: writeoff, sell (через ConfirmModal с контентом)
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['defect_record', 'sale', 'rework_request']`

---

### /rework-requests — ReworkRequestsPage

- **Файл компонента**: `src/features/reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage.jsx`
- **API helper**: `src/features/reworkRequests/api/reworkRequestsApi.js`
- **Вложенные компоненты**:
  - `ReworkModal` — создание/редактирование (в том же файле)
  - Inline-модалка завершения переделки
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['rework_request', 'defect_record', 'warehouse_batch']`

---

### /clients — ClientsPage

- **Файл компонента**: `src/features/clients/components/ClientsPage/ClientsPage.jsx`
- **Вложенные компоненты**:
  - `ClientModal` — создание/редактирование (в том же файле)
  - `HistoryModal` — история клиента (в том же файле)
- **Hooks**: `useServerQuery`, `useDiscardOnClose`, `useDirtyFromBaseline`
- **WebSocket**: не подписан ни на один ресурс

---

### /warehouse — WarehousePage

- **Файл компонента**: `src/features/warehouse/components/WarehousePage/WarehousePage.jsx`
- **API helper**: `src/features/warehouse/api/warehouseApi.js`
- **Вложенные компоненты**:
  - `ReserveModal` — резерв партии (в том же файле)
  - `WarehouseBatchDetailModal` — карточка партии (в том же файле)
  - `PackFromOtkModal` — упаковка из ОТК (`../PackFromOtkModal.jsx`)
- **Hooks**: `useServerQuery`, `useOperationalRefetch`
- **WebSocket ресурсы**: `['warehouse_batch', 'production_batch', 'batch']`

---

### WebSocket (общий канал)

- **Файл провайдера**: `src/shared/realtime/OperationalRealtimeContext.jsx`
- **Файл hook**: `src/shared/realtime/useOperationalRefetch.js`
- **Файл URL builder**: `src/shared/realtime/buildOperationalWsUrl.js`
- **Константы**: `src/shared/realtime/operationalWsConstants.js`

---

### Документы / preview

- **Накладная продажи (preview)**: `src/features/sales/components/SalesPage/WaybillPreviewModal.jsx`
- **Скачивание накладной продажи + квитанции**: `src/features/sales/api/salesApi.js`
- **Скачивание накладной заявки**: `src/features/orders/api/ordersApi.js` → `downloadOrderWaybill`
- **Скачивание акта возврата**: `src/features/returns/api/returnsApi.js` → `downloadReturnWaybill`
- **Конфиг накладной**: `src/features/sales/config/waybillConfig.js`

---

## 3. По каждому экрану

---

### 3.1 /orders (OrdersPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `orders/` |
| Query params | `page`, `page_size=20`, `search`, `status` |
| Колонки | Номер, Дата, Клиент, Статус (Badge), Сумма, Оплачено, Осталось отгрузить |
| Фильтры | status (dropdown: все статусы / значения ORDER_STATUS_OPTIONS) |
| Поиск | Есть (text input → query.search) |
| Пагинация | Есть (компонент Pagination) |
| Действия в строке | Открыть, Редактировать, Создать отгрузку, Принять оплату, Накладная, Статус: {N}, Удалить |

**Поле "Осталось отгрузить"**: вычисляется на фронте через `getRemainingToShip()`. Приоритет: `order.remaining_to_ship` (поле от backend), иначе — сумма `(ordered_quantity - shipped_quantity)` по строкам заявки. Если backend отдаёт `remaining_to_ship` — работает правильно.

#### Карточка (OrderDetailModal)

- Открывается по кнопке "Открыть" в ActionMenu
- Загружает параллельно:
  - GET `orders/{orderId}/`
  - GET `sales/?page_size=200&linked_order={orderId}`
  - GET `payments/?page_size=200&linked_order={orderId}`
- Блоки: Общее (номер, дата, клиент, статус, сумма, оплачено), Строки заявки, Связанные отгрузки, Связанные оплаты
- Действия: Редактировать, Создать отгрузку, Принять оплату, Сменить статус (dropdown), Накладная

**Связанные отгрузки**: отображает `sale.sale_status` как текст через `statusLabel(o.status)` — но передаётся `sale.sale_status`, а variant у Badge вычисляется через `statusVariant(sale.sale_status)` который ищет статус в ORDER_STATUS_OPTIONS. Статусы продажи (draft, confirmed...) не входят в эту map — badge будет `variant='default'` для всех статусов продажи.

#### Создание / редактирование (OrderModal)

| Поле | Тип | Обязательность |
|---|---|---|
| Дата | date input | нет (по умолчанию сегодня) |
| Клиент | Select из clients/ | нет (можно без клиента) |
| Источник (source_type) | Select: cashier/manager/boss/other | нет |
| Комментарий | textarea | нет |
| Строки: Товар | text input | да |
| Строки: Тип товара | text input | нет |
| Строки: Количество | IntegerInput (min=1) | да |
| Строки: Цена | text input | нет |
| Строки: Комментарий | text input | нет |

**Payload CREATE/UPDATE**:
```json
{
  "client": 123,
  "date": "2026-04-24",
  "source_type": "manager",
  "comment": "...",
  "lines": [
    {
      "product": "Товар A",
      "product_type": "...",
      "ordered_quantity": 100,
      "unit_price": 50,
      "comment": "..."
    }
  ]
}
```

**Endpoint**: POST `orders/` / PATCH `orders/{id}/`

#### Действия

| Действие | Кнопка | Endpoint | Payload | Refetch |
|---|---|---|---|---|
| Смена статуса | "Статус: X" в ActionMenu | PATCH `orders/{id}/status/` | `{ status: "..." }` | да |
| Создать отгрузку | ActionMenu / карточка | POST `sales/` | см. ниже | да |
| Принять оплату | ActionMenu / карточка | POST `payments/` | см. ниже | да |
| Накладная | ActionMenu / карточка | GET `orders/{id}/nakladnaya/` | — | нет |
| Удалить | ActionMenu | DELETE `orders/{id}/` | — | да |

**Payload CreateShipmentFromOrderModal → POST sales/**:
```json
{
  "date": "2026-04-24",
  "sale_date": "2026-04-24",
  "sale_status": "draft",
  "client": 123,
  "linked_order": 456,
  "lines": [
    {
      "order_line": 789,
      "product": "Товар A",
      "quantity": 100,
      "unit_price": 50
    }
  ]
}
```

**Payload AcceptPaymentModal → POST payments/**:
```json
{
  "date": "2026-04-24",
  "client": 123,
  "linked_order": 456,
  "payment_type": "prepayment",
  "payment_method": "cash",
  "amount": 5000
}
```

**Backend-правила учтены**:
- Смена статуса через отдельный endpoint `/status/` — правильно
- `canEditOrder`: блокирует редактирование при status=closed/canceled — правильно
- `canCreateShipment`: только new/confirmed/in_progress/partially_shipped — правильно
- `canAcceptPayment`: new/confirmed/in_progress/partially_shipped/shipped — правильно

**Backend-правила НЕ учтены**:
- Нет проверки кредитного лимита перед созданием оплаты/отгрузки
- Нет проверки available_quantity перед созданием строк отгрузки
- Нет проверки на возможность закрытия заявки (order close restrictions)
- Статус меняется на любой из списка без серверных ограничений перехода

---

### 3.2 /sales (SalesPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `sales/` |
| Query params | `page=1`, `page_size=20` (фиксировано) |
| Колонки | Дата, Клиент, Номер, Заявка, Статус (текст без badge), Выручка, Оплачено |
| Фильтры | НЕТ |
| Поиск | НЕТ |
| Пагинация | НЕТ (компонент не рендерится) |
| Действия в строке | Редактировать, Накладная, Квитанция, Удалить |

#### Создание / редактирование (SaleModal)

| Поле | Тип | Обязательность | Примечание |
|---|---|---|---|
| Дата продажи | date input | нет | |
| Клиент | Select из clients/ | нет | |
| Связанная заявка | Select из orders/ | нет | |
| Статус продажи | Select (draft/confirmed/partially_shipped/shipped/closed/canceled) | нет | технический — пользователь меняет вручную |
| Номер накладной | text input | нет | технический — ручной ввод |
| Номер квитанции | text input | нет | технический — ручной ввод |
| Продажа брака | checkbox (is_defect_sale) | нет | технический |
| Комментарий | textarea | нет | |
| Строки: OrderLine ID | text input | нет | **технический — сырой ID виден пользователю** |
| Строки: Товар | text input | да | |
| Строки: Партия склада | Select из warehouse/batches/ | нет | |
| Строки: Форма склада | text input | нет | **технический** |
| Строки: Количество | text input | да | |
| Строки: Цена | text input | нет | |
| Строки: Комментарий | text input | нет | |

**Payload CREATE/UPDATE**:
```json
{
  "date": "2026-04-24",
  "sale_date": "2026-04-24",
  "sale_status": "draft",
  "client": 123,
  "linked_order": 456,
  "invoice_number": "НКЛ-001",
  "receipt_number": "КВТ-001",
  "is_defect_sale": false,
  "comment": "...",
  "lines": [
    {
      "id": 789,
      "order_line": 101,
      "product": "Товар A",
      "warehouse_batch": 202,
      "stock_form": "...",
      "quantity": 50,
      "unit_price": 100,
      "comment": "..."
    }
  ]
}
```

**Endpoint**: POST `sales/` / PATCH `sales/{id}/`

**Backend-правила НЕ учтены**:
- Нет проверки available_quantity партии склада перед сохранением
- Нет блокировки изменения статуса при несовместимом текущем статусе
- Нет проверки кредитного лимита
- Статус выставляется пользователем вручную — любой в любой момент

---

### 3.3 /payments (PaymentsPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `payments/` |
| Query params | `page=1`, `page_size=20`, `payment_type`, `client_id` |
| Колонки | Платеж (номер), Дата, Клиент, Тип, Способ, Сумма |
| Фильтры | client_id (dropdown), payment_type (dropdown) |
| Поиск | НЕТ |
| Пагинация | НЕТ (компонент не рендерится) |
| Действия в строке | Редактировать, Удалить |

**Сводка клиента**: при выборе клиента в фильтре загружается GET `payments/summary/?client_id={id}`.  
Показывается: total_paid_net, total_revenue, client_debt_money, client_advance_amount.

#### Создание / редактирование (PaymentModal)

| Поле | Тип | Обязательность |
|---|---|---|
| Дата | date input | нет |
| Клиент | Select из clients/ | нет |
| Связанная заявка | Select из orders/ | нет |
| Связанная продажа | Select из sales/ | нет |
| Тип оплаты | Select: prepayment/payment/surcharge/refund | нет |
| Способ оплаты | Select: cash/transfer/card/other | нет |
| Сумма | text input | да (> 0) |
| Комментарий | textarea | нет |

**Payload**:
```json
{
  "date": "2026-04-24",
  "client": 123,
  "linked_order": 456,
  "linked_sale": 789,
  "payment_type": "payment",
  "payment_method": "cash",
  "amount": 5000,
  "comment": "..."
}
```

**Backend-правила НЕ учтены**:
- Нет проверки кредитного лимита
- Нет проверки переплаты
- Нет ограничения суммы возврата (payment_type=refund) относительно оплаченного

---

### 3.4 /returns (ReturnsPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `returns/` |
| Query params | `page=1`, `page_size=20`, `sale_id` |
| Колонки | Возврат (номер), Дата, Продажа, Основание (return_reason), Комментарий |
| Фильтры | sale_id (dropdown из sales/) |
| Поиск | НЕТ |
| Пагинация | НЕТ |
| Действия в строке | Редактировать, Накладная, Удалить |

**Статус возврата**: не показывается в таблице вообще.

#### Создание / редактирование (ReturnModal)

| Поле | Тип | Обязательность |
|---|---|---|
| Продажа | Select из sales/ | да |
| Дата | date input | нет |
| Причина возврата | text input | нет |
| Комментарий | textarea | нет |
| Строки: Строка продажи | Select из sales/{id}/lines | нет |
| Строки: Товар | text input | да |
| Строки: Количество | IntegerInput min=1 | да |
| Строки: Куда вернуть | Select: warehouse/defect/rework | нет |
| Строки: Состояние | Select: good/damaged/defect | нет |
| Строки: Комментарий | text input | нет |

При выборе продажи автоматически загружаются строки: GET `sales/{id}/`

**Payload**:
```json
{
  "sale": 456,
  "date": "2026-04-24",
  "return_reason": "Брак",
  "comment": "...",
  "lines": [
    {
      "sale_line": 789,
      "product": "Товар A",
      "quantity": 10,
      "return_target": "warehouse",
      "condition_type": "good",
      "comment": "..."
    }
  ]
}
```

**Backend-правила НЕ учтены**:
- Нет проверки: количество возврата ≤ количество в строке продажи
- Нет проверки статуса продажи перед созданием возврата
- return_target='defect' → автосоздание DefectRecord на backend — фронт не уведомляет об этом пользователя
- return_target='rework' → автосоздание ReworkRequest на backend — фронт не уведомляет

---

### 3.5 /defects (DefectsPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `defects/` |
| Query params | `page=1`, `page_size=20`, `status` |
| Колонки | ID, Продукт, Количество (quantity_pcs), Источник (source_type), Статус, Причина |
| Фильтры | status (dropdown) |
| Поиск | НЕТ |
| Пагинация | НЕТ |
| Действия в строке | Редактировать, Передать на переработку, Продать брак, Списать, Удалить |

#### Создание / редактирование (DefectModal)

| Поле | Тип | Обязательность | Примечание |
|---|---|---|---|
| Источник | Select: otk/return | нет | |
| ID источника | text input (source_id) | нет | **технический — сырой ID** |
| Продукт | text input | да | |
| Количество (шт) | text input | да | |
| Коэффициент кг/ед. | text input (kg_coefficient) | нет | |
| Причина брака | text input | нет | |
| Статус | Select (all statuses) | нет | **технический — не должен быть редактируемым** |
| Комментарий | textarea | нет | |

**Payload**:
```json
{
  "source_type": "return",
  "source_id": 456,
  "product": "Товар A",
  "quantity_pcs": 20,
  "kg_coefficient": 0.5,
  "defect_reason": "Трещина",
  "status": "new",
  "comment": "..."
}
```

#### Действия

| Действие | Кнопка | Endpoint | Payload | Проверки на фронте |
|---|---|---|---|---|
| Передать на переработку | ActionMenu | POST `defects/{id}/send-to-rework/` | `{}` | НЕТ — всегда активна |
| Продать брак | ActionMenu | POST `defects/{id}/sell/` | `{ client_id, price, quantity, date }` | Нет проверки статуса |
| Списать | ActionMenu | POST `defects/{id}/writeoff/` | `{ writeoff_reason }` | Нет проверки статуса |
| Удалить | ActionMenu | DELETE `defects/{id}/` | — | Нет проверки статуса |

**Backend-правила НЕ учтены**:
- "Передать на переработку" доступна для записей с любым статусом (должна быть только при status=on_stock или new)
- "Продать брак" доступна без проверки статуса (должна быть только при status=on_stock)
- "Списать" доступна без проверки статуса
- `completeDefectRework` (POST `defects/{id}/complete-rework/`) экспортируется в API-файле, но нигде не вызывается в UI

---

### 3.6 /rework-requests (ReworkRequestsPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `rework-requests/` |
| Query params | `page=1`, `page_size=20`, `status` |
| Колонки | Переделка (номер), Продукт, Кг (quantity_kg), Статус, Результат batch (result_warehouse_batch_id — сырой ID) |
| Фильтры | status (dropdown) |
| Поиск | НЕТ |
| Пагинация | НЕТ |
| Действия в строке | Редактировать, Завершить |

#### Создание / редактирование (ReworkModal)

| Поле | Тип | Примечание |
|---|---|---|
| Return ID | text input (return_doc) | **технический — сырой ID** |
| Defect ID | text input (defect_record) | **технический — сырой ID** |
| Sale ID | text input (original_sale) | **технический — сырой ID** |
| Продукт | text input | |
| Количество кг | text input | |
| Статус | Select | **технический — не должен быть редактируемым вручную** |
| Комментарий | textarea | |

**Payload создания**:
```json
{
  "return_doc": 456,
  "defect_record": 789,
  "original_sale": 101,
  "product": "Товар A",
  "quantity_kg": 15.5,
  "status": "pending",
  "comment": "..."
}
```

**Завершение переделки**: POST `rework-requests/{id}/complete/`
```json
{ "result_warehouse_batch_id": 303 }
```

**Backend-правила НЕ учтены**:
- Кнопка "Завершить" активна для записей с любым статусом (должна быть только при status=in_progress)
- Нет проверки, что result_warehouse_batch реально существует

---

### 3.7 /clients (ClientsPage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `clients/` |
| Query params | `page=1`, `page_size=20`, `search` |
| Колонки | Клиент (name), Телефон, Контакт (contact_person), Продаж (sales_count), Сумма (sales_total), Статус (активен/неактивен) |
| Фильтры | НЕТ (только поиск) |
| Поиск | Есть |
| Пагинация | Через useServerQuery, но компонент Pagination не рендерится |
| Действия в строке | История, Удалить (только если clientCanDelete) |

`clientCanDelete`: блокирует удаление если `sales_count > 0` или `has_sales === true`.

#### Создание / редактирование (ClientModal)

| Поле | Тип | Обязательность |
|---|---|---|
| Название / компания | text input | да |
| Контактное лицо | text input | нет |
| Телефон | text input | нет |
| WhatsApp / Telegram | text input | нет |
| Email | email input | нет |
| Клиент активен | checkbox | нет |
| Доп. телефон | text input (в Collapse) | нет |
| Адрес | text input (в Collapse) | нет |
| Тип | text input (в Collapse) | нет |
| Комментарий | textarea (в Collapse) | нет |

Имеет `useDirtyFromBaseline` и `useDiscardOnClose` — предупреждение при закрытии с несохранёнными данными.

**Payload**: отправляет одновременно `contact_person` и `whatsapp_telegram` / `messenger` — дублирование полей.

#### История клиента (HistoryModal)

1. Пробует GET `clients/{id}/history/`
2. Если `items` пусты — фоллбэк: GET `sales/?page_size=200&client_id={id}`
3. Маппит продажи в `{ id, date, type: 'Продажа', description: 'Товар · N шт · X сом' }`

**Нет**: кредитного лимита, долга, аванса, финансовой сводки на карточке клиента.

---

### 3.8 /warehouse (WarehousePage)

#### Список

| Параметр | Значение |
|---|---|
| Endpoint | GET `warehouse/batches/` |
| Query params | `page=1`, `page_size=20`, `status`, `search`, `inventory_form` |
| Колонки | Статус, Качество, Продукт, Количество, Партия |
| Фильтры | status (available/reserved/shipped), inventory_form (unpacked/packed/open_package), quality (клиентский) |
| Поиск | Есть |
| Пагинация | Через useServerQuery (нет визуального компонента) |

**Фильтр quality**: выполняется CLIENT-SIDE через `readWarehouseQuality(b)` после получения данных от backend. Параметр `quality` НЕ передаётся в query params к API.

**Резерв**: POST `warehouse/batches/reserve/`
```json
{ "batch_id": 123, "quantity": 50, "sale_id": 456 }
```

Кнопка "Резерв" доступна только если `batch.status === 'available'` (из данных списка).

---

## 4. Полное соответствие frontend ↔ backend

| Backend сущность | Backend endpoint | Frontend экран/компонент | Статус | Проблема | Что надо исправить |
|---|---|---|---|---|---|
| Order | GET/POST/PATCH/DELETE `orders/` | OrdersPage / OrderModal | **частично** | Нет проверки close restrictions, нет проверки кредитного лимита | Добавить disable-логику по backend-статусам, проверку кредита |
| Order status | PATCH `orders/{id}/status/` | OrdersPage.onChangeStatus | **полностью** | — | — |
| OrderLine | в теле orders/ | OrderModal lines | **частично** | product — текстовая строка, нет привязки к реальному продукту из каталога | Нужен выбор продукта из каталога если backend требует |
| OrderReservation | не используется | нигде | **не совпадает** | Фронт не знает о ResERVATION-ресурсе | Нужен отдельный раздел или интеграция в карточку заявки |
| Sale | GET/POST/PATCH/DELETE `sales/` | SalesPage / SaleModal | **частично** | Нет фильтров, нет пагинации, нет проверки available_qty, статус меняется вручную | Добавить фильтры, пагинацию, убрать ручной статус |
| SaleLine | в теле sales/ | SaleModal lines | **частично** | OrderLine ID — техническое поле видно, stock_form — техническое | Скрыть технические поля, выбор товара через каталог |
| Payment | GET/POST/PATCH/DELETE `payments/` | PaymentsPage / PaymentModal | **частично** | Нет пагинации, нет поиска, нет проверки кредита | Добавить пагинацию, поиск, credit check |
| payments/summary | GET `payments/summary/` | PaymentsPage (summary block) | **частично** | Только при фильтре по клиенту, нет на карточке клиента | Вынести на карточку клиента |
| Return | GET/POST/PATCH/DELETE `returns/` | ReturnsPage / ReturnModal | **частично** | Нет статуса в таблице, нет проверки qty, нет пагинации | Добавить статус, проверку qty, пагинацию |
| ReturnLine | в теле returns/ | ReturnModal lines | **частично** | Нет проверки, что qty ≤ qty в SaleLine | Добавить валидацию |
| DefectRecord | GET/POST/PATCH/DELETE `defects/` | DefectsPage / DefectModal | **частично** | Все действия без статус-проверки, статус редактируется вручную, source_id — техническое поле | Disable-логика по статусам, скрыть технические поля |
| defects/send-to-rework | POST `defects/{id}/send-to-rework/` | DefectsPage ActionMenu | **частично** | Нет проверки статуса (всегда активна) | Включить только при status=new или on_stock |
| defects/complete-rework | POST `defects/{id}/complete-rework/` | нигде не используется | **не совпадает** | Endpoint экспортируется но не вызывается в UI | Добавить кнопку в DefectsPage |
| defects/writeoff | POST `defects/{id}/writeoff/` | DefectsPage ConfirmModal | **частично** | Нет проверки статуса | Включить только при status=on_stock |
| defects/sell | POST `defects/{id}/sell/` | DefectsPage ConfirmModal | **частично** | Нет проверки статуса, payload использует client_id а не client | Уточнить контракт, добавить статус-проверку |
| ReworkRequest | GET/POST/PATCH `rework-requests/` | ReworkRequestsPage / ReworkModal | **частично** | Технические поля видны, статус вручную, нет пагинации, "Завершить" всегда активна | Убрать техн. поля, disable-логика |
| rework-requests/complete | POST `rework-requests/{id}/complete/` | ReworkRequestsPage | **частично** | Нет статус-проверки | Включить только при status=in_progress |
| Client | GET/POST/PATCH/DELETE `clients/` | ClientsPage / ClientModal | **частично** | Дублирование полей в payload (whatsapp_telegram + messenger), нет пагинации (useServerQuery есть, Pagination нет) | Убрать дубли, добавить пагинацию |
| Client financial summary | `payments/summary/` | PaymentsPage только | **не совпадает** | Нет на карточке клиента | Добавить финансовую сводку в ClientModal/HistoryModal |
| WarehouseBatch available_quantity | GET `warehouse/batches/` | WarehousePage | **частично** | Количество берётся из `b.quantity ?? b.available_quantity` — оба поля без разграничения | Показывать available_quantity и reserved_quantity отдельно |
| WarehouseBatch quality filter | GET `warehouse/batches/` | WarehousePage | **не совпадает** | Quality фильтруется клиентски, не через API | Передавать quality как query param |
| warehouse/batches/reserve | POST `warehouse/batches/reserve/` | WarehousePage ReserveModal | **полностью** | — | — |
| Sale status endpoint | PATCH `orders/{id}/status/` | OrdersPage | **полностью** | Используется | — |
| credit limit | нет интеграции | нигде | **не совпадает** | Кредитный лимит не проверяется нигде | Добавить проверку перед созданием продажи/оплаты |
| force_credit_override | нет интеграции | нигде | **не совпадает** | Поле не используется | Добавить в форму платежа/продажи |
| reservation policy | нет интеграции | нигде | **не совпадает** | Нет логики sale without reservation | Уточнить у backend, внедрить |
| trace endpoint | нет интеграции | нигде | **не совпадает** | Трассировка не используется | Уточнить endpoint |
| OrderWaybill | GET `orders/{id}/nakladnaya/` | ordersApi.downloadOrderWaybill | **частично** | Файл скачивается с расширением .html жёстко прописанным | Определять расширение по Content-Type как в salesApi |
| SaleWaybill | GET `sales/{id}/nakladnaya/` (+ 2 фоллбэка) | salesApi.downloadSaleWaybill | **частично** | Пробует 3 URL; при недоступности генерирует локальный HTML-черновик | Убрать локальный черновик когда backend готов |
| SaleReceipt | GET `sales/{id}/receipt/` | salesApi.downloadSaleReceipt | **частично** | Нет снифф-логики — любой blob скачивается | Добавить sniff как в downloadSaleWaybill |
| ReturnWaybill | GET `returns/{id}/nakladnaya/` | returnsApi.downloadReturnWaybill | **частично** | Файл скачивается с расширением .html жёстко | Определять расширение по Content-Type |
| WebSocket /ws/operational/ | WS | OperationalRealtimeContext | **полностью** | Подключение, протокол, token auth — реализованы | — |

---

## 5. Все расхождения

### 5.1 Технические поля в пользовательских формах

| Поле | Файл | Форма | Что видит пользователь |
|---|---|---|---|
| `source_type` (cashier/manager/boss/other) | OrdersPage.jsx | OrderModal | Dropdown "Источник" |
| `OrderLine ID` | SalesPage.jsx | SaleModal / строки | Текстовый input с label "OrderLine ID" |
| `stock_form` | SalesPage.jsx | SaleModal / строки | Текстовый input "Форма склада" |
| `invoice_number` | SalesPage.jsx | SaleModal | Текстовый input — ручной ввод номера накладной |
| `receipt_number` | SalesPage.jsx | SaleModal | Текстовый input — ручной ввод номера квитанции |
| `is_defect_sale` | SalesPage.jsx | SaleModal | Checkbox "Продажа брака" |
| `source_id` | DefectsPage.jsx | DefectModal | Текстовый input "ID источника" |
| `status` (select) | DefectsPage.jsx | DefectModal | Dropdown всех статусов — пользователь вручную |
| `Return ID` | ReworkRequestsPage.jsx | ReworkModal | Текстовый input "Return ID" |
| `Defect ID` | ReworkRequestsPage.jsx | ReworkModal | Текстовый input "Defect ID" |
| `Sale ID` | ReworkRequestsPage.jsx | ReworkModal | Текстовый input "Sale ID" |
| `status` (select) | ReworkRequestsPage.jsx | ReworkModal | Dropdown всех статусов |
| `result_warehouse_batch_id` (raw) | ReworkRequestsPage.jsx | Таблица | Показывается как сырой ID |

---

### 5.2 Отсутствие пагинации

| Страница | Есть компонент Pagination | Есть page_size в queryState |
|---|---|---|
| OrdersPage | ДА | ДА |
| SalesPage | НЕТ | ДА (page_size=20 фиксировано) |
| PaymentsPage | НЕТ | ДА |
| ReturnsPage | НЕТ | ДА |
| DefectsPage | НЕТ | ДА |
| ReworkRequestsPage | НЕТ | ДА |
| ClientsPage | НЕТ | ДА |

---

### 5.3 Отсутствие поиска

| Страница | Поиск |
|---|---|
| OrdersPage | ДА |
| SalesPage | НЕТ |
| PaymentsPage | НЕТ |
| ReturnsPage | НЕТ |
| DefectsPage | НЕТ |
| ReworkRequestsPage | НЕТ |
| ClientsPage | ДА |

---

### 5.4 Статусы продажи в таблице без Badge

В SalesPage таблице статус выводится как `{statusLabel(s.sale_status)}` — просто текст, без компонента Badge.  
В OrderDetailModal связанные продажи показывают `<Badge variant={statusVariant(sale.sale_status)}>` — но `statusVariant` использует ORDER_STATUS_OPTIONS, в которых нет статусов sale (draft, confirmed и т.д.) → всегда `variant='default'`.

---

### 5.5 Действия без статус-блокировки

| Действие | Файл | Проблема |
|---|---|---|
| "Передать на переработку" | DefectsPage | Всегда активна, нет disabled по статусу |
| "Продать брак" | DefectsPage | Всегда активна, нет disabled по статусу |
| "Списать" | DefectsPage | Всегда активна, нет disabled по статусу |
| "Завершить" (переделка) | ReworkRequestsPage | Всегда активна, нет disabled по статусу |
| "Смена статуса" (заявка) | OrdersPage | Любой статус → любой без серверных ограничений |

---

### 5.6 Мёртвый код

- `completeDefectRework` в `src/features/defects/api/defectsApi.js` — экспортируется, но нигде не используется в компонентах.

---

### 5.7 Неверный access key для /rework-requests

В `AppRoutes.jsx` строка:
```jsx
<Route path="rework-requests" element={<ProtectedRoute requiredAccess="defects"><ReworkRequestsPage /></ProtectedRoute>} />
```
Используется `defects` вместо отдельного ключа. В `ACCESS_KEYS` нет ключа `rework_requests`. В сайдбаре (`navigation.js`) `/rework-requests` привязан к `accessKey='defects'` с label='Переделка'.

---

### 5.8 Качество склада: клиентская фильтрация

В `WarehousePage.jsx`:
```js
const rows = useMemo(() => {
  const raw = items || [];
  const q = queryState.quality;
  if (!q) return raw;
  return raw.filter((b) => readWarehouseQuality(b) === q);
}, [items, queryState.quality]);
```
`quality` не отправляется в GET `warehouse/batches/`. Т.е. backend отдаёт page_size=20 записей, и фронт фильтрует из них. Если все 20 — не того качества, пользователь видит пустой список, хотя данные есть.

---

### 5.9 Клиентский payload дублирует поля

В `ClientModal` payload отправляет:
```json
{
  "messenger": "...",
  "whatsapp_telegram": "..."
}
```
Оба поля одного и того же значения. Backend должен принять один из них — нужно согласовать с backend-контрактом.

---

### 5.10 Накладная заявки: жёсткое расширение .html

В `ordersApi.downloadOrderWaybill`:
```js
a.download = `order-waybill-${orderId}.html`;
```
Расширение захардкожено. Если backend вернёт PDF — файл сохранится как .html.

Аналогично в `returnsApi.downloadReturnWaybill`:
```js
a.download = `return-waybill-${returnId}.html`;
```

---

### 5.11 Sell defect: payload использует client_id

В DefectsPage `sellDefect` payload:
```js
{ client_id: Number(sellClient), price: ..., quantity: ..., date: ... }
```
Нужно уточнить у backend — если он ожидает `client` (а не `client_id`) — произойдёт 400.

---

### 5.12 CreateShipmentFromOrderModal: sale_status='draft' жёстко

```js
await apiClient.post('sales/', {
  ...
  sale_status: 'draft',
  ...
});
```
При создании отгрузки из заявки статус всегда `draft`. Нет возможности выбрать другой.

---

## 6. Технические поля и мусор

### Где видны техническими поля

| Поле / label | Экран | Форма/таблица | Нужное действие |
|---|---|---|---|
| "Источник" (cashier/manager/boss/other) | /orders | OrderModal | Скрыть или вынести в расширенные настройки |
| "OrderLine ID" | /sales | SaleModal, строки | Убрать label, ID должен проставляться автоматически |
| "Форма склада" (stock_form) | /sales | SaleModal, строки | Скрыть |
| "Номер накладной" (invoice_number) | /sales | SaleModal | Убрать — номер генерирует backend |
| "Номер квитанции" (receipt_number) | /sales | SaleModal | Убрать — номер генерирует backend |
| "Продажа брака" (is_defect_sale) | /sales | SaleModal | Убрать из создания — проставляется backend при source через return |
| "ID источника" (source_id) | /defects | DefectModal | Заменить на выбор из списка или скрыть |
| "Статус" (редактируемый select) | /defects | DefectModal | Убрать — статус должен меняться только через действия |
| "Return ID" | /rework-requests | ReworkModal | Заменить на выбор из списка возвратов |
| "Defect ID" | /rework-requests | ReworkModal | Заменить на выбор из списка брака |
| "Sale ID" | /rework-requests | ReworkModal | Заменить на выбор из списка продаж |
| "Статус" (редактируемый select) | /rework-requests | ReworkModal | Убрать — статус только через действия |
| "Результат batch" (raw ID) | /rework-requests | Таблица | Показывать название партии, не ID |

---

## 7. Статусы

### Order

| Статус | Backend code | Фронт label | Badge variant | Блокировка действий |
|---|---|---|---|---|
| new | new | Новая | default | Нет запрета редактирования ✓ |
| confirmed | confirmed | Подтверждена | primary | |
| in_progress | in_progress | В работе | primary | |
| partially_shipped | partially_shipped | Частично отгружена | warning | |
| shipped | shipped | Отгружена | success | |
| closed | closed | Закрыта | success | canEditOrder=false ✓ |
| canceled | canceled | Отменена | danger | canEditOrder=false ✓ |

Смена статуса: любой→любой без серверных ограничений перехода.

### Sale

| Статус | Backend code | Фронт label | Badge | Блокировка действий |
|---|---|---|---|---|
| draft | draft | Черновик | НЕТ (текст) | нет disable-логики |
| confirmed | confirmed | Подтверждена | НЕТ | нет |
| partially_shipped | partially_shipped | Частично отгружена | НЕТ | нет |
| shipped | shipped | Отгружена | НЕТ | нет |
| closed | closed | Закрыта | НЕТ | нет |
| canceled | canceled | Отменена | НЕТ | нет |

В `OrderDetailModal` связанные продажи показывают Badge но с неправильным variant (всегда default).

### DefectRecord

| Статус | Backend code | Фронт label | Badge | Блокировка действий |
|---|---|---|---|---|
| new | new | Новый | НЕТ (текст) | нет |
| on_stock | on_stock | На складе брака | НЕТ | нет |
| sent_to_rework | sent_to_rework | На переработке | НЕТ | нет |
| reworked | reworked | Переработан | НЕТ | нет |
| sold | sold | Продан | НЕТ | нет |
| written_off | written_off | Списан | НЕТ | нет |

Нет ни одного Badge. Нет ни одной disable-логики по статусу.

### ReworkRequest

| Статус | Backend code | Фронт label | Badge | Блокировка действий |
|---|---|---|---|---|
| pending | pending | Ожидает | НЕТ | нет |
| in_progress | in_progress | В работе | НЕТ | нет |
| completed | completed | Завершена | НЕТ | нет |
| canceled | canceled | Отменена | НЕТ | нет |

### Return

Статус не показывается в таблице вообще. Нет Badge. Нет disable-логики.

### WarehouseBatch

| Статус | Backend code | Фронт label | Badge |
|---|---|---|---|
| available | available | Доступно | inline span с классом badge--available |
| reserved | reserved | Зарезервировано | inline span badge--reserved |
| shipped | shipped | Продано | inline span badge--shipped |

Кнопка "Резерв" disabled если status !== 'available' — правильно.

---

## 8. WebSocket

### Общий канал

- URL: `ws://{host}/ws/operational/?token={jwt}`
- Файл: `src/shared/realtime/OperationalRealtimeContext.jsx`
- Протокол version: `1` (константа `OPERATIONAL_WS_PROTOCOL_VERSION`)
- Events принимаемые: `connected`, `change`
- Close code 4001 = token rejected → window.dispatchEvent('dias-operational-ws-token-rejected')
- Один провайдер на всё приложение

### Subscriptions по экранам

| Экран | Файл | Ресурсы |
|---|---|---|
| OrdersPage | OrdersPage.jsx | `['order', 'sale', 'payment']` |
| SalesPage | SalesPage.jsx | `['sale', 'warehouse_batch', 'order', 'payment', 'return']` |
| PaymentsPage | PaymentsPage.jsx | `['payment', 'sale', 'order']` |
| ReturnsPage | ReturnsPage.jsx | `['return', 'defect_record', 'rework_request', 'sale']` |
| DefectsPage | DefectsPage.jsx | `['defect_record', 'sale', 'rework_request']` |
| ReworkRequestsPage | ReworkRequestsPage.jsx | `['rework_request', 'defect_record', 'warehouse_batch']` |
| WarehousePage | WarehousePage.jsx | `['warehouse_batch', 'production_batch', 'batch']` |
| ClientsPage | ClientsPage.jsx | **нет подписки** |

### Где логика правильная

- OrdersPage: подписан на order+sale+payment — при изменении любого из них обновляется список заявок ✓
- SalesPage: широкая подписка — при изменении warehouse_batch тоже рефетчит ✓
- ReturnsPage: подписан на defect_record и rework_request (т.к. создание возврата с target=defect/rework создаёт их на backend) ✓
- ReworkRequestsPage: подписан на warehouse_batch (т.к. завершение переделки создаёт batch) ✓

### Где не хватает подписок

| Проблема | Описание |
|---|---|
| ClientsPage не подписан | Если продажа клиента изменилась — счётчик sales_count не обновится |
| PaymentsPage не подписан на 'return' | Возврат может изменить paid_amount клиента |
| OrdersPage не подписан на 'return' | Возврат может изменить paid_amount заявки |
| DefectsPage не подписан на 'return' | Возврат с target=defect создаёт DefectRecord |

### Риск рассинхрона

- `ClientsPage`: нет WS-подписки → данные о продажах и суммах устаревают без refetch
- `PaymentsPage` summary: загружается один раз при выборе клиента, не обновляется по WS

---

## 9. Документы

### Накладная заявки

- **Endpoint**: GET `orders/{id}/nakladnaya/`
- **Файл**: `src/features/orders/api/ordersApi.js` → `downloadOrderWaybill`
- **Расширение**: жёстко `.html` (`a.download = 'order-waybill-{id}.html'`)
- **Нет sniff-логики**: любой blob скачивается как .html
- **Нет preview**: только скачивание
- **Нет печати**: нет

### Накладная продажи (download)

- **Endpoints пробует поочерёдно**: `sales/{id}/nakladnaya/`, `sales/{id}/waybill/`, `sales/{id}/invoice/`
- **Файл**: `src/features/sales/api/salesApi.js` → `downloadSaleWaybill`
- **Sniff-логика**: определяет PDF/XLSX/HTML/JSON-ошибку по байтам — есть ✓
- **Расширение**: из Content-Disposition или по sniff ✓
- **Фоллбэк**: если все 3 URL вернули 404/405 или не PDF — генерирует локальный HTML-черновик с данными из snapshot
- **Локальный черновик**: содержит Продажа №, Дата, Клиент, Партия, Количество, Выручка, Себестоимость, Прибыль — только поля из snapshot объекта

### Накладная продажи (preview)

- **Компонент**: `src/features/sales/components/SalesPage/WaybillPreviewModal.jsx`
- **Загружает**: GET `sales/{id}/`
- **Рендерит**: 2 копии `WaybillCopy` — расходная накладная в виде таблицы
- **Поставщик**: захардкожен в `waybillConfig.js` — `ОсОО DIAS LINE`, телефон `+996 000 00 00 00` (placeholder!)
- **Поля накладной**: Дата, Поставщик, Покупатель (client_name), строки (product/unit/quantity/unit_price/sum), Итого, подписи
- **Кнопки**: Закрыть, Скачать (→ downloadSaleWaybill), Печать (→ window.print())
- **Номер накладной**: `sale.invoice_number ?? sale.sale_number ?? sale.id`

### Квитанция

- **Endpoint**: GET `sales/{id}/receipt/`
- **Файл**: `src/features/sales/api/salesApi.js` → `downloadSaleReceipt`
- **Нет sniff-логики**: blob скачивается без проверки
- **Расширение**: из Content-Disposition или pdf/html по Content-Type

### Акт возврата

- **Endpoint**: GET `returns/{id}/nakladnaya/`
- **Файл**: `src/features/returns/api/returnsApi.js` → `downloadReturnWaybill`
- **Расширение**: жёстко `.html`
- **Нет preview**: только скачивание
- **Нет sniff-логики**

### Что не сделано

- Нет документа для ReworkRequest
- Нет документа для DefectRecord
- Телефон поставщика в накладной — placeholder
- Нет preview для накладной заявки и акта возврата

---

## 10. Блокировки и бизнес-правила backend

| Правило | Статус | Где в коде | Что надо доделать |
|---|---|---|---|
| hard credit limit | **НЕ учтено** | нигде | Перед POST sales/ и POST payments/ проверять лимит через backend |
| force_credit_override | **НЕ учтено** | нигде | Поле для override при превышении лимита |
| available_quantity из backend | **НЕ учтено** | нигде | Перед сохранением SaleLine проверять available_quantity партии |
| sale status через status endpoint | **учтено частично** | PATCH orders/{id}/status/ используется, но для sale статус меняется через PATCH sales/{id}/ напрямую | Для Sale тоже нужен отдельный status endpoint если backend требует |
| order close restrictions | **НЕ учтено** | canEditOrder только по closed/canceled | Нет проверки, что заявку можно закрыть (все строки отгружены?) |
| reservation fulfillment logic | **НЕ учтено** | нигде | Нет отображения reservation status по строкам заявки |
| sale without reservation policy | **НЕ учтено** | нигде | Нет предупреждения при продаже без резерва |
| trace data | **НЕ учтено** | нигде | Нет использования trace endpoint |
| DefectRecord status transitions | **НЕ учтено** | все действия без disable | Disable кнопок по текущему статусу |
| ReworkRequest status transitions | **НЕ учтено** | "Завершить" всегда активна | Disable "Завершить" если status != in_progress |
| Return qty ≤ SaleLine qty | **НЕ учтено** | ReturnModal нет валидации | Добавить проверку |

---

## 11. Пошаговый план подгонки фронта под backend

### Этап 1 — Orders

**Файлы**: `src/features/orders/components/OrdersPage/OrdersPage.jsx`, `src/features/orders/api/ordersApi.js`

**Что менять**:
1. `downloadOrderWaybill` — убрать жёсткое расширение `.html`, добавить sniff-логику как в `salesApi.downloadSaleWaybill`
2. В `OrderDetailModal` связанные продажи: заменить `statusVariant(sale.sale_status)` на отдельную map для статусов Sale, добавить Badge с правильными variant
3. `CreateShipmentFromOrderModal` — убрать жёсткий `sale_status: 'draft'`, дать пользователю выбор или убрать поле
4. `OrderModal` — уточнить нужен ли `source_type` пользователю, если нет — скрыть
5. Добавить disable-логику смены статуса по разрешённым переходам (если backend даёт список allowed transitions)
6. Добавить `OrderReservation` в карточку заявки — если backend возвращает reservations в GET orders/{id}/

**Результат**: Заявки полностью соответствуют backend-контракту, документ скачивается правильно.

---

### Этап 2 — Sales

**Файлы**: `src/features/sales/components/SalesPage/SalesPage.jsx`, `src/features/sales/api/salesApi.js`, `src/features/sales/config/waybillConfig.js`

**Что менять**:
1. Добавить фильтры в SalesPage: по клиенту, по статусу, по дате
2. Добавить поиск (search input)
3. Добавить компонент Pagination
4. В SaleModal убрать технические поля:
   - Убрать label "OrderLine ID" (или скрыть — ID проставлять автоматически)
   - Убрать `stock_form`
   - Убрать `invoice_number` и `receipt_number` из формы (генерируются backend)
   - Убрать `is_defect_sale` из формы
5. Добавить Badge для статуса Sale в таблице
6. Заменить телефон поставщика в `waybillConfig.js` (сейчас placeholder `+996 000 00 00 00`)
7. Убрать локальный HTML-черновик из `downloadSaleWaybill` когда backend готов, или оставить явную пометку
8. Добавить проверку available_quantity при выборе партии склада в SaleLine
9. Добавить блокировку статуса Sale (не давать вручную менять — или убрать поле из формы)

**Результат**: Продажи: читаемый список с фильтрами, форма без мусора, правильные статусы.

---

### Этап 3 — Payments

**Файлы**: `src/features/payments/components/PaymentsPage/PaymentsPage.jsx`, `src/features/payments/api/paymentsApi.js`

**Что менять**:
1. Добавить поиск
2. Добавить компонент Pagination
3. Добавить credit limit check перед созданием оплаты (запрос к backend или из данных клиента)
4. Перенести сводку клиента (`payments/summary/`) на карточку клиента в ClientsPage

**Результат**: Оплаты с пагинацией и поиском, кредитный контроль.

---

### Этап 4 — Returns

**Файлы**: `src/features/returns/components/ReturnsPage/ReturnsPage.jsx`, `src/features/returns/api/returnsApi.js`

**Что менять**:
1. Добавить поиск
2. Добавить компонент Pagination
3. Добавить колонку "Статус" в таблицу с Badge
4. Добавить валидацию: quantity в строке возврата ≤ quantity в SaleLine
5. Уведомлять пользователя что при `return_target=defect` создаётся запись брака, при `return_target=rework` — переделка
6. `downloadReturnWaybill` — убрать жёсткое расширение `.html`, добавить sniff-логику

**Результат**: Возвраты с пагинацией, правильными статусами, без потери данных.

---

### Этап 5 — Defects / Rework

**Файлы**: `src/features/defects/components/DefectsPage/DefectsPage.jsx`, `src/features/defects/api/defectsApi.js`, `src/features/reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage.jsx`

**Что менять — Defects**:
1. Добавить поиск и Pagination
2. Добавить Badge для статусов
3. Добавить disable-логику для действий по статусу:
   - "Передать на переработку" — только при status=new или on_stock
   - "Продать брак" — только при status=on_stock
   - "Списать" — только при status=on_stock
4. Убрать из DefectModal: поле `source_id` (техническое) → заменить на выбор из списка, поле `status` (не редактируется вручную)
5. Добавить кнопку для `defects/{id}/complete-rework/` (endpoint существует, не используется)
6. Уточнить payload `defects/{id}/sell/` — `client_id` или `client`

**Что менять — ReworkRequests**:
1. Добавить поиск и Pagination
2. Добавить Badge для статусов
3. Disable "Завершить" если status != in_progress
4. Убрать из ReworkModal: поля "Return ID", "Defect ID", "Sale ID" → заменить на выбор из списков, поле `status`
5. В таблице колонку "Результат batch": показывать название партии, а не сырой ID
6. Исправить access key для `/rework-requests` с `defects` на правильный (если backend имеет отдельный ключ)

**Результат**: Брак и переделка с правильной бизнес-логикой, без технических полей.

---

### Этап 6 — Client financial view

**Файлы**: `src/features/clients/components/ClientsPage/ClientsPage.jsx`

**Что менять**:
1. Добавить компонент Pagination в ClientsPage
2. Добавить WS-подписку: `useOperationalRefetch(['sale', 'payment', 'order'], refetch)`
3. Перенести финансовую сводку клиента (сейчас только в PaymentsPage) в HistoryModal или в ClientModal
4. Убрать дублирование полей в payload: либо `messenger`, либо `whatsapp_telegram` (согласовать с backend)
5. Добавить отображение кредитного лимита на карточке клиента если backend возвращает его

**Результат**: Клиенты с актуальными финансовыми данными в реальном времени.

---

### Этап 7 — WebSocket / sync polishing

**Файлы**: `src/features/clients/components/ClientsPage/ClientsPage.jsx`, `src/features/payments/components/PaymentsPage/PaymentsPage.jsx`, `src/features/orders/components/OrdersPage/OrdersPage.jsx`

**Что менять**:
1. `ClientsPage` — добавить `useOperationalRefetch`
2. `PaymentsPage` — добавить `'return'` в список ресурсов
3. `OrdersPage` — добавить `'return'` в список ресурсов
4. `PaymentsPage` summary — обновлять при WS-событии payment/return
5. Проверить: при backend-отправке `resource='batch'` — warehouse refetch срабатывает (есть 'batch' в подписке) ✓

**Результат**: Данные синхронизируются корректно без ручного обновления.

---

### Этап 8 — Documents / final cleanup

**Файлы**: `src/features/orders/api/ordersApi.js`, `src/features/returns/api/returnsApi.js`, `src/features/sales/config/waybillConfig.js`

**Что менять**:
1. `downloadOrderWaybill` — снифф + правильное расширение (полная реализация как в `downloadSaleWaybill`)
2. `downloadReturnWaybill` — то же самое
3. `downloadSaleReceipt` — добавить sniff-логику
4. `waybillConfig.js` — заменить placeholder телефона на реальный
5. Решить: убирать ли локальный HTML-черновик накладной продажи (после того как backend стабильно отдаёт файл)
6. Добавить preview для накладной заявки (как WaybillPreviewModal для продажи) если нужно
7. Добавить preview для акта возврата если нужно

**Результат**: Документы корректно скачиваются с backend, нет захардкоженных данных.

---

## 12. Что трогать нельзя

### Части фронта, которые уже нормальные

| Что | Файл | Почему нормально |
|---|---|---|
| WS-провайдер и протокол | OperationalRealtimeContext.jsx | Полная реализация: token auth, reconnect, protocol version check, event filtering |
| useOperationalRefetch | useOperationalRefetch.js | Правильная подписка через Set |
| apiClient interceptors | shared/api/client.js | 401 → logout, 403/409/429 → userMessage, X-Request-Id для mutations, X-Audit-Shift-Id |
| getApiErrorMessage | shared/lib/apiError.js | Нормализация всех форматов ошибок API |
| PATCH orders/{id}/status/ | OrdersPage.jsx | Правильный отдельный endpoint для смены статуса |
| Reserve warehouse batch | WarehousePage.jsx | POST warehouse/batches/reserve/ с правильным payload |
| ClientModal dirty tracking | ClientsPage.jsx | useDirtyFromBaseline + useDiscardOnClose |
| WaybillPreviewModal | WaybillPreviewModal.jsx | Preview + print + download — архитектурно правильно |
| downloadSaleWaybill sniff | salesApi.js | Детальный sniff PDF/XLSX/HTML/JSON + 3-URL fallback |

### Backend-контракты, которые нельзя обходить

1. Смена статуса заявки — только через PATCH `orders/{id}/status/`, никогда через PATCH `orders/{id}/`
2. Резерв партии — только через POST `warehouse/batches/reserve/`, а не прямым обновлением batch
3. Действия с браком (send-to-rework, writeoff, sell) — только через action endpoints, не через PATCH `defects/{id}/`
4. Завершение переделки — только через POST `rework-requests/{id}/complete/`, не через PATCH
5. WS-токен — только из localStorage('token'), не из другого источника

### Где нельзя делать frontend-вычисления вместо backend

1. **available_quantity** — не вычислять на фронте из batch.quantity - reserved. Брать с backend
2. **paid_amount заявки** — не суммировать payments вручную. Брать `order.paid_amount` с backend
3. **remaining_to_ship** — приоритет `order.remaining_to_ship` от backend. Фронтовый расчёт `getRemainingToShip()` — только фоллбэк
4. **total_amount заявки** — не суммировать строки вручную. Отображать `order.total_amount` от backend
5. **client_debt_money, client_advance_amount** — только из `payments/summary/`, не вычислять на фронте
6. **sale status** — не менять напрямую через PATCH если backend имеет отдельный status endpoint
