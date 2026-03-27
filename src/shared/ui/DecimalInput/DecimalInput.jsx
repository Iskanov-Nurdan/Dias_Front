import React, { useState } from 'react';
import { formatNumberForInput, parseLocaleNumber } from '../../lib/numbers';

function sanitizeTypedDecimal(raw) {
  if (raw == null) return '';
  let s = String(raw);
  const neg = s.startsWith('-');
  s = s.replace(/^-/, '');
  s = s.replace(/[^\d.,]/g, '');
  let sepSeen = false;
  let out = '';
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '.' || c === ',') {
      if (!sepSeen) {
        out += c;
        sepSeen = true;
      }
    } else {
      out += c;
    }
  }
  return (neg ? '-' : '') + out;
}

/**
 * Текстовое поле для десятичных чисел: запятая или точка, без хвостовых нулей с бэка.
 */
const DecimalInput = ({
  value,
  onChange,
  min,
  max,
  className = '',
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const strVal = value === undefined || value === null ? '' : String(value);

  const blurredDisplay =
    strVal === '' ? '' : formatNumberForInput(strVal);

  const displayVal = focused ? strVal : blurredDisplay;

  const handleFocus = (e) => {
    setFocused(true);
    const n = parseLocaleNumber(strVal);
    if (strVal !== '' && Number.isFinite(n)) {
      onChange?.(formatNumberForInput(n));
    }
    onFocus?.(e);
  };

  const handleBlur = (e) => {
    setFocused(false);
    const raw = strVal.trim();
    if (raw === '' || raw === '-') {
      onChange?.('');
      onBlur?.(e);
      return;
    }
    let n = parseLocaleNumber(raw);
    if (!Number.isFinite(n)) {
      onChange?.('');
      onBlur?.(e);
      return;
    }
    if (min !== undefined && min !== '' && min !== null) {
      const lo = Number(min);
      if (Number.isFinite(lo) && n < lo) n = lo;
    }
    if (max !== undefined && max !== '' && max !== null) {
      const hi = Number(max);
      if (Number.isFinite(hi) && n > hi) n = hi;
    }
    onChange?.(formatNumberForInput(n));
    onBlur?.(e);
  };

  const handleChange = (e) => {
    const s = sanitizeTypedDecimal(e.target.value);
    onChange?.(s);
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={className}
      value={displayVal}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
};

export default DecimalInput;
