import React from 'react';

const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/**
 * Текстовое поле суммы с разделителем тысяч при вводе.
 * onChange отдаёт чистое число строкой (без пробелов) — тот же формат,
 * что раньше отдавал <input type="number">, downstream-код не меняется.
 */
const MoneyInput = ({ value, onChange, allowDecimals = false, className, placeholder = '0', ...rest }) => {
  const strValue = value == null ? '' : String(value);

  const displayValue = (() => {
    if (strValue === '') return '';
    if (allowDecimals && strValue.includes('.')) {
      const [intPart, decPart] = strValue.split('.');
      return `${groupThousands(intPart)}.${decPart}`;
    }
    return groupThousands(strValue.replace(/\D/g, ''));
  })();

  const handleChange = (e) => {
    const raw = e.target.value;
    if (allowDecimals) {
      let cleaned = raw.replace(/[^\d.]/g, '');
      const firstDot = cleaned.indexOf('.');
      if (firstDot !== -1) {
        cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
      }
      onChange(cleaned);
    } else {
      onChange(raw.replace(/\D/g, ''));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={displayValue}
      onChange={handleChange}
      className={className}
      placeholder={placeholder}
      {...rest}
    />
  );
};

export default MoneyInput;
