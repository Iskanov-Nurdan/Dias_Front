import React, { useEffect, useRef } from 'react';
import './Subtabs.scss';

/**
 * Второй уровень вкладок внутри раздела (например «Справочник / История
 * движения» внутри «Сырья») — визуально заметно спокойнее верхнего уровня
 * (ProductLineTabs, .ui-tabs и т.п.), чтобы иерархия читалась с первого
 * взгляда. Общий для всех разделов — не дублировать вёрстку по фичам.
 * Также годится как единственный уровень вкладок у разделов без
 * переключателя линии сверху (например «Смены») — просто ряд чипов.
 * items: [{ id, label, icon, badge, badgeAlert }] — badge опционален
 * (число записей за период и т.п.), badgeAlert красит его тревожно (красным)
 * вместо нейтрального цвета. action — кнопка главного действия текущей
 * подвкладки в той же строке справа (десктоп/планшет; на мобиле скрывается,
 * её роль берёт общий Fab) — чтобы кнопка не уезжала на отдельную строку.
 */
const Subtabs = ({ items, activeId, onChange, action }) => {
  const rowRef = useRef(null);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const activeEl = row.querySelector('[aria-selected="true"]');
    activeEl?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  return (
    <div className="subtabs-row">
      <div className="subtabs" role="tablist" ref={rowRef}>
        {items.map(({ id, label, icon: Icon, badge, badgeAlert }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeId === id}
            className={`subtabs__tab${activeId === id ? ' subtabs__tab--active' : ''}`}
            onClick={() => onChange(id)}
          >
            {Icon && <Icon size={14} />}
            {label}
            {badge != null && badge > 0 && (
              <span className={`subtabs__badge${badgeAlert ? ' subtabs__badge--alert' : ''}`}>{badge}</span>
            )}
          </button>
        ))}
      </div>
      {action && <div className="subtabs__action">{action}</div>}
    </div>
  );
};

export default Subtabs;
