import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../../model';
import { getApiErrorMessage } from '../../../../shared/lib';
import { Field, DiasLogo } from '../../../../shared/ui';
import '../../../../design-system/split-screen/tokens.css';
import './LoginPage.scss';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      <div className="login-page__stripe" aria-hidden="true" />
      <div className="login-page__checker" aria-hidden="true" />

      <main className="login-page__main">
        <section className="login-page__hero">
          <p className="login-page__eyebrow">Терминал&nbsp;доступа</p>
          <DiasLogo size="hero-solo" className="login-page__hero-logo" />
          <div className="login-page__ruler" aria-hidden="true" />
          <p className="login-page__lede">Единая панель управления производством, складом и логистикой Dias Line</p>
        </section>

        <section className="login-page__panel">
          <div className="login-page__card">
            <div className="login-page__card-accent" aria-hidden="true" />

            <h2 className="login-page__card-title">Авторизация</h2>

            <form className="login-page__form" onSubmit={handleSubmit} noValidate>
              <Field label="Логин" htmlFor="login-name" className="login-page__field">
                <input
                  id="login-name"
                  type="text"
                  className="login-page__input"
                  placeholder="Введите логин"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="username"
                />
              </Field>
              <Field label="Пароль" htmlFor="login-password" className="login-page__field">
                <div className="login-page__input-group">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-page__input login-page__input--password"
                    placeholder="Введите пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-page__input-toggle"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <FiEyeOff size={17} strokeWidth={2} aria-hidden /> : <FiEye size={17} strokeWidth={2} aria-hidden />}
                  </button>
                </div>
              </Field>

              {error ? (
                <p className="login-page__error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="login-page__submit" disabled={loading}>
                <span>{loading ? 'Проверка…' : 'Войти'}</span>
                {!loading && <FiArrowRight className="login-page__submit-icon" aria-hidden />}
              </button>

              <p className="login-page__hint">Проблемы со входом? Обратитесь к администратору системы.</p>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default LoginPage;
