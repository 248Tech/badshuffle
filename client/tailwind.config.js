/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Core palette — mapped to CSS variables so themes work
        primary:          'var(--color-primary)',
        accent:           'var(--color-accent)',
        danger:           'var(--color-danger)',
        success:          'var(--color-success)',
        warning:          'var(--color-warning)',
        border:           'var(--color-border)',
        bg:               'var(--color-bg)',
        surface:          'var(--color-surface)',
        'text-base':      'var(--color-text)',
        'text-muted':     'var(--color-text-muted)',
        hover:            'var(--color-hover)',
        discount:         'var(--color-discount)',
        // Primary variants
        'primary-subtle': 'var(--color-primary-subtle)',
        'primary-hover':  'var(--color-primary-hover)',
        // Sidebar
        sidebar:          'var(--color-sidebar)',
        'sidebar-hover':  'var(--color-sidebar-hover)',
        // Semantic state palettes
        'danger-subtle':  'var(--color-danger-subtle)',
        'danger-border':  'var(--color-danger-border)',
        'danger-strong':  'var(--color-danger-strong)',
        'success-subtle': 'var(--color-success-subtle)',
        'success-border': 'var(--color-success-border)',
        'success-strong': 'var(--color-success-strong)',
        'warning-subtle': 'var(--color-warning-subtle)',
        'warning-border': 'var(--color-warning-border)',
        'warning-strong': 'var(--color-warning-strong)',
        'info-subtle':    'var(--color-info-subtle)',
        'info-border':    'var(--color-info-border)',
        'info-strong':    'var(--color-info-strong)',
        'info-hover':     'var(--color-info-hover)',
      },
      borderRadius: {
        sm:      'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md:      'var(--radius-md)',
      },
      boxShadow: {
        DEFAULT: 'var(--shadow)',
        md:      'var(--shadow-md)',
      },
      fontFamily: {
        sans: ['var(--font)'],
      },
      minHeight: {
        touch: 'var(--touch-min, 44px)',
      },
      width: {
        sidebar: 'var(--sidebar-width)',
      },
      minWidth: {
        sidebar: 'var(--sidebar-width)',
      },
      transitionProperty: {
        width: 'width, min-width',
      },
    },
  },
  plugins: [],
}
