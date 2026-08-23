import React from 'react';
import './EntityAvatar.scss';

const initialsOf = (name) => {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

/** Круглый тонированный аватар сущности — инициалы имени, цвет по хэшу строки. */
const EntityAvatar = ({ name, size = 32 }) => (
  <span
    className="entity-avatar"
    style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
  >
    {initialsOf(name)}
  </span>
);

export default EntityAvatar;
