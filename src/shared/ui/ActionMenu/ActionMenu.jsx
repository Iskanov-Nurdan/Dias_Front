import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FiEye, FiEdit3, FiTrash2, FiPlus, FiSlash, FiSquare } from 'react-icons/fi';
import './ActionMenu.scss';

const MENU_Z = 1100;
const SHEET_MAX = 768;

/** Иконка по тексту пункта — угадывается по подстроке, чтобы не трогать все места вызова ActionMenu. */
const LABEL_ICON_RULES = [
  [/удал/i, FiTrash2],
  [/^создать/i, FiPlus],
  [/деактивир|^активир/i, FiSlash],
  [/закрыть смену|остановит/i, FiSquare],
  [/редактир/i, FiEdit3],
  [/^открыть$/i, FiEye],
];

const resolveItemIcon = (item) => {
  if (item.icon) return item.icon;
  const label = String(item.label || '');
  const rule = LABEL_ICON_RULES.find(([re]) => re.test(label));
  return rule ? rule[1] : null;
};

const safePad = () => {
  if (typeof window === 'undefined') return 12;
  const st = window.getComputedStyle(document.documentElement);
  const l = parseFloat(st.paddingLeft) || 0;
  const r = parseFloat(st.paddingRight) || 0;
  const base = Math.max(12, l, r, 8);
  return base;
};

const safeInsetBottom = () => {
  if (typeof window === 'undefined') return 0;
  const v = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const shouldUseSheetMenu = (vw) => {
  if (typeof window === 'undefined') return false;
  const isNarrow = vw <= SHEET_MAX;
  const isTouch =
    window.matchMedia?.('(pointer: coarse)')?.matches
    || window.matchMedia?.('(hover: none)')?.matches
    || (navigator?.maxTouchPoints ?? 0) > 0;
  return isNarrow && isTouch;
};

const ActionMenu = ({ items, align = 'right', ariaLabel = 'Действия' }) => {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const [sheet, setSheet] = useState(false);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    const trigger = rootRef.current;
    const menu = dropdownRef.current;
    if (!trigger) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = safePad();
    const bottomInset = safeInsetBottom();
    const useSheet = shouldUseSheetMenu(vw);
    setSheet(useSheet);

    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const fallbackW = Math.min(220, vw - 2 * pad);

    if (useSheet) {
      setMenuStyle({
        position: 'fixed',
        left: pad,
        right: pad,
        top: 'auto',
        bottom: Math.max(pad, bottomInset + 8),
        width: 'auto',
        maxWidth: 'none',
        maxHeight: `min(55dvh, ${Math.floor(vh * 0.55)}px)`,
        zIndex: MENU_Z,
      });
      return;
    }

    const apply = () => {
      const m = dropdownRef.current;
      if (!m) return;
      let mw = m.offsetWidth || fallbackW;
      mw = Math.min(mw, vw - 2 * pad);
      const mh = m.offsetHeight || 0;

      let left = align === 'right' ? rect.right - mw : rect.left;
      if (left + mw > vw - pad) left = vw - pad - mw;
      if (left < pad) left = pad;

      let top = rect.bottom + gap;
      if (mh > 0 && top + mh > vh - pad - bottomInset) {
        top = rect.top - mh - gap;
      }
      if (mh > 0) {
        top = Math.max(pad, Math.min(top, vh - pad - bottomInset - mh));
      } else {
        top = Math.max(pad, top);
      }

      setMenuStyle({
        position: 'fixed',
        top,
        left,
        right: 'auto',
        width: `${mw}px`,
        maxWidth: `${vw - 2 * pad}px`,
        maxHeight: `min(320px, calc(100dvh - ${pad * 2}px))`,
        zIndex: MENU_Z,
      });
    };

    if (!menu) {
      setMenuStyle({
        position: 'fixed',
        top: Math.max(pad, rect.bottom + gap),
        left: Math.max(pad, Math.min(align === 'right' ? rect.right - fallbackW : rect.left, vw - pad - fallbackW)),
        right: 'auto',
        width: `${fallbackW}px`,
        maxWidth: `${vw - 2 * pad}px`,
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

  const dropdownClass = [
    'action-menu__dropdown',
    'action-menu__dropdown--portal',
    `action-menu__dropdown--${align}`,
    sheet ? 'action-menu__dropdown--sheet' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const backdrop =
    open && sheet ? (
      <button
        type="button"
        className="action-menu__backdrop"
        aria-label="Закрыть меню"
        tabIndex={-1}
        onClick={() => setOpen(false)}
      />
    ) : null;

  const dropdown = open ? (
    <ul ref={dropdownRef} className={dropdownClass} style={menuStyle} role="menu">
      {items.map((item, i) => {
        const Icon = resolveItemIcon(item);
        const showDivider = i > 0 && Boolean(item.danger) !== Boolean(items[i - 1].danger);
        return (
          <React.Fragment key={i}>
            {showDivider && <li role="separator" className="action-menu__divider" />}
            <li role="none">
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
                <span className="action-menu__item-icon" aria-hidden>
                  {Icon && <Icon size={16} strokeWidth={2} />}
                </span>
                {item.label}
              </button>
            </li>
          </React.Fragment>
        );
      })}
    </ul>
  ) : null;

  return (
    <div className="action-menu" ref={rootRef} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`action-menu__trigger${open ? ' action-menu__trigger--open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <span className="action-menu__dots" aria-hidden>
          ⋯
        </span>
        <span className="action-menu__hint">{ariaLabel}</span>
      </button>
      {open && backdrop && createPortal(backdrop, document.body)}
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  );
};

export default ActionMenu;
