import React from 'react';
import { FiSearch } from 'react-icons/fi';
import './SearchInput.scss';

/** Единое поле поиска (иконка + инпут) — тот же размер/стиль, что у Select, везде в приложении. */
const SearchInput = ({ className = '', ...rest }) => (
  <span className={`search-input ${className}`.trim()}>
    <FiSearch aria-hidden size={16} strokeWidth={2} className="search-input__icon" />
    <input type="text" className="search-input__field" {...rest} />
  </span>
);

export default SearchInput;
