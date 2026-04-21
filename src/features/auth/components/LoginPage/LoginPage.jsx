import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useAuth } from '../../model';
import { getApiErrorMessage, getStoredTheme, toggleStoredTheme, Theme } from '../../../../shared/lib';
import { Button, Field } from '../../../../shared/ui';
import './LoginPage.scss';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [colorTheme, setColorTheme] = useState(getStoredTheme);

  const handleTheme = useCallback(() => {
    setColorTheme(toggleStoredTheme());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName || !password) {
      setError('Введите имя и пароль');
      return;
    }
    setLoading(true);
    try {
      await login(trimmedName, password);
      navigate('/');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Неверные данные'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <button
        type="button"
        className="login-page__theme"
        onClick={handleTheme}
        aria-label={colorTheme === Theme.DARK ? 'Светлая тема' : 'Тёмная тема'}
      >
        {colorTheme === Theme.DARK ? <FiSun size={20} strokeWidth={2} aria-hidden /> : <FiMoon size={20} strokeWidth={2} aria-hidden />}
      </button>
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
