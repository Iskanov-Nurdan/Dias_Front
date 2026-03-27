import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FeedbackVisual } from '../../shared/ui';
import './NoAccessPage.scss';

const NoAccessPage = () => {
  const navigate = useNavigate();
  return (
    <div className="no-access-page">
      <div className="no-access-page__card">
        <FeedbackVisual variant="denied" />
        <h1 className="no-access-page__title">Нет доступа</h1>
        <p className="no-access-page__text">У вас нет прав для просмотра этого раздела.</p>
        <button type="button" className="no-access-page__btn" onClick={() => navigate('/')}>
          На главную
        </button>
      </div>
    </div>
  );
};

export default NoAccessPage;
