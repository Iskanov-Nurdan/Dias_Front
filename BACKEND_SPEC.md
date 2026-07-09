# Rahman Ata CRM — Техническое задание для бэкенда

## Общее

Фронтенд написан на React. Все запросы идут на `/api/...`.  
Base URL продакшена: `https://rahmanata.kg/api`  
Локальная разработка: `http://127.0.0.1:8000/api`

**Авторизация:** Bearer JWT — заголовок `Authorization: Bearer <access_token>`  
**Content-Type:** `application/json` (для загрузки файлов — `multipart/form-data`)  
**Именование полей:** camelCase  
**Trailing slash:** все пути заканчиваются на `/`

---

## Формат ответов

### Список с пагинацией
```json
{
  "items": [...],
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 134,
    "totalPages": 7
  }
}
```

### Ошибка
```json
{ "error": { "code": "NOT_FOUND", "message": "Клиент не найден" } }
```

**Коды статусов:**
- `401` — истёк access_token (фронт сам делает refresh и повторяет запрос)
- `403` — нет доступа
- `409` — конфликт (период закрыт, товара недостаточно и т.д.)

---

## 1. Авторизация

### POST /auth/
Вход в систему.

**Body:**
```json
{ "login": "admin", "password": "1234" }
```

**Response 200:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": {
    "id": 12,
    "login": "admin",
    "fio": "Иванов Иван",
    "phone": "+996 700 123456",
    "roleName": "Администратор",
    "canManageRoles": true,
    "access": {
      "clients": true,
      "employees": true,
      "sports-trainers": true,
      "reports": true,
      "warehouse": false,
      "sales": false,
      "expenses": false,
      "salary": false,
      "leads": false,
      "analytics": false,
      "taplink": false,
      "shifts": true
    }
  }
}
```

> Поле `access` — объект где ключи это pageId, значения true/false. Фронт по нему показывает/скрывает разделы в меню.

---

### POST /auth/refresh
Обновить access token. **Без Authorization.**

**Body:** `{ "refresh": "eyJ..." }`  
**Response:** `{ "access": "eyJ..." }`

---

### POST /auth/logout
**Body:** `{ "refresh": "eyJ..." }`  
Refresh уходит в blacklist.  
**Response 200** — пустое тело или `{ "ok": true }`

---

## 2. Сотрудники

### GET /employees/
**Query параметры:**
- `search` — поиск по ФИО, телефону, логину
- `role_id` — фильтр по роли
- `page`, `perPage`

**Объект Employee:**
```json
{
  "id": 12,
  "login": "ali",
  "fio": "Алиев Алишер",
  "phone": "+996 555 000111",
  "roleName": "Тренер",
  "roleId": 3,
  "canManageRoles": false
}
```

### GET /employees/{id}/

### POST /employees/
**Body:**
- `login` — обязательно
- `fio` — обязательно
- `password` — обязательно
- `phone` — опционально
- `roleId` (number | null) — опционально

### PATCH /employees/{id}/
Те же поля, все опциональны.

### DELETE /employees/{id}/

### GET /employees/{id}/access/
**Response:**
```json
{ "access": { "clients": true, "analytics": false, "shifts": true } }
```

### PUT /employees/{id}/access/
**Body:** `{ "access": { "clients": true, "analytics": true, "shifts": true } }`

---

## 3. Роли

### GET /roles/
**Query:** `search`

**Объект Role:** `{ "id": 3, "name": "Тренер" }`

### POST /roles/
**Body:** `{ "name": "Тренер" }`

### PATCH /roles/{id}/
### DELETE /roles/{id}/

---

## 4. Виды спорта

### GET /sports/
**Query:** `search`

### POST /sports/
**Body:** `{ "name": "Бокс" }`

### PATCH /sports/{id}/
### DELETE /sports/{id}/

---

## 5. Тренеры

### GET /trainers/
**Query параметры:**
- `sportId` — фильтр по виду спорта
- `search` — поиск по ФИО
- `weekday` (1–7) — фильтр по дню недели графика
- `timeFrom`, `timeTo` — временной слот (HH:MM)
- `includeSchedule` (bool) — добавить поле `schedule` к каждому тренеру
- `page`, `perPage`

**Объект Trainer:**
```json
{
  "id": 5,
  "fio": "Алиев Марат",
  "phone": "+996 700 555333",
  "sportId": 2,
  "sportName": "Бокс",
  "schedule": [
    { "weekday": 1, "timeFrom": "09:00", "timeTo": "11:00" },
    { "weekday": 3, "timeFrom": "14:00", "timeTo": "16:00" }
  ]
}
```
> Поле `schedule` присутствует только если `includeSchedule=true`.

### GET /trainers/{id}/
### POST /trainers/
### PATCH /trainers/{id}/
### DELETE /trainers/{id}/

### GET /trainers/{id}/schedule/
**Response** — массив слотов:
```json
[{ "weekday": 1, "timeFrom": "09:00", "timeTo": "11:00" }]
```

### PUT /trainers/{id}/schedule/
Полная замена графика. Body — тот же массив слотов.

---

## 6. Клиенты

### GET /clients/
**Query параметры:**
- `search` — поиск по ФИО, телефону
- `sportId` — вид спорта
- `trainerId` — тренер
- `paid` (bool) — `true` = оплатили, `false` = не оплатили
- `clientType` — `individual` | `regular` | `one_time`
- `year`, `month` — период
- `dateFrom`, `dateTo` (YYYY-MM-DD) — фронт вычисляет из year/month/day
- `trainingWeekday` (1–7) — фильтр по слоту графика тренера
- `trainingTimeFrom`, `trainingTimeTo` (HH:MM)
- `page`, `perPage`

**Объект Client:**
```json
{
  "id": 101,
  "fio": "Байтереков Нурлан",
  "phone": "+996 555 000111",
  "sportId": 2,
  "sportName": "Бокс",
  "trainerId": 5,
  "trainerName": "Алиев Марат",
  "clientType": "regular",
  "paid": true,
  "dateStart": "2026-07-01",
  "dateEnd": "2026-07-31",
  "months": 1,
  "amount": 3000,
  "freezeDays": 0,
  "freezeReason": null,
  "comment": "",
  "createdAt": "2026-07-01T10:00:00Z"
}
```

### GET /clients/{id}/

### POST /clients/
**Body:**
- `fio` — обязательно
- `phone` — обязательно
- `sportId` — обязательно
- `trainerId`, `clientType`, `paid`, `dateStart`, `months`, `amount`, `comment` — опционально

### PATCH /clients/{id}/
Те же поля, все опциональны.

### DELETE /clients/{id}/

### GET /clients/not-renewed/
Клиенты, которые не продлили абонемент.

**Query:** `year`, `month`, `dateFrom`, `dateTo`, `page`, `perPage`

**Response:**
```json
{
  "items": [...],
  "meta": { "page": 1, "perPage": 20, "total": 42, "totalPages": 3 },
  "summary": { "notRenewed": 42 }
}
```

### POST /clients/{id}/extend/
Продлить абонемент.

**Body:** `{ "months": 1 }`

**Response** — обновлённый объект Client.

---

## 7. Заморозка клиента

### POST /clients/{id}/freeze/
**Body:**
```json
{ "days": 7, "reason": "Болезнь" }
```
Бэкенд сдвигает `dateStart` вперёд на `days`. Сохраняет baseline (оригинальную дату) чтобы PATCH мог пересчитать.  
**Response** — обновлённый Client.

### PATCH /clients/{id}/freeze/
Изменить существующую заморозку. Пересчёт `dateStart` от baseline, **не суммируя** с прежним сдвигом.  
**Body:** те же поля.

### DELETE /clients/{id}/freeze/
Снять заморозку, вернуть `dateStart` к исходному.  
**Response** — обновлённый Client.

---

## 8. Разовые оплаты клиента

### GET /clients/{id}/one-time/
**Response:**
```json
{
  "items": [
    { "id": 7, "amount": 500, "date": "2026-07-05", "comment": "Доп. занятие" }
  ]
}
```

### POST /clients/{id}/one-time/
**Body:** `{ "amount": 500, "date": "2026-07-05", "comment": "" }`  
`409` если период закрыт.

### DELETE /clients/{id}/one-time/{paymentId}/
`409` если период закрыт.

---

## 9. Фото клиентов (чеки)

### GET /clients/{id}/photos/
**Response:**
```json
{
  "items": [
    { "id": 3, "url": "/media/clients/photo.jpg", "kind": "receipt", "createdAt": "2026-07-01T..." }
  ]
}
```

### POST /clients/{id}/photos/
`multipart/form-data`. Загружать по одному файлу и kind за раз или несколько.

**Fields:**
- `files` — файл (поле повторяется для каждого файла)
- `kinds` — тип файла: `receipt` | `other` (порядок совпадает с files)

### DELETE /clients/{id}/photos/{photoId}/

---

## 10. Статистика клиентов

### GET /clients/stats/
**Query:** `year`, `month`

**Response:**
```json
{
  "paid": 87,
  "unpaid": 10,
  "total": 97,
  "individual": 30,
  "regular": 50,
  "oneTime": 17,
  "revenue": 290000
}
```

### GET /clients/stats/payment-days/
**Query:** `year`, `month`

Отчёт «Записи по дням» — по каждому дню месяца.

**Response** — массив:
```json
[
  {
    "date": "2026-07-01",
    "registered": 5,
    "paid": 3,
    "paidTotalAmount": 9000
  }
]
```
- `registered` — записались (по `dateStart`)
- `paid` — оплатили в этот день
- `paidTotalAmount` — сумма оплат за день

### GET /clients/stats/payment-days/clients/
Клиенты конкретной ячейки отчёта.

**Query:**
- `year` — обязательно
- `month` — обязательно
- `day` (YYYY-MM-DD) — обязательно
- `kind` — `registered` | `paid` — обязательно

**Response** — стандартный список Client[]

### GET /clients/stats/schedule/
**Query:** `year`, `month`

Статистика по слотам графика тренеров — сколько учеников у каждого тренера в каждый временной слот. Структуру обсудить с командой фронта.

---

## 11. Расходы

### GET /expense-categories/
**Query:** `search`

### POST /expense-categories/
**Body:** `{ "name": "Аренда" }`

### PATCH /expense-categories/{id}/
### DELETE /expense-categories/{id}/

---

### GET /expenses/
**Query:** `search`, `dateFrom`, `dateTo`, `categoryId`, `page`, `perPage`

**Объект Expense:**
```json
{
  "id": 9,
  "name": "Аренда зала",
  "amount": 50000,
  "date": "2026-07-01",
  "categoryId": 2,
  "categoryName": "Аренда",
  "comment": "",
  "saved": false
}
```

### POST /expenses/
**Body:** `name`, `amount`, `date` — обязательны. `categoryId`, `comment` — опционально.

### PATCH /expenses/{id}/
### DELETE /expenses/{id}/

### PATCH /expenses/{id}/save/
Зафиксировать расход. Пустое тело `{}`.

---

## 12. Склад

### GET /warehouse/categories/
**Query:** `search`

### POST /warehouse/categories/
### PATCH /warehouse/categories/{id}/
### DELETE /warehouse/categories/{id}/

---

### GET /warehouse/products/
**Query:** `search`, `categoryId`, `page`, `perPage`

**Объект Product:**
```json
{
  "id": 1,
  "name": "Боксёрские перчатки",
  "categoryId": 1,
  "categoryName": "Экипировка",
  "price": 2500,
  "quantity": 14,
  "unit": "шт",
  "lowStockThreshold": 3
}
```

### GET /warehouse/products/{id}/
### POST /warehouse/products/
### PATCH /warehouse/products/{id}/
### DELETE /warehouse/products/{id}/

### POST /warehouse/products/{id}/restock/
Пополнить склад.

**Body:**
```json
{ "quantity": 10, "costPrice": 1800, "date": "2026-07-01" }
```

---

### GET /warehouse/restocks/
История пополнений.

**Query:** `search`, `dateFrom`, `dateTo`, `page`, `perPage`

**Объект Restock:**
```json
{
  "id": 4,
  "productId": 1,
  "productName": "Перчатки",
  "quantity": 10,
  "costPrice": 1800,
  "date": "2026-07-01"
}
```

---

## 13. Продажи

### GET /sales/summary/
**Query:** `dateFrom`, `dateTo`

**Response:**
```json
{ "count": 34, "revenue": 85000, "avgCheck": 2500 }
```

### GET /sales/
**Query:** `dateFrom`, `dateTo`, `page`, `perPage`

**Объект Sale:**
```json
{
  "id": 20,
  "productId": 1,
  "productName": "Перчатки",
  "qty": 2,
  "pricePerUnit": 2500,
  "discountPercent": 0,
  "totalAmount": 5000,
  "employeeId": 3,
  "date": "2026-07-05",
  "status": "active"
}
```

### GET /sales/{id}/

### POST /sales/
`409` если товара недостаточно.

**Body:**
- `productId` — обязательно
- `qty` — обязательно
- `pricePerUnit` — обязательно
- `discountPercent` — 0–100, по умолчанию 0
- `employeeId` — кто продал
- `date` — по умолчанию сегодня

### POST /sales/{id}/cancel/
Отменить продажу. Пустое тело `{}`.  
`409` если уже отменена.

---

## 14. Зарплата тренеров

### GET /salary/
**Query:** `year`, `month`, `day` (опционально)

**Response** — массив по тренерам:
```json
[
  {
    "trainerId": 5,
    "trainerName": "Алиев Марат",
    "clientsCount": 22,
    "totalAmount": 66000,
    "trainerPercent": 40,
    "trainerAmount": 26400,
    "saved": false
  }
]
```

### POST /salary/save/
Зафиксировать выплату тренеру.

**Body:**
- `trainerId` — обязательно
- `year` — обязательно
- `month` — обязательно
- `day` — опционально
- `trainerPercent` — переопределить % тренера

---

## 15. Аналитика

> Все эндпоинты аналитики принимают: `year` (number), `month` (number), `day` (number, опционально).  
> Все требуют Authorization.

### GET /analytics/
Главная сводка.

**Response:**
```json
{
  "income": 350000,
  "expense": 80000,
  "profit": 270000,
  "clientsCount": 97,
  "salesCount": 34,
  "salesRevenue": 85000
}
```

### GET /analytics/period-comparison/
**Response:**
```json
{
  "currentPeriod": { "income": 350000, "expense": 80000, "profit": 270000 },
  "previousPeriod": { "income": 310000, "expense": 75000, "profit": 235000 },
  "momChange": 14.9,
  "yoyChange": 22.3
}
```

### GET /analytics/new-clients/
**Extra query:** `limit` (default 10)

**Response:** `{ "items": [...Client], "count": 15 }`

### GET /analytics/warehouse-low-stock/
Без параметров периода.

**Response:** `{ "items": [...Product] }`

### Остальные эндпоинты аналитики

| Эндпоинт | Что возвращает |
|---|---|
| `/analytics/expenses-by-category/` | `[{ categoryId, name, amount, percent }]` |
| `/analytics/sales-margin/` | `{ revenue, cogs, margin, marginPercent }` |
| `/analytics/clients-by-sport/` | `[{ sportId, name, count, percent }]` |
| `/analytics/activity-by-weekday/` | `[{ weekday, count }]` — weekday 1–7 |
| `/analytics/income-expense-daily/` | `[{ date, income, expense }]` |
| `/analytics/top-trainers/` | `[{ trainerId, name, clientsCount, revenue }]` |
| `/analytics/top-clients/` + limit=10 | `[{ clientId, name, totalPaid }]` |
| `/analytics/top-sports/` + limit=5 | `[{ sportId, name, count }]` |
| `/analytics/sales-by-product/` | `[{ productId, name, qty, revenue }]` |
| `/analytics/sales-by-category/` | `[{ categoryId, name, qty, revenue }]` |
| `/analytics/clients-breakdown/` | `{ individual, regular, oneTime, total }` |
| `/analytics/warehouse-restocks/` | `[{ date, qty, cost }]` |
| `/analytics/income-detail/` | `[{ source, amount }]` |
| `/analytics/expense-detail/` | `[{ categoryId, name, amount }]` |
| `/analytics/profit-detail/` | `{ income, expense, profit, profitMargin }` |
| `/analytics/leads/` | `{ total, new, inProgress, converted, lost, conversionRate }` |

---

## 16. Лиды

### GET /leads/
**Query:** `search`, `status`, `channel`, `stageId`, `date_from`, `date_to`, `page`, `perPage`

**Статусы:** `new` | `in_progress` | `converted` | `lost`

**Объект Lead:**
```json
{
  "id": 55,
  "name": "Асел Омурова",
  "phone": "+996 700 123456",
  "channel": "instagram",
  "status": "new",
  "source": "",
  "targetType": "adult",
  "sportId": 2,
  "trainerId": null,
  "trialStatus": null,
  "resultStatus": null,
  "amount": null,
  "comment": "",
  "stageId": 1,
  "createdAt": "2026-07-05T10:00:00Z"
}
```

### GET /leads/{id}/

### POST /leads/
**Body:** `name`, `phone` — обязательны. Остальные поля Lead — опциональны.

### PATCH /leads/{id}/
Все поля Lead опциональны. `stageId: null` — убрать из воронки.

### DELETE /leads/{id}/

### GET /leads/funnel-stages/
**Response:**
```json
{
  "items": [
    { "id": 1, "name": "Первый контакт", "order": 1, "color": "#3b82f6" },
    { "id": 2, "name": "Пробное занятие", "order": 2, "color": "#f59e0b" }
  ]
}
```

---

## 17. Taplink (публичный лендинг)

### GET /taplink/
**Без Authorization.** Возвращает полный конфиг страницы (заголовок, цвета, список спортов, тренеров, кнопки, соцсети).

### PUT /taplink/
Сохранить конфиг целиком. **Требует Authorization.**  
Body — тот же конфиг объект. Response — сохранённый конфиг.

### POST /taplink/upload/
Загрузить медиафайл. `multipart/form-data`.

**Fields:**
- `file` — файл (фото или видео)
- `context` — `hero-bg` | `sport-photo` | `trainer-photo` | `sport-video` | `trainer-video`

**Response:** `{ "url": "/media/taplink/hero.jpg" }`

### DELETE /taplink/upload/
**Body:** `{ "url": "/media/taplink/hero.jpg" }`

### POST /taplink/booking/
**Без Authorization.** Запись клиента с публичной страницы.

**Body:**
- `name` — обязательно
- `phone` — обязательно
- `sport` — обязательно
- `trainer`, `preferredTime`, `comment` — опционально

**Response 201.** Данные уходят администратору (Telegram-бот или email — на усмотрение бэкенда).

---

## 18. Смены ⚡ НОВЫЙ РАЗДЕЛ

> **Важно:** сейчас фронт хранит данные в `localStorage`. Когда бэкенд будет готов — достаточно заменить функции в файле `src/features/shifts/api.js`. Контракт API описан ниже.

### GET /shifts/
История завершённых смен.

**Query:** `year`, `month`, `day` (опционально)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "createdAt": "2026-07-07T18:30:00Z",
      "cash": 15000,
      "card": 8000,
      "total": 23000,
      "employeeName": "Иванов Иван",
      "employeeLogin": "ivan"
    }
  ],
  "meta": { "page": 1, "perPage": 50, "total": 12, "totalPages": 1 }
}
```

### POST /shifts/
Завершить смену.

**Body:**
```json
{ "cash": 15000, "card": 8000, "total": 23000 }
```

> `employeeName` и `employeeLogin` бэкенд берёт **из JWT-токена**. Фронт их не передаёт.

**Response** — созданный объект Shift.

---

### GET /shifts/photo-reports/
Фото отчёты сотрудников.

**Query:** `year`, `month`, `day` (опционально)

**Response:**
```json
{
  "items": [
    {
      "id": 1,
      "createdAt": "2026-07-07T16:00:00Z",
      "description": "Чек за оплату МБанк, итог дня",
      "photos": [
        { "url": "/media/shifts/reports/photo1.jpg" },
        { "url": "/media/shifts/reports/photo2.jpg" }
      ],
      "employeeName": "Иванов Иван",
      "employeeLogin": "ivan"
    }
  ],
  "meta": { ... }
}
```

### POST /shifts/photo-reports/
Добавить фото отчёт. `multipart/form-data`.

**Fields:**
- `photos` — файлы (поле повторяется для каждого фото, до 10 штук)
- `description` — текст описания (опционально)

> `employeeName` и `employeeLogin` — из JWT.

**Response** — созданный объект PhotoReport.

---

## Примечания для бэкенда

1. **Refresh token** — при запросе на любой защищённый эндпоинт, если access истёк, фронт автоматически делает POST /auth/refresh и повторяет запрос. Refresh должен попадать в blacklist при logout.

2. **Медиафайлы** — URL в ответе (`/media/...`) должен быть либо абсолютным `https://...`, либо относительным от хоста. Фронт умеет склеивать относительные пути с base URL.

3. **Смены** (`/shifts/`) — доступны **всем** авторизованным сотрудникам вне зависимости от поля `access`. Это особый раздел. Фронт это уже обрабатывает на своей стороне.

4. **Пагинация** — если объектов мало и бэкенд возвращает без пагинации — можно вернуть просто массив, фронт проверяет `data?.items ?? data?.results ?? (Array.isArray(data) ? data : [])`.

5. **camelCase** — фронт отправляет и ожидает получать поля в camelCase. Если бэкенд использует snake_case — нужна прослойка конвертации.
