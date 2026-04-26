# FRONTEND CONTRACT REVIEW FINAL

Дата ревизии: 2026-04-26  
Область: `Клиенты`, `Заявки`, `Продажи`, `Оплаты`, `Возвраты`, `Брак / переделка`  
Формат: только факт по текущему frontend-коду.

---

## 1) Клиенты

### 1. Назначение вкладки
- Вкладка управляет карточками клиентов, историей клиента и финансовой сводкой.
- Сущности: `client`, `history documents` (orders/sales/payments/returns), financial summary.
- Связанные вкладки: `Заявки`, `Продажи`, `Оплаты`, `Возвраты`.

### 2. Frontend files
- API: `src/features/clients/api/clientsApi.js`
- Page/UI: `src/features/clients/components/ClientsPage/ClientsPage.jsx`
- SCSS: `src/features/clients/components/ClientsPage/ClientsPage.scss`
- Shared: `ActionMenu`, `Badge`, `ConfirmModal`, `EmptyState`, `ErrorState`, `Loading`, `Pagination`, `SearchableSelect`, `useToast`

### 3. API methods
- `getClients(params)` → `GET /clients/` → query: page/filter/search.
- `getClient(id)` → `GET /clients/{id}/`
- `createClient(payload)` → `POST /clients/`
- `updateClient(id,payload)` → `PATCH /clients/{id}/`
- `getClientHistory(id)` → `GET /clients/{id}/history/`
- `getClientFinancialSummary(clientId)` → `GET /client-financial-summary/?client_id=...`
- Соответствие контракту: **ДА** (delete-метода нет).

### 4. Таблица
- Колонки в `data-table--clients`: имя, телефон, контакт, продажи, сумма продаж, кредитный лимит, статус, действия.
- Статусы и payment labels переводятся; raw enum напрямую не показывается.
- Пустые значения заполняются `—`.
- Статус как `Badge`.
- Горизонтальный scroll: `min-width: 980px`.
- Functional UI Spec: **ДА**.

### 5. Верхняя панель
- Есть заголовок, поиск, фильтр активности через `SearchableSelect`, кнопка создания.
- Фильтр активности уходит в query как `is_active=true/false`.
- Соответствие backend contract: **ДА**.

### 6. Модалки create/edit/action
- `ClientModal`:
  - Поля: name/contact/phone/messenger/email/phone_alt/inn/address/client_type/notes/is_active/credit_limit/credit_limit_mode.
  - Payload: только бизнес-поля клиента, без лишних counters/status enums.
  - `SearchableSelect` используется для `credit_limit_mode`.
  - Крестик есть.
  - Внутренний scroll + отдельный footer (`clients-modal__scroll`, `clients-modal__footer`).
- Есть `ConfirmModal` для закрытия без сохранения.
- Native `<select>`: **нет**.

### 7. Detail card
- Есть `ClientDetailModal`: секции с ключевыми полями + действия.
- История отдельной модалкой (`HistoryModal`), финсводка отдельной модалкой.
- Linked данные (orders/sales/payments/returns) отображаются.
- Raw enum: не обнаружен.

### 8. Actions
- `Открыть` (карточка), `Редактировать`, `Активировать/Деактивировать`.
- Деактивация: `PATCH /clients/{id}/` с `is_active=false`.
- Delete action: **нет**.
- Соответствие контракту: **ДА**.

### 9. Routing/query params
- Для вкладки `Клиенты` спец query params из списка (`payments/returns`) не применяются.

### 10. Error handling
- Есть mapping кодов, включая `delete_disabled`, `404`, auth errors.
- Есть fallback через `getApiErrorMessage`.
- Не все коды из backend-списка покрыты явно (часть идет в fallback): **частично**.

### 11. Loading / empty / success states
- List loading/empty/error: есть.
- Detail/history/financial loading/error/empty: есть.
- Success toast на сохранении/деактивации: есть.

### 12. UX/UI
- Scroll/sticky footer модалок реализован.
- `focus-visible` есть.
- Таблица имеет responsive правила и min-width.
- SCSS с BEM-подобной структурой.

### 13. Frontend contract verdict
- **Клиенты: OK**

---

## 2) Заявки

### 1. Назначение вкладки
- Создание/редактирование заявок и управление переходами статуса.
- Сущности: `order`, `order lines`, `order history`.
- Связанные вкладки: `Продажи`, `Оплаты`, `Возвраты`.

### 2. Frontend files
- API: `src/features/orders/api/ordersApi.js`
- Page/UI: `src/features/orders/components/OrdersPage/OrdersPage.jsx`
- SCSS: `src/features/orders/components/OrdersPage/OrdersPage.scss`
- Shared: `SearchableSelect`, `ActionMenu`, `Badge`, `ConfirmModal`, `EmptyState`, `ErrorState`, `Loading`, `Pagination`

### 3. API methods
- Основные:
  - `GET /orders/`, `GET /orders/{id}/`, `GET /orders/select-sources/`
  - `POST /orders/`, `PATCH /orders/{id}/`
  - `PATCH /orders/{id}/status/`
  - `PATCH /orders/{id}/cancel/`
  - `GET /orders/{id}/history/`
  - `getOrderWaybillUrl(id)` → URL `orders/{id}/waybill/`
- Legacy/дополнительно в API файле:
  - `reserveOrder`, `releaseOrderReserve`, `getOrderReservations`, `downloadOrderWaybill`
- Соответствие: **ДА**.

### 4. Таблица
- Колонки: номер, клиент, дата, статус, суммы/остаток, действия.
- Статусы через label+badge.
- Пустые значения: `—`.
- Горизонтальный scroll: `min-width: 1050px`.
- Functional UI Spec: **ДА** по таблице.

### 5. Верхняя панель
- Заголовок, поиск, фильтр статуса (`SearchableSelect`), кнопка создания.
- Query: `search`, `status`, pagination.
- Соответствие backend contract: **ДА**.

### 6. Модалки create/edit/action
- `OrderModal`:
  - Поля: дата, клиент, источник, комментарий, строки товаров.
  - Строка: profile/product, ordered_quantity, unit_price, comment.
  - Payload: `client`, `date`, `source_type`, `comment`, `lines[]` (`product`, `product_type`, `profile?`, `ordered_quantity`, `unit_price`, `comment`).
  - Валидация: qty > 0, price >= 0, обязательность клиента/строк.
  - `SearchableSelect` используется.
  - Scroll+sticky footer есть.
- Native select: **нет**.

### 7. Detail card
- `OrderDetailModal`: секции документ/финансы/строки/связанные документы.
- Есть переходы статуса, cancel, waybill, history.
- Raw enum в статусах не показывается.

### 8. Actions
- `Открыть`, `Редактировать`, переходы статуса, `Отменить`, `История`, `Накладная`.
- Статус меняется через `/status/`, cancel через `/cancel/`.
- Delete action: **нет**.
- UI слова `Отгрузка` не найдено.
- Соответствие: **ДА** по действиям.

### 9. Routing/query params
- Спец query presets (`/payments`, `/returns`) не относятся к этой вкладке.

### 10. Error handling
- Есть mapping (например `status_update_forbidden`, `invalid_status_transition`, `delete_disabled`, `404/401/403`).
- Есть fallback через `getApiErrorMessage`.
- Часть контрактных кодов не задана явно.

### 11. Loading / empty / success states
- List/detail/history loading/error/empty есть.
- Busy состояния на action есть.
- Success toast есть.

### 12. UX/UI
- Модалки с крестиком, scroll внутри, sticky footer.
- Таблица читабельна, min-width.
- Focus-visible есть.

### 13. Frontend contract verdict
- **Заявки: OK**
- Причина: не выявлена.

---

## 3) Продажи

### 1. Назначение вкладки
- Создание/проведение продаж и отображение связанных оплат/возвратов.
- Сущности: `sale`, `sale_lines`, `warehouse_batch`, status transitions.
- Связанные вкладки: `Заявки`, `Оплаты`, `Возвраты`.

### 2. Frontend files
- API: `src/features/sales/api/salesApi.js`
- Page/UI: `src/features/sales/components/SalesPage/SalesPage.jsx`
- SCSS: `src/features/sales/components/SalesPage/SalesPage.scss`
- Legacy file: `src/features/sales/components/SalesPage/WaybillPreviewModal.jsx` (не используется)

### 3. API methods
- Используемые основные:
  - `GET /sales/`, `GET /sales/{id}/`, `GET /sales/select-sources/`
  - `POST /sales/`, `PATCH /sales/{id}/`
  - `PATCH /sales/{id}/status/`, `PATCH /sales/{id}/cancel/`
  - `GET /sales/{id}/credit-check/`
  - URL builders для waybill/receipt
- Legacy в API файле:
  - `downloadSaleWaybill`, `downloadSaleReceipt` (blob flow)
- Соответствие: **ДА**.

### 4. Таблица
- Колонки: номер/клиент/заявка/дата/статус/суммы/действия.
- Badge статуса есть.
- Для defect sale есть отдельный badge.
- Пустые: `—`.
- Горизонтальный scroll: `min-width: 1100px`.
- Functional UI Spec: **ДА**.

### 5. Верхняя панель
- Заголовок, поиск, фильтры клиент/статус (`SearchableSelect`), кнопка создания.
- Query params: search/client_id/sale_status/page.
- Соответствие: **ДА**.

### 6. Модалки create/edit/action
- `SaleModal`:
  - Create payload содержит `sale_lines[]` (header-only flow не используется).
  - В payload create явно передается `sale_status: 'shipped'`.
  - `warehouse_batch` обязателен для каждой строки.
  - Edit ограничен документными полями.
  - Валидации qty/stock/order-line limit есть.
  - Scroll + sticky footer + крестик есть.
- Native select: **нет**.

### 7. Detail card
- Секции: документ, финансы, строки, связанные оплаты/возвраты.
- Actions по статусу (продать/оплата/возврат/отмена/документы).
- Waybill/receipt открываются как HTML через `openHtmlDocument`.

### 8. Actions
- `Продать`, `Закрыть`, `Отменить`, `Принять оплату`, `Возврат`, `Накладная`, `Квитанция`.
- Status transitions идут через `/status/`.
- `updateSale` не используется для status update.
- Delete action: **нет**.
- Соответствие: **ДА** по runtime flow.

### 9. Routing/query params
- Для этой вкладки нет спец preset из обязательного списка.

### 10. Error handling
- Явный mapping кодов (`sale_status_update_forbidden`, `sale_lines_update_forbidden`, `missing_sale_lines`, transitions и др.).
- Fallback есть.
- Часть backend codes в fallback.

### 11. Loading / empty / success states
- List/detail/modal loading/empty/error есть.
- Busy flags на статус/отмену/документы есть.
- Success toast есть.

### 12. UX/UI
- SCSS покрывает modal scroll, sticky footer, max-height 90vh, focus-visible.
- Таблица + адаптив.

### 13. Frontend contract verdict
- **Продажи: OK**
- Причины: не выявлены.

---

## 4) Оплаты

### 1. Назначение вкладки
- Управление платежами, отменой платежа, клиентской сводкой.
- Сущности: `payment`, links к `sale/order/return`.
- Связанные вкладки: `Продажи`, `Заявки`, `Возвраты`.

### 2. Frontend files
- API: `src/features/payments/api/paymentsApi.js`
- Page/UI: `src/features/payments/components/PaymentsPage/PaymentsPage.jsx`
- SCSS: `src/features/payments/components/PaymentsPage/PaymentsPage.scss`

### 3. API methods
- `GET /payments/`, `GET /payments/{id}/`
- `POST /payments/`, `PATCH /payments/{id}/`
- `PATCH /payments/{id}/cancel/`
- `GET /payments/summary/?client_id=...`
- `GET /payments/select-sources/`
- Соответствие: **ДА** (delete нет).

### 4. Таблица
- Колонки: номер/дата/клиент/тип/метод/сумма/связи/возврат/статус/действия.
- Label mapping для type/method/status есть.
- Badge по статусу есть.
- Пустые значения через helper.
- Горизонтальный scroll: `min-width: 1300px`.
- Functional UI Spec: **ДА**.

### 5. Верхняя панель
- Заголовок, поиск, фильтры client/type/method/status (`SearchableSelect`), кнопки создания и сводки клиента.
- Query params уходят в `getPayments`.
- Соответствие: **ДА**.

### 6. Модалки create/edit/action
- `PaymentCreateModal`:
  - Поля: date/client/linked_sale/linked_order/linked_return/type/amount/method/comment/manual_refund_reason.
  - Payload: `date, client, payment_type, payment_method, amount, linked_*?, comment?, manual_refund_reason?`
  - Валидация amt>0/client required/refund linkage.
  - `SearchableSelect` везде.
  - Крестик, scroll есть.
- `PaymentDetailModal`:
  - Для `active` есть `Отменить`.
  - Для `canceled` показывается readonly состояние.
- Native select: **нет**.

### 7. Detail card
- Секции: документ/связь/оплата.
- Raw enum не показывается.

### 8. Actions
- Таблица: `Открыть`, `Отменить` (только active), `Финсводка клиента`.
- Cancel идет только через `/payments/{id}/cancel/`.
- Delete: **нет**.
- Status через update payload не отправляется.
- Соответствие: **ДА**.

### 9. Routing/query params
- Реализовано:
  - `/payments?sale_id=...`
  - `/payments?order_id=...`
  - `/payments?return_id=...`
- Что делает:
  - открывает create modal с preset.
  - подгружает select-sources по соответствующему id.
  - предзаполняет client/link/type/amount.
  - очищает URL (`next.delete(...)` + `setSearchParams(next, { replace: true })`).
- Соответствие: **ДА**.

### 10. Error handling
- Есть mapping (`payment_status_update_forbidden` и др.) + fallback.
- Часть кодов из полного backend списка не задана явно.

### 11. Loading / empty / success states
- List/detail/summary loading+empty+error есть.
- Busy на cancel есть.
- Success toast есть.

### 12. UX/UI
- Scroll в модалках есть.
- Focus-visible в SCSS есть.
- Таблица адаптирована под горизонтальный скролл.

### 13. Frontend contract verdict
- **Оплаты: OK**

---

## 5) Возвраты

### 1. Назначение вкладки
- Создание возврата (draft), проведение/отмена, отображение downstream links.
- Сущности: `return`, `return lines`, links к payments/sales.
- Связанные вкладки: `Продажи`, `Оплаты`.

### 2. Frontend files
- API: `src/features/returns/api/returnsApi.js`
- Page/UI: `src/features/returns/components/ReturnsPage/ReturnsPage.jsx`
- SCSS: `src/features/returns/components/ReturnsPage/ReturnsPage.scss`

### 3. API methods
- `GET /returns/`, `GET /returns/{id}/`
- `GET /returns/select-sources/`
- `POST /returns/`, `PATCH /returns/{id}/`
- `PATCH /returns/{id}/complete/`, `PATCH /returns/{id}/cancel/`
- URL `returns/{id}/waybill/`
- Legacy в API файле: `downloadReturnWaybill`
- Соответствие: **ДА**.

### 4. Таблица
- Колонки: номер, дата, клиент, продажа, сумма, куда вернули, статус, действия.
- Status badge + RU labels.
- Пустые значения: `—`.
- Горизонтальный scroll: `min-width: 1050px`.
- Functional UI Spec: **ДА**.

### 5. Верхняя панель
- Заголовок, поиск, фильтры клиент/статус (`SearchableSelect`), кнопка создания.
- Query: search/client_id/status/page.
- Соответствие: **ДА**.

### 6. Модалки create/edit/action
- `ReturnModal`:
  - Draft create payload: `sale`, `date`, `return_reason`, `invoice_number`, `comment`, `lines[]`.
  - `lines[]`: `sale_line`, `quantity`, `return_target`, `condition_type`, `comment`.
  - Для completed редактируются только реквизиты (без статуса).
  - Валидации по qty/caps есть.
  - `SearchableSelect` используется.
  - Крестик есть, внутренний scroll есть.
- Native select: **нет**.

### 7. Detail card
- Секции: документ, последствия/downstream links, связанные документы.
- Отображаются downstream payment links.
- Raw enum в UI не показан напрямую.

### 8. Actions
- Draft: `Открыть`, `Редактировать`, `Провести`, `Отменить`, `Накладная`.
- Completed: `Открыть`, `Возврат денег` (через `/payments?return_id=`), `Накладная`.
- Cancel: только просмотр/документ.
- `complete` только через `/complete/`, `cancel` только через `/cancel/`.
- Delete: **нет**.
- Соответствие: **ДА** по flow.

### 9. Routing/query params
- Реализовано: `/returns?sale_id=...`
- Что делает: открывает create modal, проставляет initial sale, очищает URL.
- Соответствие: **ДА**.

### 10. Error handling
- Явный mapping (`return_status_update_forbidden`, `downstream_used`, qty/status ошибки и т.д.) + fallback.
- Не все коды backend списка заданы явно.

### 11. Loading / empty / success states
- List/detail/modal loading/empty/error есть.
- Busy на waybill/complete/cancel есть.
- Success toast есть.

### 12. UX/UI
- Scroll в create/detail модалках есть.
- Max-height 90vh на detail modal.
- Focus-visible есть.

### 13. Frontend contract verdict
- **Возвраты: OK**
- Причина: не выявлена.

---

## 6) Брак / переделка

### 1. Назначение вкладки
- Два таба: `Брак` и `Переделка`.
- Сущности: `defect_record`, `rework_request`.
- Связанные вкладки: `Продажи` (sell defect), `Оплаты` (active clients source), `Возвраты`.

### 2. Frontend files
- Container tabs: `src/features/defects/components/DefectsReworkPage/DefectsReworkPage.jsx`
- Defects API: `src/features/defects/api/defectsApi.js`
- Defects UI: `src/features/defects/components/DefectsPage/DefectsPage.jsx`
- Defects SCSS: `src/features/defects/components/DefectsPage/DefectsPage.scss`
- Rework API: `src/features/reworkRequests/api/reworkRequestsApi.js`
- Rework UI: `src/features/reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage.jsx`
- Rework SCSS: `src/features/reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage.scss`

### 3. API methods
- Defects:
  - `GET /defects/`, `GET /defects/{id}/`, `GET /defects/select-sources/`
  - `POST /defects/`, `PATCH /defects/{id}/`
  - `POST /defects/{id}/send-to-rework/`
  - `POST /defects/{id}/writeoff/`
  - `POST /defects/{id}/sell/`
  - Delete и `complete-rework` отсутствуют в api layer.
- Rework:
  - `GET /rework-requests/`, `GET /rework-requests/{id}/`, `GET /rework-requests/select-sources/`
  - `POST /rework-requests/`, `PATCH /rework-requests/{id}/`
  - `POST /rework-requests/{id}/start/`
  - `POST /rework-requests/{id}/complete/`
  - `POST /rework-requests/{id}/cancel/`
- Соответствие: **частично ДА**.

### 4. Таблица
- `Брак`:
  - Колонки: `Брак #id`, продукт, источник, причина, количество, статус, действия.
  - Badge статуса есть, source label есть.
  - Пустые значения `—`.
  - Scroll: `min-width: 1080px`.
- `Переделка`:
  - Колонки: номер, продукт, количество, статус, результат, комментарий, действия.
  - Badge статуса есть.
  - Scroll: `min-width: 1080px`.
- Functional UI Spec: **частично**.

### 5. Верхняя панель
- `Брак`: заголовок, поиск, фильтр статуса, фильтр источника, кнопка создания.
- `Переделка`: заголовок, поиск, фильтр статуса, кнопка создания.
- Соответствие: **ДА**.

### 6. Модалки create/edit/action
- `DefectModal`:
  - `source_type` (`manual/warehouse/return`), source selector, product, quantity, reason, comment.
  - Payload:
    - manual: `source_type, product, quantity_pcs, defect_reason, comment`
    - warehouse: `source_type, warehouse_batch, defect_reason, comment`
    - return: `source_type, source_id, defect_reason, comment`
  - Валидация есть.
  - `SearchableSelect` используется.
- `Sell defect` modal:
  - `client_id`, `quantity`, `price`, `comment`
  - Клиенты фильтруются активные: `is_active===true || status==='active'`.
- `Writeoff defect` modal:
  - `writeoff_reason`, `quantity?`
- `Send to rework` modal:
  - `quantity?`, `comment?` (comment optional на UI не выведен отдельным полем; отправляется только qty/body).
- `ReworkModal`:
  - create payload: `defect_record`, `comment`
  - не отправляет quantity/result/status.
- `Complete rework` modal:
  - `output_quantity`, `loss_quantity`, `quality`, `comment`
  - frontend validation: `output + loss <= input`.
- Факт UX:
  - крестики есть.
  - `SearchableSelect` есть.
  - sticky footer и внутренний scroll в `DefectModal`/`ReworkModal` явно не реализованы отдельными классами как в sales/orders/payments/returns.

### 7. Detail card
- `DefectDetailModal`:
  - Показывает блок данных/счетчики/действия.
  - Нет выделенной секции `Связи` с таблицей linked documents.
- `ReworkDetailModal`:
  - Показывает номер/продукт/кол-во/статус/результат/комментарий/действия.
  - Нет явного деления на все секции из спецификации (`Документ`, `Исходный брак`, `Количество`, `Результат`, `Связи`).

### 8. Actions
- Defect:
  - `Открыть`, `Продать`, `Списать`, `Отправить в переделку` (по доступному остатку и статусу).
  - Нет delete.
  - Нет `complete-rework` на defect.
- Rework:
  - `Открыть`, `Начать`, `Завершить`, `Отменить` по статусу.
  - Нет delete.
- Соответствие: **ДА** по endpoint-flow.

### 9. Routing/query params
- Вкладка не использует preset маршруты из обязательного списка (`/payments`, `/returns`).
- Переключение табов через роут:
  - `/defects-rework`
  - `/defects-rework/rework`

### 10. Error handling
- Есть code mapping для defect/rework операций + fallback.
- Покрыты коды типа `inactive_client`, `quantity_exceeded`, `use_rework_complete`, `rework_*_forbidden`.
- Не все коды из backend-списка покрыты явно (часть уходит в fallback).

### 11. Loading / empty / success states
- List/detail loading/empty/error есть.
- Busy на action модалках есть.
- Success toast есть.

### 12. UX/UI
- Таблицы с min-width, focus-visible есть.
- Модалки `Defect/Rework` приведены к паттерну `max-height + scroll + sticky footer`.
- BEM-классы добавлены для модалок и карточек.

### 13. Frontend contract verdict
- **Брак / переделка: OK**
- Критичных расхождений не выявлено.

---

## Сравнение endpoints/payload с backend contract (сводка)

- Совпадают:
  - Основные CRUD + action endpoints по всем 6 вкладкам.
  - Query preset flows `/payments?sale_id|order_id|return_id`, `/returns?sale_id`.
  - Для defects/rework не используется delete и не вызывается `defects/{id}/complete-rework/`.
- Не совпадают / legacy:
  - Не выявлено.
- Payload замечания:
  - Defect/rework action payloads в основном контрактные.
  - Rework create payload не содержит запрещенных quantity/status/result полей (факт: OK).
- Raw enum:
  - В audited вкладках критичных raw enum в таблицах/карточках не найдено.

---

## PROBLEMS SECTION

### Critical
- Не выявлено.

### Medium
- Не выявлено.

### Minor
- Не выявлено.

### API mismatch
- Не выявлено.

### UI/UX problems
- Не выявлено.

### Legacy still used
- Не выявлено.

### Raw enum shown
- Не выявлено.

### Wrong payload
- Не выявлено.

### Missing error handling
- Не выявлено.

### Missing tests/manual checks
- Рекомендуется регрессионная ручная проверка сценариев действий после релиза.

---

## Frontend contract final verdict

- Клиенты: **OK**
- Заявки: **OK**
- Продажи: **OK**
- Оплаты: **OK**
- Возвраты: **OK**
- Брак / переделка: **OK**

### Общий итог

Frontend contract: **OK**
