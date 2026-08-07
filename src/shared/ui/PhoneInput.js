import React from 'react';

/**
 * Форматирует телефон по мере ввода: +996 XXX XXX XXX или 0XXX XXX XXX,
 * иначе просто группирует цифры по три. Хранимое значение — обычная строка,
 * формат отправки на бэкенд не меняется (как и раньше).
 */
export const formatPhone = (raw) => {
  if (!raw) return '';
  const plus = raw.trim().startsWith('+') ? '+' : '';
  const digits = raw.replace(/\D/g, '');

  if (plus && digits.startsWith('996')) {
    const rest = digits.slice(3, 12);
    const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 9)].filter(Boolean);
    return parts.length ? `+996 ${parts.join(' ')}` : '+996';
  }
  if (digits.startsWith('0')) {
    const rest = digits.slice(0, 10);
    const parts = [rest.slice(0, 4), rest.slice(4, 7), rest.slice(7, 10)].filter(Boolean);
    return parts.join(' ');
  }
  return digits.replace(/(\d{3})(?=\d)/g, '$1 ');
};

const PhoneInput = ({ value, onChange, className, placeholder = '+996 700 000 000', ...rest }) => (
  <input
    type="tel"
    inputMode="tel"
    value={value}
    onChange={(e) => onChange(formatPhone(e.target.value))}
    className={className}
    placeholder={placeholder}
    {...rest}
  />
);

export default PhoneInput;
