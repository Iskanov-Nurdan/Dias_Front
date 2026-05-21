import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../../../shared/hooks/useIsMobile';
import '../../../../shared/ui/Select/Select.scss';
import './BlankMultiSelect.scss';

const BlankMultiSelect = ({
  value = [],
  onChange,
  options = [],
  placeholder = 'Выберите',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const isMobile = useIsMobile();
  const selected = useMemo(() => new Set((value || []).map(String)), [value]);
  const dataOpts = useMemo(() => options.filter((o) => o.value), [options]);

  const triggerLabel = useMemo(() => {
    if (!selected.size) return placeholder;
    const names = dataOpts
      .filter((o) => selected.has(String(o.value)))
      .map((o) => o.label)
      .filter(Boolean);
    if (!names.length) return placeholder;
    if (names.length <= 2) return names.join(', ');
    return `${names.length} выбрано`;
  }, [selected, dataOpts, placeholder]);

  const dismiss = useCallback(() => setOpen(false), []);

  const updatePos = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const itemH = 40;
    const maxListH = Math.min(280, Math.floor(vh * 0.48));
    const listH = Math.min(Math.max(dataOpts.length, 1) * itemH + 12, maxListH);
    const estimatedH = listH + 8;
    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUp = estimatedH > spaceBelow && spaceAbove > spaceBelow;
    let width = Math.min(vw - 2 * pad, Math.max(rect.width, 220));
    let left = rect.left;
    if (left + width > vw - pad) left = Math.max(pad, vw - pad - width);
    let top = openUp ? rect.top - estimatedH - 4 : rect.bottom + 4;
    if (top + estimatedH > vh - pad) top = Math.max(pad, vh - pad - estimatedH);
    setPos({ top, left, width });
  }, [isMobile, dataOpts.length]);

  const handleTriggerClick = () => {
    if (disabled) return;
    setOpen((prev) => {
      if (prev) return false;
      if (!isMobile) updatePos();
      return true;
    });
  };

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    updatePos();
  }, [open, isMobile, updatePos, dataOpts.length]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !portalRef.current?.contains(e.target)
      ) {
        dismiss();
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, dismiss, updatePos]);

  const listBody = (
    <ul className="dias-select__dropdown-list blank-multi-select__list">
      {dataOpts.length === 0 ? (
        <li className="dias-select__empty" role="presentation">
          Нет заготовок для этой заявки
        </li>
      ) : (
        dataOpts.map((opt) => {
          const id = String(opt.value);
          const checked = selected.has(id);
          return (
            <li key={id} className="blank-multi-select__item" role="presentation">
              <label
                className="blank-multi-select__label"
                onMouseDown={(e) => e.preventDefault()}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(id)}
                />
                <span className="blank-multi-select__text">{opt.label}</span>
              </label>
            </li>
          );
        })
      )}
    </ul>
  );

  const desktopDropdown =
    open &&
    !isMobile &&
    createPortal(
      <div
        ref={portalRef}
        className="dias-select__dropdown-shell blank-multi-select__shell"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 'var(--z-select-portal)',
        }}
      >
        <div className="dias-select__dropdown-inner dias-select__dropdown-inner--list-only">
          {listBody}
        </div>
      </div>,
      document.body,
    );

  const mobileSheet =
    open &&
    isMobile &&
    createPortal(
      <div className="dias-select-sheet-root" ref={portalRef}>
        <button
          type="button"
          className="dias-select-sheet__backdrop"
          aria-label="Закрыть"
          onClick={dismiss}
        />
        <div className="dias-select-sheet" role="dialog" aria-modal="true" aria-label={placeholder}>
          <div className="dias-select-sheet__handle" aria-hidden />
          <div className="dias-select-sheet__header">
            <span className="dias-select-sheet__title">{placeholder}</span>
            <button type="button" className="dias-select-sheet__close" onClick={dismiss} aria-label="Закрыть">
              ×
            </button>
          </div>
          <div className="dias-select-sheet__list blank-multi-select__sheet-list">{listBody}</div>
        </div>
      </div>,
      document.body,
    );

  return (
    <>
      <div
        ref={triggerRef}
        className={`dias-select blank-multi-select${open ? ' dias-select--open' : ''}${
          disabled ? ' dias-select--disabled' : ''
        }`}
      >
        <button
          type="button"
          className="dias-select__trigger"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={handleTriggerClick}
        >
          <span className={`dias-select__value${!selected.size ? ' dias-select__value--placeholder' : ''}`}>
            {triggerLabel}
          </span>
        </button>
        <span className={`dias-select__arrow ${open && isMobile ? 'dias-select__arrow--up' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </div>
      {desktopDropdown}
      {mobileSheet}
    </>
  );
};

export default BlankMultiSelect;
