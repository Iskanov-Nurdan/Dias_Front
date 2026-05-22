import React from 'react';
import diasLineLogo from '../../assets/dias-line-logo.png';
import './DiasLogo.scss';

const DiasLogo = ({ size = 'md', className = '' }) => (
  <img
    src={diasLineLogo}
    alt="DIAS LINE"
    className={`dias-logo dias-logo--${size}${className ? ` ${className}` : ''}`.trim()}
    decoding="async"
    draggable={false}
  />
);

export default DiasLogo;
