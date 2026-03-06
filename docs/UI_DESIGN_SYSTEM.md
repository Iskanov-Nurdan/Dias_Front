# Rahman-Ata — Дизайн-система интерфейса

Документация текущего стиля интерфейса ERP-системы спортивного клуба «Рахман Ата».  
Создана для последующей UI/UX модернизации.

**Стек:** React, SCSS, CSS Variables. Tailwind не используется.

---

## 1. Общий стиль интерфейса

| Характеристика | Описание |
|----------------|----------|
| **Стиль** | Админка / внутренняя ERP-система. Функциональный, деловой интерфейс |
| **Плотность** | Средняя. Достаточно «воздуха», но без избыточных отступов |
| **Визуальный шум** | Низкий. Минимум декора, акцент на данных и действиях |
| **Ощущение** | Спокойный, профессиональный. Тёмно-синий сайдбар + красный акцент (цвета логотипа) |
| **Адаптивность** | Есть. Breakpoints: xs 374px, sm 479px, md 768px, lg 1023px |

---

## 2. Цветовая система

Все цвета заданы через CSS-переменные в `_variables.scss`.

| Переменная | Значение | Назначение |
|------------|----------|------------|
| `--color-bg` | `#f0f4f8` | Основной фон страницы (светло-серый с голубым оттенком) |
| `--color-bg-card` | `#ffffff` | Фон карточек, модалок, полей ввода |
| `--color-primary` | `#c53030` | Основной акцент (красный, из логотипа) |
| `--color-primary-hover` | `#9b2c2c` | Hover для primary-элементов |
| `--color-primary-light` | `rgba(197, 48, 48, 0.1)` | Лёгкий фон при hover/focus |
| `--color-text` | `#1a202c` | Основной текст |
| `--color-text-muted` | `#4a5568` | Вторичный текст, подписи |
| `--color-border` | `#e2e8f0` | Границы, разделители |
| `--color-error` | `#c53030` | Ошибки, danger-кнопки |
| `--color-error-light` | `rgba(197, 48, 48, 0.1)` | Фон при hover на danger |
| `--color-success` | `#16a34a` | Успех, оплачено |
| `--color-warning` | `#d97706` | Предупреждения |
| `--color-sidebar-bg` | `#1e3a5f` | Фон сайдбара (тёмно-синий) |
| `--color-sidebar-border` | `#2d4a6f` | Граница сайдбара |
| `--color-sidebar-text` | `rgba(255, 255, 255, 0.9)` | Текст в сайдбаре |
| `--color-sidebar-text-muted` | `rgba(255, 255, 255, 0.6)` | Вторичный текст в сайдбаре |

**Tailwind:** не используется.

---

## 3. Типографика

| Параметр | Значение |
|----------|----------|
| **Шрифт** | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif` (системный стек) |
| **font-weight body** | 400 |
| **font-weight заголовков** | 600 |
| **font-weight подписей** | 400–500 |

### Размеры текста

| Элемент | Размер | Примечание |
|---------|--------|------------|
| Заголовок страницы | 26px (22px mobile, 18px xs) | `font-weight: 600`, `letter-spacing: -0.02em` |
| Заголовок модалки | 18px | `font-weight: 400` |
| Заголовок секции | 16px | |
| Основной текст | 14px | |
| Подписи, labels | 13–14px | |
| Мелкий текст | 12px | Uppercase labels в таблицах |
| Очень мелкий | 11px | Фильтры аналитики |

### Line-height

- Явно не задан глобально; используется по умолчанию (~1.2–1.5).
- В модалках: `line-height: 1.4` для текста сообщений.

---

## 4. Layout-система

| Параметр | Значение |
|----------|----------|
| **Структура** | CSS Grid: sidebar + header + content |
| **Ширина sidebar** | 260px (развёрнут), 72px (свёрнут) |
| **Высота header** | 64px |
| **Padding контента** | 28px 24px (desktop), 16px 12px (mobile), 12px 10px (xs) |
| **Отступы между секциями** | 16–24px |

### Breakpoints (mixins)

- `xs`: max-width 374px  
- `sm`: max-width 479px  
- `mobile` / `md`: max-width 768px  
- `lg`: max-width 1023px  
- `desktop-only`: min-width 769px  

---

## 5. Sidebar

| Параметр | Значение |
|----------|----------|
| **Ширина** | 260px (развёрнут), 72px (свёрнут) |
| **Фон** | `#1e3a5f` |
| **Граница** | 2px solid `#2d4a6f` |
| **Padding контента** | 10px 12px |
| **Logo** | Высота 140px (96px в свёрнутом), mix-blend-mode: lighten |

### Пункты меню (nav-item)

| Параметр | Значение |
|----------|----------|
| **Padding** | 10px 12px |
| **Font-size** | 14px (13px xs) |
| **Font-weight** | 500 (600 для active) |
| **Цвет** | `rgba(255,255,255,0.6)` |

### Hover

- `background: rgba(255, 255, 255, 0.1)`
- `color: rgba(255, 255, 255, 0.9)`

### Active

- `background: rgba(255, 255, 255, 0.12)`
- `color: #fff`
- Слева: `::before` — 3px × 24px красная полоска (`--color-primary`)

### Группы

- `__nav-group-label`: 11px, uppercase, letter-spacing 0.06em, muted

### Иконки

- 22×22px в контейнере `__nav-icon`
- opacity 0.9 (1 для active)

### Мобильная версия

- Sidebar выезжает слева: `min(280px, 85vw)`
- Overlay: `rgba(0,0,0,0.5)`

---

## 6. Карточки (dashboard cards)

| Параметр | Значение |
|----------|----------|
| **Padding** | 18px 24px |
| **Border** | 1px solid `--color-border` |
| **Border-radius** | `--radius-lg` (12px) |
| **Shadow** | `0 1px 3px rgba(0, 0, 0, 0.06)` |
| **Gap между карточками** | 16px |
| **Min-width** | 140px |

### Карточка (summary card)

- `__card-label`: 12px, uppercase, letter-spacing 0.04em, muted
- `__card-value`: 20px, font-weight 600

### Toolbar-карточка (фильтры)

- Padding: 16px 18px
- Border-radius: `--radius-lg`
- Shadow: `--shadow-card`

---

## 7. Таблицы

| Параметр | Значение |
|----------|----------|
| **Padding ячеек** | 14px 18px |
| **Border** | 1px solid `--color-border` |
| **Border-radius** | `--radius-lg` (у контейнера) |
| **Shadow** | `--shadow-card` |

### Header

- `background: var(--color-bg)`
- `font-size: 12px`, `font-weight: 600`
- `text-transform: uppercase`, `letter-spacing: 0.04em`
- `color: var(--color-text-muted)`

### Строки

- Чётные: `background: rgba(0, 0, 0, 0.02)`
- Hover: `background: var(--color-primary-light)`
- `transition: background 0.15s ease`

### Loading-cell / Empty-cell

- `padding: 32px 16px`
- `text-align: center`

---

## 8. Формы

### Input (глобально)

| Параметр | Значение |
|----------|----------|
| **Padding** | 10px 14px (12px 14px mobile) |
| **Border** | 1px solid `--color-border` |
| **Border-radius** | `--radius-md` (10px) |
| **Font-size** | 14px (16px mobile для iOS) |
| **Min-height mobile** | 44px |

### Focus

- `outline: none`
- `border-color: var(--color-primary)`
- `box-shadow: 0 0 0 3px var(--color-primary-light)`

### Placeholder

- `color: var(--color-text-muted)`

### Error (в модалках)

- `background: rgba(220, 38, 38, 0.1)`
- `border: 1px solid #dc2626`
- `color: #b91c1c`
- `padding: 10px 12px`, `border-radius: 8px`

### Label

- `display: flex`, `flex-direction: column`, `gap: 6px`
- `font-size: 14px`
- Обязательные поля: `form-label-required` — красная звёздочка

### Select

- Стиль как у input: padding 10px 12px, border-radius `--radius-md`
- Hover: `border-color: var(--color-primary)`
- Focus: `box-shadow: 0 0 0 2px rgba(197, 48, 48, 0.15)`
- Dropdown: `max-height: 280px`, `box-shadow: 0 8px 24px rgba(0,0,0,0.12)`
- Option selected: `background: var(--color-primary-light)`, `color: var(--color-primary)`

### Textarea

- `min-height: 56px`
- `resize: vertical`

---

## 9. Кнопки

### Primary (добавить, сохранить)

| Параметр | Значение |
|----------|----------|
| **Padding** | 10px 20px (или 10px 18px в модалках) |
| **Background** | `--color-primary` |
| **Color** | #fff |
| **Border** | none |
| **Border-radius** | `--radius-md` |
| **Font-size** | 14px |
| **Font-weight** | 600 |
| **Hover** | `background: var(--color-primary-hover)` |

### Secondary (отмена, cancel)

| Параметр | Значение |
|----------|----------|
| **Padding** | 10px 18px |
| **Background** | `var(--color-bg)` или transparent |
| **Border** | 1px solid `--color-border` |
| **Color** | `--color-text` |
| **Hover** | `background: var(--color-border)` или `border-color: var(--color-primary)`, `color: var(--color-primary)` |

### Danger (удалить)

| Параметр | Значение |
|----------|----------|
| **Border** | 1px solid `--color-error` |
| **Color** | `--color-error` |
| **Background** | transparent |
| **Hover** | `background: var(--color-error-light)` |

### Маленькие action-кнопки

- Padding: 6px 12px
- Font-size: 13px
- Border-radius: `--radius-sm`

### Кнопка «Выйти» (logout)

- Padding: 8px 14px
- Font-size: 13px
- Border: 1px solid `--color-border`
- Hover: `border-color: var(--color-primary)`, `color: var(--color-primary)`

---

## 10. Модальные окна

| Параметр | Значение |
|----------|----------|
| **Overlay** | `rgba(0, 0, 0, 0.5)` |
| **Z-index** | 1000 (10000 для filters) |

### Контейнер

| Параметр | Значение |
|----------|----------|
| **Max-width** | 480–560px (зависит от модалки) |
| **Padding** | 24px (16px mobile, 12px xs) |
| **Border-radius** | 12px (10px на мобильных) |
| **Box-shadow** | `0 4px 24px rgba(0, 0, 0, 0.15)` или `0 8px 32px` |
| **Max-height** | 90vh |
| **Overflow** | `overflow-y: auto` |

### Mobile

- На мобильных: `align-items: flex-end` — модалка прижата к низу
- `border-radius: 12px 12px 0 0`

### Header

- `font-size: 18px`, `font-weight: 400`
- `margin-bottom: 20px`

### Footer (actions)

- `display: flex`, `gap: 12px`, `justify-content: flex-end`
- `margin-top: 8px`, `padding-top: 16px`, `border-top: 1px solid var(--color-border)`

### ConfirmModal

- `min-width: 280px`
- `max-width: calc(100vw - 24px)`
- `box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12)`

### FiltersModal

- `max-width: 400px`
- `max-height: 85vh`
- Анимация: `filters-modal-scale-in` (scale 0.96 → 1)

---

## 11. Toast-уведомления

| Параметр | Значение |
|----------|----------|
| **Позиция** | `bottom: 24px`, `right: 24px` |
| **Z-index** | 10000 |
| **Max-width** | 360px |
| **Gap между тостами** | 10px |

### Стиль

| Параметр | Значение |
|----------|----------|
| **Padding** | 14px 18px |
| **Border-radius** | `--radius-md` |
| **Font-size** | 14px |
| **Font-weight** | 500 |
| **Box-shadow** | `0 4px 20px rgba(0, 0, 0, 0.15)` |

### Варианты

| Тип | Background | Border | Color |
|-----|------------|--------|-------|
| `--success` | `#f0fdf4` | `#86efac` | `#166534` |
| `--error` | `#fef2f2` | `#fecaca` | `#b91c1c` |
| `--info` | `--color-bg-card` | `--color-border` | `--color-text` |

### Анимация

- `toast-in`: opacity 0→1, translateY 10px→0, 0.25s ease-out

### Кнопка закрытия

- 24×24px, opacity 0.7, hover: opacity 1

---

## 12. Иконки

| Параметр | Значение |
|----------|----------|
| **Библиотека** | Нет. Inline SVG в компонентах |
| **Стиль** | Stroke, `fill="none"`, `stroke="currentColor"` |
| **Размеры** | 18–20px (в навигации 20×20, в header 18×18) |

### Иконки в навигации

- Chart, Users, Trophy, UsersRound, Package, ShoppingCart, Receipt, Wallet, Inbox
- Контейнер: 22×22px

### Размеры

- `width: 20`, `height: 20` — основные
- `width: 18`, `height: 18` — User, LogOut

---

## Дополнительные компоненты

### Border radius

- `--radius-sm`: 8px  
- `--radius-md`: 10px  
- `--radius-lg`: 12px  
- `--radius-xl`: 14px  

### Переходы

- `--transition-fast`: 0.15s ease  
- `--transition-smooth`: 0.2s ease  

### Loading

- `loading-inline`: inline-flex, spinner 18×18px, border 2px, primary color

### Окно «Нет доступа»

- Overlay: `rgba(0, 0, 0, 0.4)`
- Box: padding 24px, border-radius `--radius-lg`, min-width 280px

### Страница логина

- Фон: `linear-gradient(145deg, #1e3a5f 0%, #2d4a6f 50%, #1a202c 100%)`
- Декоративные radial-gradient: красный оттенок
- Карточка: max-width 460px, border-radius 16px

### Pagination

- Кнопки: min-width 36px, height 36px, border-radius `--radius-sm`
- Active: primary background

### EmptyState

- Flex center, gap 16px, padding 48px 24px
- Иконка: muted, opacity 0.6
- Текст: 15px, muted, max-width 320px
- Кнопка: primary style

### ErrorState

- Flex center, gap 12px, padding 32px
- Иконка: 48×48px круг, `--color-error` фон
- Retry: outline primary button

### DonutChart

- Center text: 13px, font-weight 700
- Empty state: 13px muted, padding 24px

### Scrollbar (кастомный)

- Width/height: 8px
- Track: `--color-border`, border-radius 4px
- Thumb: `--color-text-muted`, border-radius 4px

---

*Документ актуален для Rahman-Ata frontend. Версия: 1.0.*
