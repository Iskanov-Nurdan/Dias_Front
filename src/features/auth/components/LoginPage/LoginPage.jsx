import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../model';
import { getApiErrorMessage } from '../../../../shared/lib';
import './LoginPage.scss';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name || !password) {
      setError('Укажите имя и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(name, password);
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Ошибка входа. Проверьте данные.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__panel">
        <div className="login-page__brand">
          <div className="login-page__brand-logo">D</div>
          <h1 className="login-page__brand-name">DIAS</h1>
          <p className="login-page__brand-desc">Система управления производством</p>
        </div>
      </div>

      <div className="login-page__form-area">
        <div className="login-page__card">
          <h2 className="login-page__title">Вход в систему</h2>
          <p className="login-page__subtitle">Введите ваши учётные данные</p>

          <form className="login-page__form" onSubmit={handleSubmit} noValidate>
            <div className="login-page__field">
              <label htmlFor="login-name">Имя пользователя</label>
              <input
                id="login-name"
                type="text"
                className="login-page__input"
                placeholder="Введите имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="login-page__field">
              <label htmlFor="login-password">Пароль</label>
              <input
                id="login-password"
                type="password"
                className="login-page__input"
                placeholder="Введите пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {error && <p className="login-page__error" role="alert">{error}</p>}
            <button type="submit" className="login-page__btn" disabled={loading}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
