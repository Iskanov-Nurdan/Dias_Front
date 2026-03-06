import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './Select.scss';

/**
 * Кастомный Select (dropdown) с современным UI.
 * @param {string|number} value - выбранное значение
 * @param {function} onChange - (value) => void
 * @param {Array<{value: string|number, label: string}>} options
 * @param {string} [placeholder] - текст когда ничего не выбрано
 * @param {string} [className]
 * @param {boolean} [disabled]
 */
const Select = ({ value, onChange, options = [], placeholder = 'Выберите...', className = '', disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const rootRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [open]);

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
      if (dropdownRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open]);

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div
      className={`select ${className} ${open ? 'select--open' : ''} ${disabled ? 'select--disabled' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="select__trigger"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="select__value">{displayLabel}</span>
        <span className="select__chevron" aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && dropdownPosition && createPortal(
        <div
          ref={dropdownRef}
          className="select__dropdown select__dropdown--portal"
          role="listbox"
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 1100,
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="option"
              aria-selected={String(opt.value) === String(value)}
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
