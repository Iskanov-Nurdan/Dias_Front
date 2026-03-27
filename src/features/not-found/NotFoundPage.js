import React from 'react';
import { Link } from 'react-router-dom';
import { FeedbackVisual } from '../../shared/ui';
import './NotFoundPage.scss';

const NotFoundPage = () => (
  <div className="not-found-page">
    <div className="not-found-page__card">
      <div className="not-found-page__visual">
        <FeedbackVisual variant="notfound" />
      </div>
      <span className="not-found-page__code" aria-hidden>404</span>
      <h1 className="not-found-page__title">Страница не найдена</h1>
      <p className="not-found-page__text">Запрашиваемая страница не существует или была перемещена.</p>
      <Link to="/" className="not-found-page__link">
        На главную
      </Link>
    </div>
  </div>
);

export default NotFoundPage;
