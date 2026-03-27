import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import './Select.scss';

const Select = ({
  value,
  onChange,
  options = [],
  placeholder = 'Выберите',
  disabled = false,
  invalid = false,
  className = '',
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const id = useId();
  const listboxId = `select-listbox-${id}`;

  const selected = options.find((o) => o.value === value);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(options.length * 44 + 16, 300);
    const openUp = spaceBelow < dropH + 8 && rect.top > dropH + 8;
    setPos({
      left: rect.left + window.scrollX,
      width: rect.width,
      top: openUp
        ? rect.top + window.scrollY - dropH - 4
        : rect.bottom + window.scrollY + 4,
    });
  }, [options.length]);

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((prev) => {
      if (prev) return false;
      updatePos();
      return true;
    });
  };

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !dropdownRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`dias-select ${open ? 'dias-select--open' : ''} ${disabled ? 'dias-select--disabled' : ''} ${invalid ? 'dias-select--invalid' : ''} ${className}`.trim()}
        onClick={handleTriggerClick}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-controls={open ? listboxId : undefined}
        {...rest}
      >
        <span className={`dias-select__value ${!selected ? 'dias-select__value--placeholder' : ''}`}>
          {selected ? selected.label : placeholder}
        </span>
        <span className={`dias-select__arrow ${open ? 'dias-select__arrow--up' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {open && createPortal(
        <ul
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          className="dias-select__dropdown"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {options.map((opt) => (
            <li
              key={String(opt.value)}
              role="option"
              aria-selected={opt.value === value}
              className={`dias-select__option ${opt.value === value ? 'dias-select__option--selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
            >
              {opt.label}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  );
};

export default Select;
