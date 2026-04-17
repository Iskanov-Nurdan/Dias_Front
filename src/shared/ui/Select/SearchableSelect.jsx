import React, {
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useId,
  useMemo,
} from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useModalEffect } from '../../hooks/useModalEffect';
import './Select.scss';

function getOptionSearchText(opt) {
  if (opt && typeof opt.searchText === 'string') return opt.searchText;
  if (opt && typeof opt.label === 'string') return opt.label;
  return '';
}

function getOptionMeasureText(opt) {
  if (opt && typeof opt.label === 'string') return opt.label;
  if (opt && typeof opt.searchText === 'string') return opt.searchText;
  if (opt != null && opt.value != null) return String(opt.value);
  return '';
}

function measureMaxTextWidth(texts, fontCss) {
  if (typeof document === 'undefined' || !texts.length) return 0;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = fontCss;
  let max = 0;
  for (const t of texts) {
    if (!t) continue;
    max = Math.max(max, ctx.measureText(t).width);
  }
  return Math.ceil(max);
}

const SearchableSelect = ({
  value,
  onChange,
  options = [],
  placeholder = 'Выберите',
  disabled = false,
  invalid = false,
  className = '',
  allowClear = false,
  clearValue = '',
  noMatchesText = 'Ничего не найдено',
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);
  const portalRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const id = useId();
  const listboxId = `select-listbox-${id}`;
  const isMobile = useIsMobile();

  const dismiss = useCallback(() => {
    setOpen(false);
  }, []);

  const selected = options.find((o) => o.value === value);

  const visibleOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => getOptionSearchText(opt).toLowerCase().includes(q));
  }, [options, searchQuery]);

  useModalEffect(isMobile && open, dismiss);

  const updatePos = useCallback(() => {
    if (!triggerRef.current || isMobile) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    const itemH = 44;
    const maxListH = Math.min(280, Math.floor(vh * 0.48));
    const listBodyH =
      visibleOptions.length === 0
        ? 52
        : Math.min(visibleOptions.length * itemH + 16, maxListH);
    const shellPad = 16;
    const estimatedH = listBodyH + shellPad;
    const spaceBelow = vh - rect.bottom - pad;
    const spaceAbove = rect.top - pad;
    const openUp = estimatedH > spaceBelow && spaceAbove > spaceBelow;

    const cs = getComputedStyle(triggerRef.current);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const measureTexts = options.map(getOptionMeasureText);
    const textW = measureMaxTextWidth(measureTexts, font);
    const minFromContent = textW + 40;
    let width = Math.min(vw - 2 * pad, Math.max(rect.width, minFromContent, 200));

    let left = rect.left;
    if (left + width > vw - pad) left = Math.max(pad, vw - pad - width);
    if (left < pad) left = pad;
    width = Math.min(width, vw - 2 * pad);

    let top = openUp ? rect.top - estimatedH - 4 : rect.bottom + 4;
    if (top + estimatedH > vh - pad) top = Math.max(pad, vh - pad - estimatedH);
    if (top < pad) top = pad;

    setPos({ top, left, width });
  }, [isMobile, options, visibleOptions.length]);

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
    dismiss();
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    onChange(clearValue);
    dismiss();
  };

  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setActiveIndex(-1);
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || isMobile) return;
    updatePos();
  }, [open, isMobile, updatePos, searchQuery, visibleOptions.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const idFrame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(idFrame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
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

  useLayoutEffect(() => {
    if (!open || activeIndex < 0 || !dropdownRef.current) return;
    const row = dropdownRef.current.querySelector(`[data-opt-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open, visibleOptions]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(-1);
  }, [searchQuery, open]);

  const onTriggerKeyDown = (e) => {
    if (disabled) return;
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ')) {
      if (e.key === ' ' || e.key === 'Enter') e.preventDefault();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') e.preventDefault();
      setOpen(true);
    }
  };

  const onSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!visibleOptions.length) return;
      setActiveIndex((i) => (i < 0 ? 0 : Math.min(visibleOptions.length - 1, i + 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? -1 : i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (visibleOptions.length) setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (visibleOptions.length) setActiveIndex(visibleOptions.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && visibleOptions[activeIndex]) {
        handleSelect(visibleOptions[activeIndex]);
      } else if (visibleOptions.length === 1) {
        handleSelect(visibleOptions[0]);
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      dismiss();
    }
  };

  const showClear = allowClear && !disabled && selected && value !== clearValue;

  const deskEditing = open && !isMobile;

  const desktopDropdown =
    open &&
    !isMobile && (
      <div
        ref={portalRef}
        className="dias-select__dropdown-shell"
        style={{
          position: 'fixed',
          top: pos.top,
          left: pos.left,
          width: pos.width,
          zIndex: 'var(--z-select-portal)',
        }}
      >
        <div className="dias-select__dropdown-inner dias-select__dropdown-inner--list-only">
          <ul
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            className="dias-select__dropdown-list"
          >
            {visibleOptions.length === 0 ? (
              <li className="dias-select__empty" role="presentation">
                {noMatchesText}
              </li>
            ) : (
              visibleOptions.map((opt, idx) => {
                const optionId = `${listboxId}-opt-${String(opt.value)}`;
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={String(opt.value)}
                    id={optionId}
                    data-opt-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    className={`dias-select__option ${isSelected ? 'dias-select__option--selected' : ''} ${
                      isActive ? 'dias-select__option--active' : ''
                    }`.trim()}
                    title={typeof opt.label === 'string' ? opt.label : undefined}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                  >
                    <span className="dias-select__option-text">{opt.label}</span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>
    );

  const mobileSheet = open && isMobile && (
    <div className="dias-select-sheet-root">
      <button
        type="button"
        className="dias-select-sheet__backdrop"
        aria-label="Закрыть"
        onClick={dismiss}
      />
      <div className="dias-select-sheet" role="dialog" aria-modal="true" aria-label={placeholder}>
        <div className="dias-select-sheet__handle" aria-hidden />
        <div className="dias-select-sheet__header dias-select-sheet__header--field">
          <input
            ref={searchInputRef}
            type="search"
            className="dias-select-sheet__field-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={placeholder}
            aria-label={placeholder}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="button" className="dias-select-sheet__close" onClick={dismiss} aria-label="Закрыть">
            ×
          </button>
        </div>
        <ul ref={dropdownRef} id={listboxId} role="listbox" className="dias-select-sheet__list">
          {visibleOptions.length === 0 ? (
            <li className="dias-select-sheet__empty" role="presentation">
              {noMatchesText}
            </li>
          ) : (
            visibleOptions.map((opt, idx) => (
              <li
                key={String(opt.value)}
                data-opt-index={idx}
                role="option"
                aria-selected={opt.value === value}
                className={`dias-select-sheet__option ${opt.value === value ? 'dias-select-sheet__option--selected' : ''} ${
                  idx === activeIndex ? 'dias-select-sheet__option--active' : ''
                }`.trim()}
                title={typeof opt.label === 'string' ? opt.label : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
              >
                <span className="dias-select-sheet__option-text">{opt.label}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={`dias-select ${open ? 'dias-select--open' : ''} ${deskEditing ? 'dias-select--editing' : ''} ${disabled ? 'dias-select--disabled' : ''} ${invalid ? 'dias-select--invalid' : ''} ${showClear ? 'dias-select--has-clear' : ''} ${className}`.trim()}
      >
        {deskEditing ? (
          <>
            <input
              ref={searchInputRef}
              type="text"
              inputMode="search"
              className="dias-select__value-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded
              aria-controls={listboxId}
              aria-autocomplete="list"
              role="combobox"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              {...rest}
            />
            {showClear ? (
              <span
                className="dias-select__clear"
                role="button"
                tabIndex={-1}
                aria-label="Сбросить"
                onMouseDown={handleClear}
                onClick={(e) => e.stopPropagation()}
              >
                ×
              </span>
            ) : null}
            <span className="dias-select__arrow dias-select__arrow--up" aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </>
        ) : (
          <>
            <button
              type="button"
              className="dias-select__trigger"
              onClick={handleTriggerClick}
              onKeyDown={onTriggerKeyDown}
              disabled={disabled}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={open && isMobile ? listboxId : undefined}
              {...rest}
            >
              <span className={`dias-select__value ${!selected ? 'dias-select__value--placeholder' : ''}`}>
                {selected ? selected.label : placeholder}
              </span>
            </button>
            {showClear ? (
              <span
                className="dias-select__clear"
                role="button"
                tabIndex={-1}
                aria-label="Сбросить"
                onMouseDown={handleClear}
                onClick={(e) => e.stopPropagation()}
              >
                ×
              </span>
            ) : null}
            <span className={`dias-select__arrow ${open && isMobile ? 'dias-select__arrow--up' : ''}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </>
        )}
      </div>

      {desktopDropdown && createPortal(desktopDropdown, document.body)}
      {mobileSheet && createPortal(mobileSheet, document.body)}
    </>
  );
};

export default SearchableSelect;
export { SearchableSelect };
