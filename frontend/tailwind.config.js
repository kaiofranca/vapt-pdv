const cor = (nome) => `rgb(var(--c-${nome}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: cor('bg'),
        surface: {
          DEFAULT: cor('surface'),
          2: cor('surface-2'),
          raised: cor('surface-raised'),
        },
        border: {
          DEFAULT: cor('border'),
          strong: cor('border-strong'),
        },
        text: {
          DEFAULT: cor('text'),
          2: cor('text-2'),
        },
        brand: {
          DEFAULT: cor('brand'),
          soft: cor('brand-soft'),
          text: cor('brand-text'),
          hover: cor('brand-hover'),
          edge: cor('brand-edge'),
        },
        'on-brand': cor('on-brand'),
        nav: cor('nav'),
        success: {
          DEFAULT: cor('success'),
          soft: cor('success-soft'),
          text: cor('success-text'),
        },
        danger: {
          DEFAULT: cor('danger'),
          soft: cor('danger-soft'),
          text: cor('danger-text'),
        },
        tint: {
          beer: cor('tint-beer'),
          snack: cor('tint-snack'),
          drink: cor('tint-drink'),
          dessert: cor('tint-dessert'),
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        input: '14px',
        card: '20px',
        'card-lg': '24px',
        btn: '18px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43, 32, 25, 0.06)',
        card: '0 2px 8px rgba(43, 32, 25, 0.08)',
        modal: '0 16px 32px rgba(43, 32, 25, 0.16)',
      },
    },
  },
  plugins: [],
};
