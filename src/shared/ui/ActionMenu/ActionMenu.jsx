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
    const trigger = rootRef.current;
    const menu = dropdownRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fallbackW = 168;

    const apply = () => {
      const m = dropdownRef.current;
      if (!m) return;
      const mw = m.offsetWidth || fallbackW;
      const mh = m.offsetHeight || 0;

      let left = align === 'right' ? rect.right - mw : rect.left;
      left = Math.max(pad, Math.min(left, vw - pad - mw));

      let top = rect.bottom + gap;
      if (mh > 0 && top + mh > vh - pad) {
        top = rect.top - mh - gap;
      }
      if (mh > 0) {
        top = Math.max(pad, Math.min(top, vh - pad - mh));
      } else {
        top = Math.max(pad, top);
      }

      setMenuStyle({
        position: 'fixed',
        top,
        left,
        right: 'auto',
        zIndex: MENU_Z,
      });
    };

    if (!menu) {
      setMenuStyle({
        position: 'fixed',
        top: Math.max(pad, rect.bottom + gap),
        left: Math.max(
          pad,
          Math.min(
            align === 'right' ? rect.right - fallbackW : rect.left,
            vw - pad - fallbackW
          )
        ),
        right: 'auto',
        zIndex: MENU_Z,
      });
      return;
    }

    apply();
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const id = requestAnimationFrame(() => {
      updatePosition();
    });
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition, items?.length]);

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
