/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}',
    './src/context/**/*.{js,jsx,ts,tsx}',
    './src/lib/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      height: {
        header: '560px',
        rate: '400px',
        'mobile-arrow': '60px',
      },
      width: {
        'mobile-arrow': '16px',
      },
      screens: {
        xs: '475px',
        'above-1000': '1000px',
        mobile: { max: '639px' },
      },
      colors: {
        customPurple: '#538F14',
        main: '#080A1A',
        subMain: '#F20000',
        dry: '#0B0F29',
        star: '#FFB000',
        text: '#C0C0C0',
        border: '#4b5563',
        dryGray: '#E0D5D5',
      },
    },
  },
  plugins: [
    // If installed:
    // require('@tailwindcss/line-clamp'),
  ],
};
