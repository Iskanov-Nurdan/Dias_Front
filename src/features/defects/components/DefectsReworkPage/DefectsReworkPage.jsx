import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DefectsPage from '../DefectsPage/DefectsPage';
import ReworkRequestsPage from '../../../reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage';
import './DefectsReworkPage.scss';

const DefectsReworkPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isReworkTab = location.pathname.startsWith('/defects-rework/rework');

  return (
    <div className="page defects-rework-page">
      <div className="materials-tabs defects-rework-page__tabs" role="tablist" aria-label="Брак и переделка">
        <button
          type="button"
          role="tab"
          aria-selected={!isReworkTab}
          className={`materials-tabs__tab defects-rework-page__tab${!isReworkTab ? ' materials-tabs__tab--active defects-rework-page__tab--active' : ''}`}
          onClick={() => navigate('/defects-rework')}
        >
          Брак
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isReworkTab}
          className={`materials-tabs__tab defects-rework-page__tab${isReworkTab ? ' materials-tabs__tab--active defects-rework-page__tab--active' : ''}`}
          onClick={() => navigate('/defects-rework/rework')}
        >
          Переделка
        </button>
      </div>

      <div className="defects-rework-page__content">
        {isReworkTab ? <ReworkRequestsPage /> : <DefectsPage />}
      </div>
    </div>
  );
};

export default DefectsReworkPage;
