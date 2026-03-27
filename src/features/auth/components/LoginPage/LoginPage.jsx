import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../model';
import { getApiErrorMessage } from '../../../../shared/lib';
import { Button, Field } from '../../../../shared/ui';
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
      setError('Введите имя и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(name, password);
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Неверные данные'));
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
        </div>
      </div>

      <div className="login-page__form-area">
        <div className="login-page__card">
          <h2 className="login-page__title">Вход</h2>

          <form className="login-page__form" onSubmit={handleSubmit} noValidate>
            <Field label="Имя пользователя" htmlFor="login-name">
              <input
                id="login-name"
                type="text"
                className="login-page__input"
                placeholder="Логин"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="username"
              />
            </Field>
            <Field label="Пароль" htmlFor="login-password">
              <input
                id="login-password"
                type="password"
                className="login-page__input"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            {error ? (
              <p className="login-page__error" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="primary" className="login-page__submit" disabled={loading}>
              {loading ? 'Вход…' : 'Войти'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
