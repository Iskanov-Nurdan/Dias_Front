import React, { useState, useRef, useEffect } from 'react';
import './ActionMenu.scss';

const ActionMenu = ({ items, align = 'right', ariaLabel = 'Действия' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!items?.length) return null;

  return (
    <div className="action-menu" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="action-menu__trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="action-menu__dots" aria-hidden>⋯</span>
      </button>
      {open && (
        <ul className={`action-menu__dropdown action-menu__dropdown--${align}`} role="menu">
          {items.map((item, i) => (
            <li key={i} role="none">
              <button
                type="button"
                role="menuitem"
                className={`action-menu__item${item.danger ? ' action-menu__item--danger' : ''}`}
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ActionMenu;
