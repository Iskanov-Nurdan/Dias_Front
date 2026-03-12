import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../app/providers/AuthProvider';
import { login } from './api';
import { getApiErrorMessage } from '../../shared/lib/apiError';
import './LoginPage.scss';

const LoginPage = () => {
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [rateLimitBlocked, setRateLimitBlocked] = useState(false);
  const { login: doLogin, getFirstAvailableRoute } = useAuth();
  const navigate = useNavigate();
  const successTimeoutRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await login({ login: loginValue, password });
      const payload = res?.data ?? res;
      const token = payload?.token ?? payload?.access ?? payload?.access_token;
      const refresh = payload?.refresh ?? null;
      const user = payload?.user ?? payload;
      if (!token) {
        setError('Некорректный ответ сервера');
        return;
      }
      doLogin(user, token, refresh);
      setSuccess(true);
      successTimeoutRef.current = setTimeout(() => {
        navigate(getFirstAvailableRoute(), { replace: true });
      }, 1800);
    } catch (err) {
      const code = err?.response?.data?.error?.code;
      if (code === 'too_many_requests') {
        const msg = err?.response?.data?.error?.message ?? '';
        const match = msg.match(/(\d+)\s*seconds?/i) || msg.match(/(\d+)/);
        const sec = Math.min(parseInt(match?.[1] || '60', 10) || 60, 120);
        setError(`Слишком много попыток. Попробуйте через ${sec} секунд.`);
        setRateLimitBlocked(true);
        setTimeout(() => setRateLimitBlocked(false), sec * 1000);
      } else {
        setError(getApiErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => {
    if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
  }, []);

  const bgStyle = {
    backgroundImage: `url(${process.env.PUBLIC_URL || ''}/login-bg.png)`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
  if (success) {
    return (
      <div className="login-page" style={bgStyle}>
        <div className="login-page__card login-page__card--success">
          <div className="login-page__success-icon" aria-hidden>
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="32" cy="32" r="30" stroke="currentColor" strokeWidth="2" fill="none" />
              <path d="M20 32l8 8 16-16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="login-page__success-title">Вход выполнен успешно</p>
          <p className="login-page__success-text">Перенаправление в систему…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" style={bgStyle}>
      <div className="login-page__card">
        <img src={`${process.env.PUBLIC_URL || ''}/rahman.png`} alt="Рахман Ата" className="login-page__logo" />
        <form className="login-page__form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-page__error">{error}</div>
          )}
          <label className="login-page__label">
            Логин
            <input
              type="text"
              className="login-page__input"
              value={loginValue}
              onChange={(e) => setLoginValue(e.target.value)}
              placeholder="Введите логин"
              required
              autoComplete="username"
            />
          </label>
          <label className="login-page__label">
            Пароль
            <div className="login-page__password-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="login-page__input login-page__input--password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="login-page__password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <button type="submit" className="login-page__submit" disabled={loading || rateLimitBlocked}>
            {loading ? (
              <span className="login-page__submit-text">
                <span className="login-page__spinner" aria-hidden />
                Вход…
              </span>
            ) : (
              'Войти'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
