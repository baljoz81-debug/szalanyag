/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'app-bg':         '#1a1a1a',
        'panel':          '#2a2a2a',
        'panel-hover':    '#333333',
        'accent':         '#f97316',
        'accent-hover':   '#fb923c',
        'text-primary':   '#dddddd',
        'text-secondary': '#888888',
        'border-subtle':  '#3a3a3a',
        'danger':         '#ef4444',
        'input-bg':       '#1f1f1f',
        'input-border':   '#444444',
        'input-focus':    '#f97316',
        'status-green':   '#22c55e',
        'status-yellow':  '#eab308',
        'status-red':     '#ef4444',
      },
      fontFamily: {
        heading: ['"JetBrains Mono"', 'monospace'],
        body:    ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'panel': '8px',
      },
      fontSize: {
        'xs':   ['0.75rem',  { lineHeight: '1rem' }],
        'sm':   ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem',     { lineHeight: '1.5rem' }],
        'lg':   ['1.125rem', { lineHeight: '1.75rem' }],
        'xl':   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':  ['1.5rem',   { lineHeight: '2rem' }],
      },
    },
  },
  plugins: [],
};
