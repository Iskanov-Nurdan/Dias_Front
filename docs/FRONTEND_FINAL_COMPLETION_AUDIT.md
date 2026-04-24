# FRONTEND FINAL COMPLETION AUDIT

Дата аудита: 24.04.2026  
Источник фактов:
- текущий код фронтенда (`src/`)
- `docs/FRONTEND_BACKEND_ALIGNMENT_MASTER.md`

Ограничение источников:
- `docs/BACKEND_MASTER_FOR_FRONTEND.md` в репозитории отсутствует.
- В спорных местах приоритет отдан реальному коду.

---

## 1) Итоговая таблица по коммерческим разделам

| Раздел | Статус | Что сделано | Что ещё не совпадает с backend | Критичность |
|---|---|---|---|---|
| `/orders` | почти готов | Пагинация, поиск, фильтр статуса, badge статусов, статус через `PATCH /orders/{id}/status/`, waybill download со sniff | Нет явной проверки backend close restrictions; fallback `remaining_to_ship` считается на фронте при отсутствии backend-поля | не критично |
| `/sales` | почти готов | Пагинация, фильтры (`sale_status/client/date_from/date_to`), badge, status через `/sales/{id}/status/`, force credit override на create/status, receipt/waybill sniff | В `downloadSaleWaybill` остаётся локальный HTML fallback; номер в таблице может падать в `#id`; вопрос по обязательности отдельного sale status endpoint не подтверждён backend master | не критично |
| `/payments` | почти готов | Пагинация, фильтры (`client/payment_type/date_from/date_to`), summary, WS с `return` | Нет поиска (в коде прямо зафиксировано, что backend не даёт `search`) | не критично |
| `/returns` | почти готов | Пагинация, фильтры только `client/date_from/date_to`, бизнес-таблица без fake status, quantity validation по sale detail, waybill sniff, WS | Статус возврата в таблице отсутствует (backend-поля статуса в list нет) | не критично |
| `/defects` | почти готов | Пагинация, фильтр статуса, badge, status-based actions, подключён `complete-rework`, формы и модалки без ручного статуса/source_id | По payload `sell` используется `client_id`; если backend ожидает `client`, будет несовпадение | критично (только если backend ждёт `client`) |
| `/rework-requests` | почти готов | Пагинация, фильтр статуса, badge, start/complete/cancel по статусам, complete требует `result_warehouse_batch_id`, тех. ID заменены на select | Route/access key остаётся `defects` (отдельного подтверждённого ключа нет) | не критично |
| `/clients` | почти готов | Пагинация, поиск, WS (`sale/payment/order`), history + финансовый блок, дубль `messenger/whatsapp_telegram` убран | Контракт поля мессенджера нефиксирован: в create/update выбирается одно поле по эвристике текущей записи | критично (контрактное место) |
| `/warehouse` | почти готов | Пагинация, `quality` отправляется query param, остатки разделены по backend-полям (`quantity/reserved_quantity/available_quantity`), reserve/package логика сохранена | Нет подтверждения из backend master, что `quality` официально поддержан на list (код отправляет параметр) | критично (контрактное место) |
| `documents` | почти готов | `orders/sales/returns` download со sniff и корректным расширением; `sales` preview есть | В `sales` waybill есть локальный HTML draft fallback; в preview остаётся placeholder телефон поставщика | не критично |
| `websocket` | почти готов | Подписки на всех коммерческих страницах, включая clients/payments/returns/warehouse | Существенных дыр по коммерческим разделам не выявлено | не критично |

---

## 2) Полная сверка frontend ↔ backend сущностей

| Сущность | Backend endpoint | Экран | Соответствие контракту | Поля/отображение не так | Действия не так | Frontend-вычисления вместо backend |
|---|---|---|---|---|---|---|
| Order | `GET/POST/PATCH/DELETE /orders/` | `OrdersPage`, `OrderModal` | частично | `source_type` всё ещё user-facing | close restrictions не подтверждены в UI | `remaining_to_ship` fallback при отсутствии backend поля |
| OrderLine | в теле `orders/` | `OrderModal` | частично | product строкой, без каталога | — | нет критичных |
| OrderReservation | `GET /orders/{id}/reservations/` | `OrderDetailModal` | частично | отображение есть, но отдельного workflow нет | — | нет |
| Sale | `GET/POST/PATCH/DELETE /sales/`, `PATCH /sales/{id}/status/` | `SalesPage`, `SaleModal` | частично | fallback номера как `#id` возможен | если backend требует только status endpoint для любых смен — не подтверждено | нет критичных |
| SaleLine | в теле `sales/` | `SaleModal` | частично | тех. поля из формы убраны; без каталога продуктов | — | нет |
| Payment | `GET/POST/PATCH/DELETE /payments/` | `PaymentsPage`, `PaymentModal` | частично | поиск отсутствует (по коду контракт его не имеет) | — | нет |
| Return | `GET/POST/PATCH/DELETE /returns/` | `ReturnsPage`, `ReturnModal` | частично | статус в таблице не показывается (нет list-поля) | — | нет |
| ReturnLine | в теле `returns/` | `ReturnModal` | частично | — | qty cap валидируется по данным sale detail; финальная проверка на backend | нет критичных |
| DefectRecord | `GET/POST/PATCH/DELETE /defects/`, actions | `DefectsPage`, `DefectModal` | частично | user-facing список и форма приведены к бизнес-виду | статусные действия ограничены корректно | нет |
| ReworkRequest | `GET/POST/PATCH /rework-requests/`, actions | `ReworkRequestsPage`, `ReworkModal` | частично | raw id в таблице результата убран | start/complete/cancel ограничены по статусам | нет |
| Client | `GET/POST/PATCH/DELETE /clients/` | `ClientsPage`, `ClientModal` | частично | контракт `messenger` vs `whatsapp_telegram` не подтверждён | — | нет |
| WarehouseBatch | `GET /warehouse/batches/`, `POST /warehouse/batches/reserve/` | `WarehousePage` | частично | список разделяет quantity/reserved/available | reserve корректен | нет (критичные остатки считаются только с backend-полей) |
| Client financial summary | `GET /payments/summary/?client_id=` | `PaymentsPage`, `Clients HistoryModal` | частично | в clients показываются только пришедшие поля | — | нет |
| Documents | `orders/sales/returns` waybill, `sales/receipt` | API helpers + `WaybillPreviewModal` | частично | `sales` preview с placeholder supplier phone | `sales` локальный draft fallback остаётся | нет |
| Websocket resources | `/ws/operational/` + resource sets | все коммерческие pages | частично | подписки коммерческих разделов закрыты | — | нет |

---

## 3) Что реально осталось

Только фактические незакрытые места:

1. **Неясный контракт поля мессенджера клиента (`messenger` vs `whatsapp_telegram`)**  
   - Файл: `src/features/clients/components/ClientsPage/ClientsPage.jsx`  
   - Проблема: backend master отсутствует, фронт отправляет одно из полей по эвристике текущей записи.  
   - Критичность: **критично** (контрактная неопределённость).
   - Нужно исправлять: **да**, после подтверждения backend-поля.

2. **Неясная поддержка `quality` в backend list для склада**  
   - Файл: `src/features/warehouse/components/WarehousePage/WarehousePage.jsx`  
   - Проблема: фронт отправляет `quality` в query; без backend master нельзя подтвердить официальный контракт.  
   - Критичность: **критично** (если параметр игнорируется/ломается на backend).
   - Нужно исправлять: **да**, только после подтверждения backend.

3. **`sales` waybill локальный HTML draft fallback**  
   - Файл: `src/features/sales/api/salesApi.js`  
   - Проблема: при недоступности server waybill генерируется локальный draft HTML.  
   - Критичность: **не критично**.
   - Нужно исправлять: **опционально**, если backend гарантирует стабильную выдачу файла.

4. **Placeholder supplier phone в preview накладной продажи**  
   - Файл: `src/features/sales/config/waybillConfig.js`  
   - Проблема: в preview остаётся заглушка телефона поставщика.  
   - Критичность: **не критично**.
   - Нужно исправлять: **да**, если это бизнес-требование к документу.

---

## 4) Проверка технического мусора

| Проверка | Да/Нет | Где именно |
|---|---|---|
| Остались raw id в UI | **Да** | `sales` таблица fallback `#id`; в некоторых select-label fallback вроде `#id` (`payments`, `orders`) |
| Остались технические поля в формах | **Частично да** | `orders` форма: `source_type` user-facing; в остальных коммерческих формах критичные техполя (source_id/manual status/return-defect-sale IDs) убраны |
| Остались ручные select статусов, где не должно быть | **Нет** | `defects/rework` ручной status select убран; `sales` статус в action-menu через status endpoint |
| Остались fake search | **Нет** | на страницах, где backend search не подтверждён, поиска нет |
| Остались fake status | **Нет** | status не дорисовывается при отсутствии backend-поля (например returns list) |
| Остались fake вычисления для critical полей | **Частично да** | `orders` fallback `remaining_to_ship` считается локально только если backend поле отсутствует |

---

## 5) Проверка бизнес-правил backend

| Правило | Статус | Факт по коду |
|---|---|---|
| hard credit limit | **частично учтено** | Обрабатывается через ошибки backend в sales create/status; в payments отдельного credit-check нет |
| force_credit_override | **частично учтено** | Реализован в sales create/status с правом override и confirm flow |
| order status только через `/status/` | **учтено** | `OrdersPage` использует `PATCH /orders/{id}/status/` |
| sale status только через `/status/` | **учтено** | `SalesPage` использует `PATCH /sales/{id}/status/` |
| available_quantity только с backend | **учтено** | `warehouse` свободно берётся из `available_quantity` |
| reserved_quantity только с backend | **учтено** | `warehouse` зарезервировано берётся из `reserved_quantity` |
| reservation logic | **частично учтено** | reserve endpoint используется; полного reservation policy workflow нет |
| sale without reservation policy | **не учтено** | явной policy-логики нет |
| return qty restrictions | **частично учтено** | клиентская валидация по sale detail + backend финальный контроль |
| defect status restrictions | **учтено** | действия ограничены по status |
| rework status restrictions | **учтено** | start/complete/cancel ограничены по status |
| client financial summary | **учтено** | summary в payments и в clients history card |
| documents | **частично учтено** | sniff/extension исправлены; у sales есть local draft fallback |
| websocket refetch | **учтено** | коммерческие экраны подписаны и рефетчатся |

---

## 6) Проверка документов

| Документ | Скачивание | Расширение | Sniff | Preview | Жёсткий `.html` | Placeholder |
|---|---|---|---|---|---|---|
| Order waybill | работает через API helper | корректное по sniff/header | есть | нет | нет | нет |
| Sale waybill preview | preview работает | n/a | n/a | есть | n/a | **да** (supplier phone в config) |
| Sale receipt | работает через API helper | корректное по sniff/header | есть | нет | нет | нет |
| Return waybill | работает через API helper | корректное по sniff/header | есть | нет | нет | нет |

Дополнительно:
- В `sales` download остаётся локальный draft HTML fallback при недоступности server endpoints.

---

## 7) Проверка WS и синхронизации

| Раздел | Какие ресурсы слушает | Достаточность | Риск рассинхрона |
|---|---|---|---|
| orders | `order`, `sale`, `payment`, `return` | достаточно | низкий |
| sales | `sale`, `warehouse_batch`, `order`, `payment`, `return` | достаточно | низкий |
| payments | `payment`, `sale`, `order`, `return` | достаточно | низкий |
| returns | `return`, `defect_record`, `rework_request`, `sale` | достаточно | низкий |
| defects | `defect_record`, `sale`, `rework_request` | достаточно | низкий |
| rework | `rework_request`, `defect_record`, `warehouse_batch` | достаточно | низкий |
| clients | `sale`, `payment`, `order` | достаточно | низкий |
| warehouse | `warehouse_batch`, `production_batch`, `batch` | достаточно | низкий |

---

## 8) Финальный вывод

## Фронт не полностью готов, осталось 2 конкретных критичных пункта

1. Подтвердить и зафиксировать контракт поля мессенджера клиента (`messenger` vs `whatsapp_telegram`) и привести create/update к одному точному полю.
2. Подтвердить контракт query-параметра `quality` для `GET /warehouse/batches/` (параметр уже отправляется фронтом; нужна backend-верификация).

Остальные незакрытые места не блокируют работу коммерческого контура и относятся к некритичному cleanup (локальный draft waybill fallback в sales, placeholder supplier phone в preview).
