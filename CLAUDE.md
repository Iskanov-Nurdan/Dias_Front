# Dias Line — фронтенд DIAS_ERP

## Что это за проект

Этот репозиторий (`Dias line`) — React-фронтенд, который изначально был клоном
гимн-клубного CRM «Rahman Ata», а сейчас поэтапно, страница за страницей,
переводится на реальный производственный бэкенд DIAS_ERP (Django/DRF).
Миграция почти завершена: из старого функционала физически остались только
"Журнал действий" и "Смены", всё остальное (аналитика, лиды, расходы, зарплата,
spreadsheet, отчёт тренера, спорт и тренеры, публичная Taplink-страница,
старые клиенты) — **удалено из кода полностью**, не спрятано.

Всё, что осталось от старого проекта (его ТЗ бэкенда, иконки, robots.txt и
sitemap на чужой домен), удалено — связи с ним у этого репозитория нет.
Источник правды по API — только бэкенд DIAS_ERP (см. ниже).

## Где лежит бэкенд

Реальный бэкенд, на который сейчас переведён этот фронт:

```
C:\Users\abyto\Documents\GitHub ADAM\DIas_ERP
```

Это отдельный git-репозиторий, Django/DRF. Если нужно свериться со схемой
эндпоинта, правами доступа, моделью — **сначала читай код в DIas_ERP**, а не
угадывай по фронту. Ключевые места:

- `config/settings.py` — `ACCESS_KEYS` (полный список ключей доступа, каких
  реально проверяет бэкенд), `USERS_PLANNER_ACCESS_KEYS` и т.п.
- `config/permissions.py` — `IsAdminOrHasAccess`, механика `required_access_key`.
- `apps/<domain>/views.py` — у каждого view/viewset ищи `required_access_key`,
  это то, что реально гейтит доступ (может не совпадать с "логичным" именем
  страницы — например, ОТК и Заготовка/Цех на бэкенде гейтятся ключом
  `materials`, а не `otk`/`workshop`; журнал действий для админа — ключом
  `shifts`, отдельного `activity-log` в `ACCESS_KEYS` нет).
- `apps/foam/` — вторая производственная линия «Пенополистирол» (raw-lots,
  density-grades, production-runs, gp-stock/gp-operations, sales). Полностью
  реализована и покрыта тестами (`python manage.py test apps.foam`, venv в
  `DIas_ERP/venv`).
- `apps/materials`, `apps/workshop`, `apps/production`, `apps/warehouse`,
  `apps/sales` — основная линия «Пластиковый профиль».

**Правило по бэкенду:** для основной линии (профиль) — сначала исследуй код,
не изменяй без явного разрешения пользователя на конкретную правку. Для
изменений, которые пользователь явно попросил делать сразу и в бэкенде, и во
фронте (как это было с добавлением линии Foam) — можно редактировать DIas_ERP
напрямую. При любых изменениях бэкенда — гоняй тесты соответствующего app
(`python manage.py test apps.<app>`) перед тем как считать задачу готовой.

## Структура сайдбара (реальная, из DIAS_ERP)

```
Сотрудники        → pageId: employees        → access-key: users
Сырьё             → pageId: materials        → access-key: materials
Заготовка         → pageId: workshop         → access-key: materials
Цех               → pageId: workshop-floor   → access-key: materials
Производство      → pageId: production       → access-key: production
ОТК               → pageId: otk              → access-key: materials
Склад             → pageId: warehouse        → access-key: warehouse
Клиенты           → pageId: clients          → access-key: clients
Касса             → pageId: sales            → access-key: sales
Смены             → pageId: shifts           → access-key: shifts
Журнал действий   → pageId: activity-log     → access-key: shifts (!)
```

Маппинг pageId → access-key лежит в `src/shared/constants/pages.js`
(`PAGE_ID_ACCESS_KEY_MAP`), группировка сайдбара — там же (`PAGE_GROUPS`).
Полный список ключей доступа для UI модалки «Управление доступами» —
`src/shared/constants/accessKeys.js` (`ACCESS_KEYS` намеренно урезан до
того, что реально видно в сайдбаре + `analytics`, — на бэкенде ключей больше,
но остальные относятся к ещё не мигрированным сюда страницам).

Обе линии производства (профиль/Foam) переключаются тумблером
`useProductLine` (`src/shared/hooks/useProductLine.js`, persist в
`localStorage['dias_product_line']`) на страницах Materials/Production/
Warehouse/Sales. У Foam нет стадий Заготовка/Цех/ОТК — там сырьё сразу идёт
в производство гранул.

## Дизайн-система фронта

Токены — `src/shared/styles/_variables.scss`: шрифт `Plus Jakarta Sans`,
акцент `--color-primary: #C53030` (+ `-hover`/`-soft`), нейтральный slate
(`--color-bg/surface/surface-secondary/border/border-strong`), семантика
`--color-success/danger/warning/info` (+ `-soft`), spacing `--space-1..12`
(шаг 8px), радиусы `--radius-sm(8)/md(10)/lg(12)/xl(16)/2xl(20)`, тени
`--shadow-xs/sm/md/lg/xl`, `--input-radius`, `--input-shadow-focus`. Тёмная
тема — `[data-theme='dark']` на `:root`. Общие миксины —
`src/shared/styles/_mixins.scss` (`modal-backdrop`, `modal-close-btn`,
`scrollbar`, `page-tabs-row`, `mobile`/`desktop-only`, `text-ellipsis`).

**Установленный паттерн полного визуального редизайна страницы** (применён
единообразно к Материалам, Заготовке, Цеху, Производству, ОТК, Складу,
Клиентам, Кассе — если попросят редизайн ещё одной страницы, копируй этот же
язык, не изобретай новый):

- Саб-табы страницы: pill-кнопки с иконкой в цветном квадрате
  (`__subtab-icon`, 22×22, radius 7px), активная — `background: var(--color-primary)`.
- Списки: `__panel` (surface + border + radius-lg + padding 6px) →
  `__table` с `border-collapse: separate; border-spacing: 0 6px` — трюк
  "карточная строка": `td:first-child`/`td:last-child` получают
  `border-radius` + боковой border, так что каждая `<tr>` выглядит как
  скруглённая карточка с зазором. Плюс `tbody tr { animation: ...-row-in
  0.25s cubic-bezier(0.16,1,0.3,1) both; animation-delay: calc(var(--row-i,0)
  * 30ms); }` (ступенчатое появление, `--row-i` — инлайн-стиль на строке) с
  `@media (prefers-reduced-motion: reduce) { animation: none }`. Имя — с
  маленьким круглым/квадратным аватаром (`__avatar`, 28-30px). Статусы —
  "пилюля с точкой" (`__status`/`__status-dot`). Действия строки — круглые
  `__icon-btn` (30×30, `border-radius: 50%`) + опционально pill-кнопка.
- Модалки: `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-xl)`,
  анимация появления `scale(0.96→1) + translateY(8px→0)` за 0.22s; backdrop —
  `backdrop-filter: blur(3px)`; иконка в заголовке превращается в цветной
  бейдж CSS-трюком без правки JSX: `.xxx__title > svg:first-child { width/
  height: 34px !important; padding: 8px; background: var(--color-primary-soft);
  color: var(--color-primary); border-radius: var(--radius-md); }`; ошибки —
  `background: var(--color-danger-soft)` + shake-анимация ±3px; разделители
  секций — `border-top: 1px dashed var(--color-border)`; кнопки в футере —
  hover-lift, заскоуплено под `.xxx__actions .ui-modal-btn` (не трогая
  глобальный класс).

**Железное правило:** никогда не редактировать глобальные/шаренные классы
(`ui-tabs`, `ui-search`, `ui-list__*`, `ui-pill`, `ui-modal-btn` сам по себе,
компоненты `Select`/`MoneyInput`/`SubmitButton`/`EmptyState`/`SkeletonTable`/
`ConfirmModal`/`Pagination`) — это ломает уже одобренные страницы без ревью.
Вместо этого — дублировать нужные стили в page/feature-scoped классы. Это
проверено на 8+ подряд редизайнах без единой регрессии.

## Формат работы с пользователем

Пользователь — не разработчик, объясняет задачу по-русски, иногда сумбурно,
часто со скриншотами. Для содержательных задач (не мелких правок) отвечай в
строгом архитекторском формате перед реализацией:

```
КАК Я ПОНЯЛ ЗАДАЧУ / ФИРМЕННЫЙ СТИЛЬ ПРОЕКТА / ОЦЕНКА ТВОЕЙ ИДЕИ /
ЛУЧШЕЕ РЕШЕНИЕ / АЛЬТЕРНАТИВЫ, КОТОРЫЕ Я ОТБРОСИЛ / ЧТО МЕНЯЮ В ЛОГИКЕ /
ЧТО МЕНЯЮ В ВИЗУАЛЕ / ПОДВОДНЫЕ КАМНИ / НУЖНО ОТ БЭКЕНДА / НА БУДУЩЕЕ
```

Реализуй только после явного согласия ("приступай", "давай"). Для быстрых
однозначных правок (типа "убери это поле") формат не нужен — делай сразу.

После любой правки JS/SCSS — прогони `npx eslint <путь>` и
`CI= npx react-scripts build`, и проверь `grep -rn "ui-list__" <feature>` на
отсутствие старых глобальных классов, если делался редизайн списка.

## Git

Ветка/атрибуция коммитов — стандартные правила Claude Code. Ничего в этом
проекте не коммить без явной просьбы пользователя.
