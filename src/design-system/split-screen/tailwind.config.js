/**
 * Dias Line — split-screen Tailwind theme.
 * Consumes CSS variables from ./tokens.css (import tokens.css once, e.g. in index.js/App).
 * Standalone — not wired into the project's build. Merge into a root tailwind.config.js
 * (content globs, plugins) when Tailwind is actually installed in this CRA project.
 */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    screens: {
      // mobile-first; named after the brief's three reference widths
      sm: '375px',
      md: '768px',
      lg: '1440px',
    },
    container: {
      center: true,
      padding: {
        DEFAULT: 'var(--ds-container-px-mobile)',
        md: 'var(--ds-container-px-tablet)',
        lg: 'var(--ds-container-px-desktop)',
      },
      screens: {
        lg: 'var(--ds-container-max-width)',
      },
    },
    extend: {
      colors: {
        red: {
          50: 'var(--ds-red-50)', 100: 'var(--ds-red-100)', 200: 'var(--ds-red-200)',
          300: 'var(--ds-red-300)', 400: 'var(--ds-red-400)', 500: 'var(--ds-red-500)',
          600: 'var(--ds-red-600)', 700: 'var(--ds-red-700)', 800: 'var(--ds-red-800)',
          900: 'var(--ds-red-900)', 950: 'var(--ds-red-950)',
        },
        neutral: {
          0: 'var(--ds-neutral-0)', 50: 'var(--ds-neutral-50)', 100: 'var(--ds-neutral-100)',
          200: 'var(--ds-neutral-200)', 300: 'var(--ds-neutral-300)', 400: 'var(--ds-neutral-400)',
          500: 'var(--ds-neutral-500)', 600: 'var(--ds-neutral-600)', 700: 'var(--ds-neutral-700)',
          800: 'var(--ds-neutral-800)', 900: 'var(--ds-neutral-900)', 950: 'var(--ds-neutral-950)',
          1000: 'var(--ds-neutral-1000)',
        },
        accent: {
          DEFAULT: 'var(--ds-accent)',
          hover: 'var(--ds-accent-hover)',
          active: 'var(--ds-accent-active)',
          'muted-light': 'var(--ds-accent-muted-on-light)',
          'muted-dark': 'var(--ds-accent-muted-on-dark)',
          'on-fill': 'var(--ds-accent-text-on-fill)',
          readable: 'var(--ds-accent-text-readable)',
        },
        success: 'var(--ds-success)',
        warning: 'var(--ds-warning)',
        danger: 'var(--ds-danger)',
        info: 'var(--ds-info)',

        'panel-dark': 'var(--ds-bg-dark-panel)',
        'panel-dark-elevated': 'var(--ds-bg-dark-panel-elevated)',
        'panel-light': 'var(--ds-bg-light-panel)',
        'panel-light-subtle': 'var(--ds-bg-light-panel-subtle)',

        'text-on-dark': 'var(--ds-text-on-dark)',
        'text-on-dark-secondary': 'var(--ds-text-on-dark-secondary)',
        'text-on-dark-muted': 'var(--ds-text-on-dark-muted)',
        'text-on-light': 'var(--ds-text-on-light)',
        'text-on-light-secondary': 'var(--ds-text-on-light-secondary)',
        'text-on-light-muted': 'var(--ds-text-on-light-muted)',

        'border-on-dark': 'var(--ds-border-on-dark)',
        'border-on-dark-subtle': 'var(--ds-border-on-dark-subtle)',
        'border-on-light': 'var(--ds-border-on-light)',
        'border-on-light-subtle': 'var(--ds-border-on-light-subtle)',
      },
      fontFamily: {
        heading: ['Manrope', 'Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        h1: ['var(--ds-h1-size)', { lineHeight: 'var(--ds-h1-line-height)', letterSpacing: 'var(--ds-h1-letter-spacing)', fontWeight: 'var(--ds-h1-weight)' }],
        h2: ['var(--ds-h2-size)', { lineHeight: 'var(--ds-h2-line-height)', letterSpacing: 'var(--ds-h2-letter-spacing)', fontWeight: 'var(--ds-h2-weight)' }],
        h3: ['var(--ds-h3-size)', { lineHeight: 'var(--ds-h3-line-height)', letterSpacing: 'var(--ds-h3-letter-spacing)', fontWeight: 'var(--ds-h3-weight)' }],
        h4: ['var(--ds-h4-size)', { lineHeight: 'var(--ds-h4-line-height)', fontWeight: 'var(--ds-h4-weight)' }],
        h5: ['var(--ds-h5-size)', { lineHeight: 'var(--ds-h5-line-height)', fontWeight: 'var(--ds-h5-weight)' }],
        h6: ['var(--ds-h6-size)', { lineHeight: 'var(--ds-h6-line-height)', fontWeight: 'var(--ds-h6-weight)' }],
        'body-lg': ['var(--ds-body-lg-size)', { lineHeight: 'var(--ds-body-lg-line-height)' }],
        body: ['var(--ds-body-size)', { lineHeight: 'var(--ds-body-line-height)' }],
        'body-sm': ['var(--ds-body-sm-size)', { lineHeight: 'var(--ds-body-sm-line-height)' }],
        caption: ['var(--ds-caption-size)', { lineHeight: 'var(--ds-caption-line-height)' }],
        label: ['var(--ds-label-size)', { lineHeight: 'var(--ds-label-line-height)', fontWeight: 'var(--ds-label-weight)' }],
      },
      spacing: {
        1: 'var(--ds-space-1)', 2: 'var(--ds-space-2)', 3: 'var(--ds-space-3)',
        4: 'var(--ds-space-4)', 5: 'var(--ds-space-5)', 6: 'var(--ds-space-6)',
        8: 'var(--ds-space-8)', 10: 'var(--ds-space-10)', 12: 'var(--ds-space-12)',
        16: 'var(--ds-space-16)', 20: 'var(--ds-space-20)', 24: 'var(--ds-space-24)',
        32: 'var(--ds-space-32)', 40: 'var(--ds-space-40)',
      },
      borderRadius: {
        sm: 'var(--ds-radius-sm)', DEFAULT: 'var(--ds-radius-md)', md: 'var(--ds-radius-md)',
        lg: 'var(--ds-radius-lg)', xl: 'var(--ds-radius-xl)', '2xl': 'var(--ds-radius-2xl)',
        full: 'var(--ds-radius-full)',
      },
      boxShadow: {
        sm: 'var(--ds-shadow-sm)', md: 'var(--ds-shadow-md)', lg: 'var(--ds-shadow-lg)',
        xl: 'var(--ds-shadow-xl)', accent: 'var(--ds-shadow-accent)',
        'focus-ring': 'var(--ds-shadow-focus-ring)',
      },
      transitionDuration: {
        instant: 'var(--ds-duration-instant)', fast: 'var(--ds-duration-fast)',
        base: 'var(--ds-duration-base)', slow: 'var(--ds-duration-slow)',
        slower: 'var(--ds-duration-slower)',
      },
      transitionTimingFunction: {
        standard: 'var(--ds-ease-standard)', decelerate: 'var(--ds-ease-decelerate)',
        accelerate: 'var(--ds-ease-accelerate)', spring: 'var(--ds-ease-spring)',
      },
      maxWidth: {
        content: 'var(--ds-content-max-width)',
        form: 'var(--ds-form-max-width)',
      },
      ringColor: {
        DEFAULT: 'var(--ds-focus-ring)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        'modal-in': {
          from: { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        spin: { to: { transform: 'rotate(360deg)' } },
      },
      animation: {
        'fade-in': 'fade-in var(--ds-duration-base) var(--ds-ease-decelerate)',
        'slide-up': 'slide-up var(--ds-duration-slow) var(--ds-ease-decelerate)',
        'modal-in': 'modal-in var(--ds-duration-base) var(--ds-ease-spring)',
        spin: 'spin 0.7s linear infinite',
      },
    },
  },
  plugins: [],
};
