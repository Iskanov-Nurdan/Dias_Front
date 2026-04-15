import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useModalEffect } from '../../hooks/useModalEffect';
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
  const isMobile = useIsMobile();

  const selected = options.find((o) => o.value === value);

  useModalEffect(isMobile && open, () => setOpen(false));

  const updatePos = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const itemH = 44;
    const maxDrop = Math.min(288, Math.floor(vh * 0.5));
    const estimatedH = Math.min(options.length * itemH + 16, maxDrop);
    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUp = estimatedH > spaceBelow && spaceAbove > spaceBelow;
    let top = openUp ? rect.top - estimatedH - 4 : rect.bottom + 4;
    let left = rect.left;
    let width = Math.max(rect.width, 160);
    if (left + width > vw - pad) left = Math.max(pad, vw - pad - width);
    if (left < pad) left = pad;
    width = Math.min(width, vw - 2 * pad);
    if (top + estimatedH > vh - pad) top = Math.max(pad, vh - pad - estimatedH);
    if (top < pad) top = pad;
    setPos({ top, left, width });
  }, [options.length, isMobile]);

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((prev) => {
      if (prev) return false;
      if (!isMobile) updatePos();
      return true;
    });
  };

  const handleSelect = (opt) => {
    onChange(opt.value);
    setOpen(false);
  };

  useEffect(() => {
    if (!open || isMobile) return;
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
  }, [open, isMobile, updatePos]);

  const desktopDropdown = open && !isMobile && (
    <ul
      ref={dropdownRef}
      id={listboxId}
      role="listbox"
      className="dias-select__dropdown"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
      }}
    >
      {options.map((opt) => (
        <li
          key={String(opt.value)}
          role="option"
          aria-selected={opt.value === value}
          className={`dias-select__option ${opt.value === value ? 'dias-select__option--selected' : ''}`}
          title={typeof opt.label === 'string' ? opt.label : undefined}
          onMouseDown={(e) => {
            e.preventDefault();
            handleSelect(opt);
          }}
        >
          <span className="dias-select__option-text">{opt.label}</span>
        </li>
      ))}
    </ul>
  );

  const mobileSheet = open && isMobile && (
    <div className="dias-select-sheet-root">
      <button
        type="button"
        className="dias-select-sheet__backdrop"
        aria-label="Закрыть"
        onClick={() => setOpen(false)}
      />
      <div className="dias-select-sheet" role="dialog" aria-modal="true" aria-label={placeholder}>
        <div className="dias-select-sheet__handle" aria-hidden />
        <div className="dias-select-sheet__header">
          <span className="dias-select-sheet__title">{placeholder}</span>
          <button type="button" className="dias-select-sheet__close" onClick={() => setOpen(false)} aria-label="Закрыть">
            ×
          </button>
        </div>
        <ul
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          className="dias-select-sheet__list"
        >
          {options.map((opt) => (
            <li
              key={String(opt.value)}
              role="option"
              aria-selected={opt.value === value}
              className={`dias-select-sheet__option ${opt.value === value ? 'dias-select-sheet__option--selected' : ''}`}
              title={typeof opt.label === 'string' ? opt.label : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(opt);
              }}
            >
              <span className="dias-select-sheet__option-text">{opt.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

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

      {desktopDropdown && createPortal(desktopDropdown, document.body)}
      {mobileSheet && createPortal(mobileSheet, document.body)}
    </>
  );
};

export default Select;
