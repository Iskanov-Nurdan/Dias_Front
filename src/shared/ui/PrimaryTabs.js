import React from 'react';
import './PrimaryTabs.scss';

/**
 * Вкладки верхнего уровня раздела (когда это не переключатель линии
 * профиль/пенопласт — для него есть ProductLineTabs, визуально идентичный
 * этому компоненту). Сегментированный блок со скользящим индикатором,
 * иконка + подпись (короткая — на мобиле, чтобы не обрезалась). Единый
 * primary-стиль для всех разделов — см. Subtabs для вложенного уровня.
 *
 * items: [{ id, label, shortLabel, icon }]
 * action — кнопка главного действия страницы в той же строке справа
 * (десктоп/планшет); на мобиле скрывается сама — там место FAB.
 */
const PrimaryTabs = ({ items, activeId, onChange, action }) => {
  const activeIndex = Math.max(0, items.findIndex((i) => i.id === activeId));

  return (
    <div className="primary-tabs-row">
      <div
        className="primary-tabs"
        role="tablist"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        <span
          className="primary-tabs__indicator"
          aria-hidden="true"
          style={{ width: `calc(100% / ${items.length})`, transform: `translateX(${activeIndex * 100}%)` }}
        />
        {items.map(({ id, label, shortLabel, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeId === id}
            className={`primary-tabs__tab${activeId === id ? ' primary-tabs__tab--active' : ''}`}
            onClick={() => onChange(id)}
          >
            {Icon && <Icon size={15} />}
            {shortLabel ? (
              <>
                <span className="primary-tabs__label-full">{label}</span>
                <span className="primary-tabs__label-short">{shortLabel}</span>
              </>
            ) : label}
          </button>
        ))}
      </div>
      {action && <div className="primary-tabs__action">{action}</div>}
    </div>
  );
};

export default PrimaryTabs;
