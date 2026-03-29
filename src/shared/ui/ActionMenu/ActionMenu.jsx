import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './ActionMenu.scss';

/** Above headers/sidebars; below toasts (see _variables.scss). */
const MENU_Z = 1100;

const ActionMenu = ({ items, align = 'right', ariaLabel = 'Действия' }) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const top = rect.bottom + gap;
    if (align === 'right') {
      setMenuStyle({
        position: 'fixed',
        top,
        right: Math.max(8, window.innerWidth - rect.right),
        left: 'auto',
        zIndex: MENU_Z,
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        top,
        left: Math.max(8, rect.left),
        right: 'auto',
        zIndex: MENU_Z,
      });
    }
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
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

  const dropdown = open ? (
    <ul
      ref={dropdownRef}
      className={`action-menu__dropdown action-menu__dropdown--portal action-menu__dropdown--${align}`}
      style={menuStyle}
      role="menu"
    >
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
  ) : null;

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
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
};

export default ActionMenu;
