import React, { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DefectsPage from '../DefectsPage/DefectsPage';
import ReworkRequestsPage from '../../../reworkRequests/components/ReworkRequestsPage/ReworkRequestsPage';
import './DefectsReworkPage.scss';

const DefectsReworkPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [defectsMountKey, setDefectsMountKey] = useState(0);
  const [reworkMountKey, setReworkMountKey] = useState(0);

  const bumpDefectsList = useCallback(() => {
    setDefectsMountKey((k) => k + 1);
  }, []);

  const bumpReworkList = useCallback(() => {
    setReworkMountKey((k) => k + 1);
  }, []);

  const handleSentToReworkSuccess = useCallback(() => {
    bumpReworkList();
    navigate('/defects-rework/rework');
    bumpDefectsList();
  }, [navigate, bumpReworkList, bumpDefectsList]);

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
        {isReworkTab ? (
          <ReworkRequestsPage key={reworkMountKey} onAfterMutation={bumpDefectsList} />
        ) : (
          <DefectsPage key={defectsMountKey} onSentToReworkSuccess={handleSentToReworkSuccess} />
        )}
      </div>
    </div>
  );
};

export default DefectsReworkPage;
