# Бэкенд-спецификация: модуль «Таблицы» (Spreadsheet)

> Фронтенд сейчас хранит всё в `localStorage`. Задача бэкенда — заменить это хранилище.
> Данные привязаны к пользователю (по токену сессии, как и остальные модули).

---

## Структура данных

### Block (таблица / лист)

```json
{
  "id": "string",
  "name": "Финансы Июль",
  "year": 2026,
  "month": 7,
  "columns": [ ...Column ],
  "rows":    [ ...Row ],
  "createdAt": "2026-07-01T10:00:00Z",
  "updatedAt": "2026-07-08T14:22:00Z"
}
```

### Column (столбец)

```json
{
  "id": "string",
  "header": "Расходы",
  "locked": false,
  "isTotal": false,
  "width": 160,
  "order": 1
}
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | Уникальный ID столбца |
| `header` | string | Название в шапке |
| `locked` | boolean | `true` только у столбца даты — не редактируется и не удаляется |
| `isTotal` | boolean | `true` у авто-суммирующего столбца «Итого» |
| `width` | integer | Ширина в пикселях (мин. 50) |
| `order` | integer | Порядок отображения слева направо |

### Row (строка)

```json
{
  "id": "string",
  "order": 0,
  "cells": {
    "col-date": "01.07.2026",
    "abc123":   "1111",
    "def456":   "2222",
    "xyz789":   "3333"
  }
}
```

| Поле | Тип | Описание |
|---|---|---|
| `id` | string | Уникальный ID строки |
| `order` | integer | Порядок строки сверху вниз |
| `cells` | object | Ключ — `id` столбца, значение — строка (всегда string, даже числа) |

> **Важно:** столбец даты всегда имеет id `col-date`, значение формата `DD.MM.YYYY`.
> При создании блока бэкенд должен сам сгенерировать строки по количеству дней в указанном месяце.

---

## Эндпоинты

### 1. Получить все блоки пользователя

```
GET /api/spreadsheets
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "blocks": [
    {
      "id": "abc",
      "name": "Финансы Июль",
      "year": 2026,
      "month": 7,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

> Список без `columns` и `rows` — только мета. Детали грузятся при открытии.

---

### 2. Открыть блок (получить данные)

```
GET /api/spreadsheets/:blockId
Authorization: Bearer <token>
```

**Response 200:**
```json
{
  "id": "abc",
  "name": "Финансы Июль",
  "year": 2026,
  "month": 7,
  "columns": [
    { "id": "col-date", "header": "дата", "locked": true, "isTotal": false, "width": 110, "order": 0 },
    { "id": "xyz",      "header": "Расходы", "locked": false, "isTotal": false, "width": 160, "order": 1 }
  ],
  "rows": [
    { "id": "row1", "order": 0, "cells": { "col-date": "01.07.2026", "xyz": "1500" } },
    { "id": "row2", "order": 1, "cells": { "col-date": "02.07.2026", "xyz": "" }      }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

### 3. Создать блок

```
POST /api/spreadsheets
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "name": "Финансы Июль",
  "year": 2026,
  "month": 7
}
```

**Response 201:**
```json
{
  "id": "новый-id",
  "name": "Финансы Июль",
  "year": 2026,
  "month": 7,
  "columns": [
    { "id": "col-date", "header": "дата", "locked": true, "isTotal": false, "width": 110, "order": 0 }
  ],
  "rows": [
    { "id": "...", "order": 0,  "cells": { "col-date": "01.07.2026" } },
    { "id": "...", "order": 1,  "cells": { "col-date": "02.07.2026" } },
    ...
    { "id": "...", "order": 30, "cells": { "col-date": "31.07.2026" } }
  ],
  "createdAt": "...",
  "updatedAt": "..."
}
```

> Бэкенд генерирует строки сам: берёт `year` + `month`, считает количество дней в месяце,
> создаёт по одной строке на каждый день. Значение `col-date` — формат `DD.MM.YYYY`.

---

### 4. Удалить блок

```
DELETE /api/spreadsheets/:blockId
Authorization: Bearer <token>
```

**Response 200:**
```json
{ "ok": true }
```

---

### 5. Добавить столбец

```
POST /api/spreadsheets/:blockId/columns
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "header": "Столбец 2",
  "width": 160
}
```

**Response 201:**
```json
{
  "id": "новый-col-id",
  "header": "Столбец 2",
  "locked": false,
  "isTotal": false,
  "width": 160,
  "order": 2
}
```

> Бэкенд также добавляет пустую ячейку `"col-id": ""` для всех существующих строк этого блока.

---

### 6. Обновить столбец (переименовать / изменить ширину)

```
PATCH /api/spreadsheets/:blockId/columns/:columnId
Authorization: Bearer <token>
Content-Type: application/json
```

**Body (любые из полей):**
```json
{
  "header": "Новое название",
  "width": 220
}
```

**Response 200:**
```json
{
  "id": "col-id",
  "header": "Новое название",
  "width": 220,
  "locked": false,
  "isTotal": false,
  "order": 1
}
```

---

### 7. Удалить столбец

```
DELETE /api/spreadsheets/:blockId/columns/:columnId
Authorization: Bearer <token>
```

> Нельзя удалять столбцы с `locked: true` (дата). Вернуть `403`.

**Response 200:**
```json
{ "ok": true }
```

---

### 8. Добавить строку

```
POST /api/spreadsheets/:blockId/rows
Authorization: Bearer <token>
```

**Body:** *(пустое или `{}`)*

**Response 201:**
```json
{
  "id": "новый-row-id",
  "order": 31,
  "cells": {
    "col-date": "",
    "col-id-1": "",
    "col-id-2": ""
  }
}
```

> Бэкенд создаёт строку с пустыми ячейками для всех текущих столбцов блока. Ячейка даты тоже пустая — пользователь добавляет вручную.

---

### 9. Обновить ячейки строки

```
PATCH /api/spreadsheets/:blockId/rows/:rowId
Authorization: Bearer <token>
Content-Type: application/json
```

**Body:**
```json
{
  "cells": {
    "col-id-1": "1500",
    "col-id-2": "800"
  }
}
```

> Передаются только изменившиеся ячейки. Бэкенд делает merge (не перезаписывает всю строку).

**Response 200:**
```json
{
  "id": "row-id",
  "order": 0,
  "cells": {
    "col-date": "01.07.2026",
    "col-id-1": "1500",
    "col-id-2": "800",
    "col-id-3": ""
  }
}
```

---

### 10. Удалить строку

```
DELETE /api/spreadsheets/:blockId/rows/:rowId
Authorization: Bearer <token>
```

**Response 200:**
```json
{ "ok": true }
```

---

## Авто-суммирование (столбец «Итого»)

Когда пользователь нажимает **«Объединить всё»** на строке — фронтенд сам считает сумму
и сохраняет её через PATCH `/rows/:rowId`. Специального эндпоинта не нужно.

Столбец «Итого» — обычный столбец, но с `isTotal: true`.  
При `POST /columns` фронтенд может передать `"isTotal": true`.  
Бэкенд должен это поле хранить и возвращать.

---

## Коды ошибок

| Код | Когда |
|---|---|
| `400` | Невалидный body (нет `name`, некорректный `month`, и т.д.) |
| `403` | Попытка удалить/изменить `locked: true` столбец |
| `404` | Блок, столбец или строка не найдены |
| `409` | Конфликт (например, дублирующийся `id`) |

---

## Примечания для бэкенда

1. Все `id` генерирует **бэкенд** (UUID или nanoid). Фронтенд пришлёт создание, получит обратно сгенерированный `id`.
2. Поле `cells` в строке — JSON-объект `{ columnId: string }`. Все значения — строки, даже числа.
3. Столбец даты (`col-date`) — зарезервированный id; при создании блока его не нужно принимать от клиента, генерировать самому.
4. `updatedAt` блока обновляется при любом изменении внутри (столбец, строка, ячейка).
5. Авторизация — тот же механизм, что и во всех остальных модулях проекта.
