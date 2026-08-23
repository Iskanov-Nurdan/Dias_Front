import React, { useState, useRef, useEffect } from 'react';
import { FiFilter, FiChevronDown } from 'react-icons/fi';
import './FilterPanel.scss';

/**
 * Кнопка «Фильтры N» со счётчиком активных значений — раскрывает панель с
 * сеткой полей (обычно Select с иконками). Единый паттерн вместо длинной
 * строки select-ов в тулбаре.
 */
const FilterPanel = ({ activeCount = 0, onReset, children }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="filter-panel" ref={rootRef}>
      <button
        type="button"
        className={`filter-panel__trigger${open ? ' filter-panel__trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <FiFilter aria-hidden size={16} strokeWidth={2} />
        Фильтры
        {activeCount > 0 && <span className="filter-panel__count">{activeCount}</span>}
        <FiChevronDown aria-hidden size={16} strokeWidth={2} className="filter-panel__chevron" />
      </button>

      {open && (
        <div className="filter-panel__sheet" role="dialog">
          <div className="filter-panel__grid">{children}</div>
          {onReset && (
            <div className="filter-panel__footer">
              <button type="button" className="filter-panel__reset" onClick={onReset}>
                Сбросить всё
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Поле панели: uppercase-подпись сверху + select/инпут снизу. */
export const FilterPanelField = ({ label, children }) => (
  <div className="filter-panel__field">
    <span className="filter-panel__field-label">{label}</span>
    {children}
  </div>
);

export default FilterPanel;
