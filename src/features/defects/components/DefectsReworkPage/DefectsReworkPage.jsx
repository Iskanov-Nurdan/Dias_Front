import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DefectsPage from '../DefectsPage/DefectsPage';
import ReworkRequestsPage from '../../../reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage';
import './DefectsReworkPage.scss';

const DefectsReworkPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [defectsMountKey, setDefectsMountKey] = useState(0);

  const bumpDefectsList = useCallback(() => {
    setDefectsMountKey((k) => k + 1);
  }, []);

  const isReworkTab = location.pathname.startsWith('/cash/defects/rework')
    || location.pathname.startsWith('/defects-rework/rework');

  return (
    <div className="page defects-rework-page">
      <div className="materials-tabs defects-rework-page__tabs" role="tablist" aria-label="Брак и переделка">
        <button
          type="button"
          role="tab"
          aria-selected={!isReworkTab}
          className={`materials-tabs__tab defects-rework-page__tab${!isReworkTab ? ' materials-tabs__tab--active defects-rework-page__tab--active' : ''}`}
          onClick={() => navigate('/cash/defects')}
        >
          Брак
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isReworkTab}
          className={`materials-tabs__tab defects-rework-page__tab${isReworkTab ? ' materials-tabs__tab--active defects-rework-page__tab--active' : ''}`}
          onClick={() => navigate('/cash/defects/rework')}
        >
          Переделка
        </button>
      </div>

      <div className="defects-rework-page__content">
        {isReworkTab ? (
          <ReworkRequestsPage onAfterMutation={bumpDefectsList} />
        ) : (
          <DefectsPage key={defectsMountKey} />
        )}
      </div>
    </div>
  );
};

export default DefectsReworkPage;
