import React, {
  useState, useRef, useEffect, useLayoutEffect, useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import './Select.scss';

const MOBILE_MQ = '(max-width: 768px)';
const DROPDOWN_MAX_H = 280;
const OPTION_ESTIMATE = 44;

function useIsMobileSheet() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_MQ).matches);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

/**
 * Кастомный Select: на десктопе — dropdown с авто-позицией; на мобиле — bottom sheet.
 */
const Select = ({ value, onChange, options = [], placeholder = 'Выберите...', className = '', disabled = false, icon = null }) => {
  const [open, setOpen] = useState(false);
  const [dropdownLayout, setDropdownLayout] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);
  const isMobileSheet = useIsMobileSheet();

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  const computeDesktopLayout = useCallback(() => {
    if (!rootRef.current) return null;
    const rect = rootRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const estimatedH = Math.min(DROPDOWN_MAX_H, options.length * OPTION_ESTIMATE + 16);
    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openDown = spaceBelow >= Math.min(estimatedH, 120) || spaceBelow >= spaceAbove;
    let top = openDown ? rect.bottom + 4 : Math.max(pad, rect.top - estimatedH - 4);
    let maxH = openDown
      ? Math.min(DROPDOWN_MAX_H, Math.max(pad * 2, vh - top - pad))
      : Math.min(DROPDOWN_MAX_H, Math.max(pad * 2, rect.top - pad - 4));
    let left = rect.left;
    let width = rect.width;
    if (left + width > vw - pad) {
      left = Math.max(pad, vw - width - pad);
    }
    if (left < pad) left = pad;
    if (width > vw - 2 * pad) {
      width = vw - 2 * pad;
      left = pad;
    }
    return { top, left, width, maxHeight: maxH };
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open || isMobileSheet || !rootRef.current) return;
    setDropdownLayout(computeDesktopLayout());
  }, [open, isMobileSheet, computeDesktopLayout]);

  useEffect(() => {
    if (!open || isMobileSheet) return;
    const onResize = () => setDropdownLayout(computeDesktopLayout());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open, isMobileSheet, computeDesktopLayout]);

  const handleTriggerClick = () => {
    if (disabled) return;
    if (!open && !isMobileSheet && rootRef.current) {
      setDropdownLayout(computeDesktopLayout());
    }
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      const inTrigger = rootRef.current?.contains(e.target);
      const inDropdown = dropdownRef.current?.contains(e.target);
      if (!inTrigger && !inDropdown) setOpen(false);
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const handleScroll = (e) => {
      if (isMobileSheet) return;
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 0);
    if (isMobileSheet) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        clearTimeout(id);
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('scroll', handleScroll, true);
        document.removeEventListener('mousedown', handleClickOutside, true);
        document.body.style.overflow = prev;
      };
    }
    return () => {
      clearTimeout(id);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open, isMobileSheet]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  const sheetTitle = displayLabel || placeholder;

  return (
    <div
      className={`select ${className} ${open ? 'select--open' : ''} ${disabled ? 'select--disabled' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`select__trigger${icon ? ' select__trigger--with-icon' : ''}`}
        onClick={handleTriggerClick}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {icon && <span className="select__icon" aria-hidden>{icon}</span>}
        <span className="select__value">{displayLabel}</span>
        <span className="select__chevron" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && isMobileSheet && createPortal(
        <div
          className="select__sheet-backdrop"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            ref={dropdownRef}
            className="select__sheet"
            role="listbox"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="select__sheet-handle" aria-hidden />
            <div className="select__sheet-head">
              <span className="select__sheet-title">{sheetTitle}</span>
              <button type="button" className="select__sheet-close" onClick={() => setOpen(false)} aria-label="Закрыть">✕</button>
            </div>
            <div className="select__sheet-list">
              {options.map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  role="option"
                  aria-selected={String(opt.value) === String(value)}
                  className={`select__sheet-option ${String(opt.value) === String(value) ? 'select__sheet-option--selected' : ''}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
      {open && !isMobileSheet && dropdownLayout && createPortal(
        <div
          ref={dropdownRef}
          className="select__dropdown select__dropdown--portal"
          role="listbox"
          style={{
            position: 'fixed',
            top: dropdownLayout.top,
            left: dropdownLayout.left,
            width: dropdownLayout.width,
            maxHeight: dropdownLayout.maxHeight,
            zIndex: 1100,
          }}
        >
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="option"
              aria-selected={String(opt.value) === String(value)}
              data-value={String(opt.value)}
              data-label={opt.label}
              className={`select__option ${String(opt.value) === String(value) ? 'select__option--selected' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(opt);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default Select;
