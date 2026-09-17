import React from 'react';
import './PhoneInput.scss';

/**
 * «+996» — несъёмный префикс, а не часть значения: человеку сразу видно,
 * что вводить нужно ровно 9 цифр местного номера, и он физически не может
 * стереть или испортить код страны. Тот же приём, что уже стоит в форме
 * записи на сайте (см. TaplinkPage.js, BookingModal) — здесь он же, но
 * оформлен под тёмную тему CRM.
 *
 * Наружу (value/onChange) уходит уже собранный канонический номер
 * «+996XXXXXXXXX» без пробелов — тот же формат, в котором сохраняются
 * новые заявки с сайта (см. shared/lib/phone.js). Существующий «сломанный»
 * номер при открытии формы не переписывается сам по себе — перезапись
 * происходит только когда человек реально трогает поле.
 */

const LOCAL_DIGITS = 9;

/** Любой ввод/готовое значение → местные цифры без кода страны и ведущего нуля. */
const toLocalDigits = (raw) => {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('996')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, LOCAL_DIGITS);
};

const groupLocal = (digits) => digits.replace(/(\d{3})(?=\d)/g, '$1 ');

/** «+996» + местные цифры, без пробелов — формат для отправки на бэкенд. */
export const toCanonicalPhone = (localDigits) => (localDigits ? `+996${localDigits}` : '');

const PhoneInput = ({
  value, onChange, className = '', placeholder = '700 123 456', disabled, ...rest
}) => {
  const localDigits = toLocalDigits(value);
  const display = groupLocal(localDigits);

  const handleChange = (e) => {
    onChange(toCanonicalPhone(toLocalDigits(e.target.value)));
  };

  return (
    <div className={`phone-input${disabled ? ' phone-input--disabled' : ''}${className ? ` ${className}` : ''}`}>
      <span className="phone-input__prefix" aria-hidden>+996</span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        className="phone-input__field"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label="Телефон, 9 цифр после +996"
        {...rest}
      />
    </div>
  );
};

export default PhoneInput;
