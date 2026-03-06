# Rahman-Ata UI/UX Redesign — Changelog

Полная модернизация интерфейса по ТЗ. Бизнес-логика и API не изменялись.

## Выполненные изменения

### 1. Дизайн-токены
- Новая цветовая система: Base, Text, Brand, Semantic, Sidebar
- Spacing: 4, 8, 12, 16, 20, 24, 32px
- Radius: sm 8px, md 10px, lg 12px, xl 16px, 2xl 20px
- Shadows: xs, sm, md, lg, xl
- Z-index: dropdown, sticky, modal, toast

### 2. Типографика
- Шрифт: Inter (Google Fonts)
- Page title: 28px / 700
- Section title: 20px / 600
- Body: 14px / 400 / 1.5

### 3. Layout
- Sidebar: 248px (collapsed 76px)
- Header: 64px, лёгкая граница
- Content padding: 24px desktop, 16px mobile

### 4. Sidebar
- Фон: #17324D
- Nav-item: height 44px, padding 0 14px, radius 12px
- Active: мягкий фон, тонкая левая линия
- Меньше визуального шума

### 5. Header
- Без тяжёлой рамки (1px вместо 2px)
- Блок пользователя: surface-secondary фон

### 6. Компоненты
- **Badge**: success, danger, warning, neutral, info
- **Toast**: radius 14px, мягкие цвета
- **Select**: min-height 42px, radius 12px
- **ConfirmModal**: radius 18px, shadow-xl
- **FiltersModal**: overlay rgba(15,23,42,0.48)

### 7. Карточки
- Border-radius: 16px
- Padding: 20px
- Shadow: 0 1px 2px + 0 6px 16px
- KPI value: 30px / 700

### 8. Таблицы
- Row height: 52px
- Padding: 14px 16px
- Header: sticky, bg #F8FAFC
- Hover: #F8FAFC

### 9. Формы
- Input min-height: 42px
- Border-radius: 12px
- Focus: 4px primary-soft shadow

### 10. Кнопки
- Primary: height 40px, radius 10px
- Secondary: border #CBD5E1
- Danger: outline или soft background

### 11. Иконки
- Lucide React (Menu, ChevronLeft, BarChart3, Users, Trophy, etc.)
- Размеры: 18px, 20px

### 12. Страницы
- SalesPage: Badge для статуса, новые карточки
- ExpensesPage: Badge для «Сохранён»/«Черновик»
- LoginPage: градиент #17324D, мягкие декорации
- AnalyticsPage: обновлённые KPI-карточки

### 13. Модалки
- Overlay: rgba(15,23,42,0.48)
- Radius: 18px
- Shadow: var(--shadow-xl)

### 14. Skeleton loading states
- **AnalyticsPage**: Skeleton cards (3 шт) + SkeletonTable (6 строк × 4 колонки)
- **EmployeesList**: SkeletonTable (8 строк × 5 колонок)
- **SalesPage**: Skeleton строки (5 × 7 колонок)
- **ClientsList**: Skeleton строки (8 × 6 колонок)
- **WarehousePage**: Skeleton строки (товары 5×8, категории 5×2, история 5×3)
- **ExpensesPage**: Skeleton строки (категории 5×2, расходы 5×6)
- **SalaryPage**: Skeleton строки (5 × 10 колонок)

### 15. Empty states
- **Клиенты**: «Нет клиентов»
- **Продажи**: «Нет продаж»
- **Склад**: «Нет товаров», «Нет категорий», «Нет пополнений»
- **Расходы**: «Нет категорий», «Нет расходов»
- **Лиды**: «Нет заявок»
- **Сотрудники, Роли, Виды спорта, Тренеры, Зарплата**: соответствующие сообщения

### 16. Mobile sidebar drawer
- Sidebar: `position: fixed`, `transform: translateX(-100%)` (закрыт)
- При открытии: `transform: translateX(0)`
- Overlay: `main-layout__mobile-overlay` (клик закрывает)
- Breakpoint: 768px

### 17. Button loading state
- **Модалки** (Client, Sale, Expense, Product и др.): `disabled={saving}` + текст «Сохранение…» / «Оформление…»
- **Login**: `disabled={loading}` + спиннер
- **Отмена продажи**: `disabled={cancellingId === s.id}` + «…»
- **Зарплата**: `disabled={isSaving}` + «Сохранение…»

---

*Редизайн выполнен по ТЗ. Версия: 1.1.*
