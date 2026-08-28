import React, { useCallback, useEffect, useState } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import DiasLogo from '../../../shared/ui/DiasLogo/DiasLogo';
import { getStoredTheme, toggleStoredTheme, Theme } from '../../../shared/lib/theme';
import '../tokens.css';
import styles from './AuthSplitScreen.module.css';

/**
 * Split-screen login: dark brand panel (logo + glow) on the left,
 * light form panel on the right. Stacks vertically below 768px.
 * Styling is 100% driven by --ds-* tokens from ../tokens.css.
 */
const AuthSplitScreen = ({ onSubmit }) => {
  const [colorTheme, setColorTheme] = useState(getStoredTheme);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorTheme);
  }, [colorTheme]);

  const handleThemeToggle = useCallback(() => {
    setColorTheme(toggleStoredTheme());
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!login.trim() || !password.trim()) {
        setError('Заполните логин и пароль');
        return;
      }
      setError('');
      setIsSubmitting(true);
      try {
        await onSubmit?.({ login, password });
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, password, onSubmit]
  );

  return (
    <div className={styles.screen}>
      <button
        type="button"
        className={styles.themeToggle}
        onClick={handleThemeToggle}
        aria-label={colorTheme === Theme.DARK ? 'Включить светлую тему' : 'Включить тёмную тему'}
      >
        {colorTheme === Theme.DARK ? <FiSun size={18} strokeWidth={2} aria-hidden /> : <FiMoon size={18} strokeWidth={2} aria-hidden />}
      </button>

      <section className={styles.panelDark} aria-hidden="true">
        <div className={styles.glow} />
        <div className={styles.panelDarkContent}>
          <DiasLogo size="lg" className={styles.logo} />
          <p className={styles.tagline}>Управляйте производством и складом в едином окне</p>
        </div>
      </section>

      <section className={styles.panelLight}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <h1 className={styles.formTitle}>Вход в систему</h1>
          <p className={styles.formSubtitle}>Введите данные учётной записи</p>

          <label className={styles.field}>
            <span className={styles.label}>Логин</span>
            <input
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              type="text"
              autoComplete="username"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Пароль</span>
            <input
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
          </label>

          {error && (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
            <span className={isSubmitting ? styles.submitLabelHidden : ''}>Войти</span>
            {isSubmitting && <span className={styles.spinner} aria-hidden />}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AuthSplitScreen;
