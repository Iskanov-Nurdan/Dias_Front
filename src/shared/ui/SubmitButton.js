import React from 'react';
import { Loader2 } from 'lucide-react';
import './SubmitButton.scss';

/**
 * Кнопка submit с спиннером и disabled при загрузке.
 * @param {boolean} loading
 * @param {React.ReactNode} children — текст в обычном состоянии
 * @param {string} [loadingLabel] — текст при loading (по умолчанию «Сохранение…»)
 */
const SubmitButton = ({ loading, children, loadingLabel = 'Сохранение…', className = '', disabled, ...rest }) => (
  <button
    type="submit"
    className={`submit-button ${className || ''}`.trim()}
    disabled={loading || disabled}
    {...rest}
  >
    {loading && <Loader2 className="submit-button__spinner" size={16} strokeWidth={2.25} aria-hidden />}
    <span className="submit-button__text">{loading ? loadingLabel : children}</span>
  </button>
);

export default SubmitButton;
