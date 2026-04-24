# FRONTEND FINAL ALIGNMENT TO BACKEND CANON

## 1) Какие старые endpoint убраны

- `salesApi.downloadSaleWaybill`: удалён legacy-роут `sales/{id}/nakladnaya/`, оставлен только `sales/{id}/waybill/`.
- `salesApi.downloadSaleWaybill`: убраны fallback-попытки нескольких URL и fallback-форматов.
- `salesApi.downloadSaleReceipt`: убраны fallback-форматы; оставлен строгий `text/html`.
- `returnsApi.downloadReturnWaybill`: удалён legacy-роут `returns/{id}/nakladnaya/`, оставлен только `returns/{id}/waybill/`.
- Документы в продажах/возвратах приведены к одному канону: `Accept: text/html,*/*` + строгая проверка `text/html`.

## 2) Какие input заменены на select-source

- Заявки (`OrdersPage`): источники выбора клиента/профиля переведены на `GET /api/orders/select-sources/` (`clients`, `profiles`).
- Продажи (`SalesPage`): выбор клиента/связанной заявки/партии переведён на `GET /api/sales/select-sources/?client_id=...` (`clients`, `orders`, `warehouse_batches`).
- Возвраты (`ReturnsPage`): выбор продажи и строк продажи переведён на `GET /api/returns/select-sources/?sale_id=...` (`sales`, `sale_lines`), добавлен `getReturnSelectSources`.
- Брак (`DefectsPage`): выбор источника переведён на `GET /api/defects/select-sources/` (`return_lines`), добавлен `getDefectsSelectSources`.
- Переделка (`ReworkRequestsPage`): выбор связей переведён на `GET /api/rework-requests/select-sources/` (`defect_records`, `original_sales`, `returns`, `result_warehouse_batches`), добавлен `getReworkSelectSources`.

## 3) Где убран ручной product

- Продажи (`SaleModal`): `product` в строке продажи больше не выбирается вручную; подставляется из выбранной `warehouse_batch`.
- Возвраты (`ReturnModal`): `product` в строке возврата read-only; источник истины — `sale_line`.
- Брак (`DefectModal`): `product` read-only; подставляется из выбранной `return_line`.
- Переделка (`ReworkModal`): `product` read-only; подставляется из выбранной записи брака.

## 4) Где убраны legacy/fallback поля

- Склад (`WarehousePage`, `warehouseBatchCard`, `PackFromOtkModal`): убраны fallback-поля по партиям/продукту/остаткам, убраны alias-поля в payload (`warehouse_batch`), оставлены канонические поля.
- Продажи (`SalesPage`, `SaleDetailModal`): убраны fallback по датам/количеству/цене (`sale_date`, `sold_pieces`, legacy price aliases).
- Возвраты (`ReturnsPage`): убраны fallback-пути по вложенным полям продажи/клиента, оставлены канонические `sale_*`/`client_name`.
- Переделка (`ReworkRequestsPage`): убраны fallback по nested id из объектных алиасов в пользу канонических `*_id`.

## 5) Где detail-first доведён до конца

- Склад: клик по записи открывает detail карточку партии; действия из detail/action menu.
- Клиенты: клик по строке открывает карточку клиента; редактирование отдельной кнопкой.
- Заявки: клик по строке открывает detail; действия (статусы/отгрузка/оплата) из detail по `available_actions`.
- Продажи: клик по строке открывает detail; edit отдельной кнопкой; статусы из `available_status_transitions`.
- Возвраты: клик по строке открывает `ReturnDetailModal`; edit отдельной кнопкой.
- Брак: клик по строке открывает `DefectDetailModal`; операции из detail/action menu.
- Переделка: клик по строке открывает `ReworkDetailModal`; start/complete/cancel из detail/action menu.

## 6) Какие страницы теперь соответствуют backend-канону

- Документы продаж и возвратов: канонические endpoints + канонический формат (`text/html`) без fallback.
- Склад: reserve/package только для `quality=good`, для `defect` действия скрыты.
- Заявки: выбор профиля из select-source, действия и переходы статусов по `available_actions`/`available_status_transitions`.
- Продажи: создание через `sales/select-sources`, product от партии, статус/действия по backend.
- Возвраты: сценарий завязан на `sale_line` и `returns/select-sources`, detail показывает downstream связи.
- Брак: создание/редактирование через реальные связи (`return_lines`), действия в detail по `available_actions`.
- Переделка: связи берутся из `rework-requests/select-sources`, обязательные `defect_record` и `original_sale`, complete требует `result_warehouse_batch_id`.
- Аналитика: добавлен realtime-refetch по операционным ресурсам.

## 7) Что ещё осталось (реально)

- `PaymentsPage` пока без отдельного detail-first модального сценария (есть list + edit modal + summary).
- `ClientsPage` исторический блок опирается на смешанный контракт (`clients/{id}/history/` + fallback загрузка продаж), требуется окончательная канонизация ответа backend для полной зачистки fallback.
- Для брак/переделка названия `available_actions` зависят от фактического backend ответа; фронт уже ориентирован на этот массив, но полный список action-кодов должен быть стабилен на backend.
