import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiGrid, FiBookOpen } from 'react-icons/fi';
import PlasticProfilesPage from '../PlasticProfilesPage/PlasticProfilesPage';
import RecipesPage from '../RecipesPage/RecipesPage';
import './ReferenceBooksPage.scss';

const ReferenceBooksPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isRecipesTab = location.pathname.startsWith('/directories/recipes');

  return (
    <div className="page reference-books-page">
      <div className="materials-tabs reference-books-page__tabs" role="tablist" aria-label="Справочники">
        <button
          type="button"
          role="tab"
          aria-selected={!isRecipesTab}
          className={`materials-tabs__tab reference-books-page__tab${!isRecipesTab ? ' materials-tabs__tab--active reference-books-page__tab--active' : ''}`}
          onClick={() => navigate('/directories')}
        >
          <FiGrid aria-hidden size={16} strokeWidth={2} />
          Профили
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isRecipesTab}
          className={`materials-tabs__tab reference-books-page__tab${isRecipesTab ? ' materials-tabs__tab--active reference-books-page__tab--active' : ''}`}
          onClick={() => navigate('/directories/recipes')}
        >
          <FiBookOpen aria-hidden size={16} strokeWidth={2} />
          Рецепты
        </button>
      </div>

      <div className="reference-books-page__content">
        {isRecipesTab ? <RecipesPage /> : <PlasticProfilesPage />}
      </div>
    </div>
  );
};

export default ReferenceBooksPage;
