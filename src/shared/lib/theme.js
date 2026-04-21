export const THEME_STORAGE_KEY = 'dias_theme';

export const Theme = {
  DARK: 'dark',
  LIGHT: 'light',
};

export const getStoredTheme = () => {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === Theme.LIGHT ? Theme.LIGHT : Theme.DARK;
  } catch {
    return Theme.DARK;
  }
};

export const applyTheme = (theme) => {
  const t = theme === Theme.LIGHT ? Theme.LIGHT : Theme.DARK;
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t === Theme.LIGHT ? 'light' : 'dark';
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, t);
  } catch {
    /* ignore */
  }
};

export const toggleStoredTheme = () => {
  const next = getStoredTheme() === Theme.DARK ? Theme.LIGHT : Theme.DARK;
  applyTheme(next);
  return next;
};
