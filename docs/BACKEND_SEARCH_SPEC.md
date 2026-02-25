# Требования к поиску во всём API

Все параметры `search` во всех эндпоинтах должны работать одинаково.

**Важно:** при 5000+, 10000+ и более записей поиск обязан выполняться на бэкенде. Клиентская фильтрация не масштабируется.

---

## Общие правила

1. **Без учёта регистра (case-insensitive)**  
   Запрос `абы` обязан находить `АбЫтоВ`, `АБЫТОВ` и т.п.

2. **Поиск по вхождению подстроки**  
   Не точное совпадение, а «содержит»:  
   - `абы` → найти «Абытов Дияр»  
   - `701` → найти «+996701111544»  
   - `инст` → найти «Instagram»

3. **Любые символы**  
   Цифры, буквы, спецсимволы — всё участвует в поиске как есть (после trim).

4. **В Django**  
   Использовать `__icontains`, а не `__contains` или `exact`:
   ```python
   Q(name__icontains=search) | Q(phone__icontains=search) | ...
   ```

---

## Эндпоинты с поиском

| Эндпоинт | Query | Поля для поиска |
|----------|-------|-----------------|
| `GET /api/clients/` | `search` | fio, phone |
| `GET /api/employees/` | `search` | fio, login, phone |
| `GET /api/roles/` | `search` | name |
| `GET /api/sports/` | `search` | name |
| `GET /api/trainers/` | `search` | fio, name |
| `GET /api/leads/` | `search` | name, phone, channel |
| `GET /api/expense-categories/` | `search` | name |
| `GET /api/expenses/` | `search` | name и др. текстовые поля |
| `GET /api/warehouse/categories/` | `search` | name |
| `GET /api/warehouse/products/` | `search` | name |
| `GET /api/warehouse/restocks/` | `search` | по релевантным полям |

---

## ⚠️ Где применить поиск

**В Clients уже работает.** Для SQLite используйте `icontains_q` из `config/search_utils.py` — иначе кириллица не ищется без учёта регистра.

**То же самое нужно во ВСЕХ остальных эндпоинтах:**

| Приложение / ViewSet | Поля для icontains_q | Файл (примерно) |
|----------------------|----------------------|-----------------|
| clients | fio, phone | clients/views.py ✅ сделано |
| employees | fio, login, phone | accounts или employees |
| roles | name | accounts или employees |
| sports | name | sports или sports-trainers |
| trainers | fio, name (+ sports__name по ТЗ) | sports-trainers |
| leads | name, phone, channel | leads |
| expense-categories | name | expenses |
| expenses | name, comment | expenses |
| warehouse/categories | name | warehouse |
| warehouse/products | name | warehouse |
| warehouse/restocks | product__category__name и др. | warehouse |

---

## Как применять

В каждом ViewSet/фильтре, где есть поиск:

```python
from config.search_utils import icontains_q

search = request.query_params.get('search', '').strip()
if search:
    qs = qs.filter(icontains_q(search, 'fio', 'phone'))  # поля подставить по таблице выше
```

---

## Кратко для разработчика

> **Везде использовать `icontains_q(search, 'field1', 'field2', ...)` — как в clients. Без этого поиск по кириллице не работает в SQLite.**
