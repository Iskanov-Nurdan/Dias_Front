import React, { useState } from 'react';

function sanitizeInt(raw) {
  if (raw == null) return '';
  const s = String(raw).replace(/[^\d-]/g, '');
  if (s === '' || s === '-') return s;
  const neg = s.startsWith('-');
  const digits = (neg ? s.slice(1) : s).replace(/\D/g, '');
  if (digits === '') return neg ? '-' : '';
  const n = neg ? `-${digits}` : digits;
  return n.replace(/^(-?)0+(\d)/, '$1$2') || (neg ? '-' : '0');
}

/**
 * Целое число ≥ min (по умолчанию 1). Без дробной части — для штук, упаковок, принято/брак ОТК.
 */
const IntegerInput = ({
  value,
  onChange,
  min = 1,
  max,
  className = '',
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const strVal = value === undefined || value === null ? '' : String(value);
  const displayVal = focused ? strVal : strVal;

  const clamp = (n) => {
    let v = n;
    if (min !== undefined && min !== '' && Number.isFinite(Number(min))) {
      const lo = Number(min);
      if (v < lo) v = lo;
    }
    if (max !== undefined && max !== '' && Number.isFinite(Number(max))) {
      const hi = Number(max);
      if (v > hi) v = hi;
    }
    return v;
  };

  const handleBlur = (e) => {
    setFocused(false);
    const raw = String(strVal).trim();
    if (raw === '' || raw === '-') {
      onChange?.('');
      onBlur?.(e);
      return;
    }
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n)) {
      onChange?.('');
      onBlur?.(e);
      return;
    }
    onChange?.(String(clamp(n)));
    onBlur?.(e);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      className={className}
      value={displayVal}
      onChange={(e) => onChange?.(sanitizeInt(e.target.value))}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={handleBlur}
    />
  );
};

export default IntegerInput;
