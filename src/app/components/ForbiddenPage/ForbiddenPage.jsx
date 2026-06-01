import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth';
import { getDefaultHomePath } from '../../../shared/config/navigation';
import './ForbiddenPage.scss';

const ForbiddenPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const homePath = getDefaultHomePath(user?.accesses);

  return (
    <div className="page forbidden-page">
      <h1 className="forbidden-page__title">Нет доступа</h1>
      <p className="forbidden-page__text">
        У вашей учётной записи нет прав на этот раздел. Обратитесь к администратору, если доступ нужен.
      </p>
      <div className="forbidden-page__actions">
        {homePath ? (
          <button type="button" className="btn btn--primary" onClick={() => navigate(homePath)}>
            На главную
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn--secondary"
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Выйти
        </button>
      </div>
    </div>
  );
};

export default ForbiddenPage;
