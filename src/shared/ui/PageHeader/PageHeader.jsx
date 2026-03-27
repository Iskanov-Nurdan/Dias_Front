import React from 'react';

const PageHeader = ({ title, description, actions }) => (
  <header className="ds-page-header">
    <div>
      {title && <h2 className="ds-page-header__title">{title}</h2>}
      {description && <p className="ds-page-header__desc">{description}</p>}
    </div>
    {actions ? <div className="ds-page-header__actions">{actions}</div> : null}
  </header>
);

export default PageHeader;
