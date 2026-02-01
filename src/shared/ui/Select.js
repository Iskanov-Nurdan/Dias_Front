import React, { useState, useRef, useEffect } from 'react';
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
  const rootRef = useRef(null);

  const selectedOption = options.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="select__dropdown" role="listbox">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="option"
              aria-selected={String(opt.value) === String(value)}
              className={`select__option ${String(opt.value) === String(value) ? 'select__option--selected' : ''}`}
              onClick={() => handleSelect(opt)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Select;
