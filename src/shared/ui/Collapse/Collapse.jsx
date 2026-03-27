import React, { useState } from 'react';
import './Collapse.scss';

const Collapse = ({ title, children, defaultOpen = false, className = '' }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`ds-collapse ${className}`.trim()}>
      <button
        type="button"
        className="ds-collapse__trigger"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ds-collapse__chevron" aria-hidden>{open ? '▾' : '▸'}</span>
        <span>{title}</span>
      </button>
      {open && <div className="ds-collapse__panel">{children}</div>}
    </div>
  );
};

export default Collapse;
