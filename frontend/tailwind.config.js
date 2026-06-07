/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        bg: {
          base: '#09090B',
          surface: '#0F0F12',
          card: '#141418',
          elevated: '#1A1A20',
          overlay: '#1F1F26',
        },
        border: {
          subtle: '#1E1E26',
          default: '#28283A',
          strong: '#3A3A52',
          focus: '#5B5BFF',
        },
        text: {
          primary: '#EEEDF0',
          secondary: '#8B8A9B',
          muted: '#4A4A5E',
          inverse: '#09090B',
        },
        green: {
          DEFAULT: '#00D992',
          bright: '#00F5A0',
          dim: '#00D91214',
          border: '#00D92230',
        },
        red: {
          DEFAULT: '#FF4D4D',
          dim: '#FF4D4D14',
          border: '#FF4D4D30',
        },
        amber: {
          DEFAULT: '#F59E0B',
          dim: '#F59E0B14',
          border: '#F59E0B30',
        },
        blue: {
          DEFAULT: '#6366F1',
          dim: '#6366F114',
          border: '#6366F130',
        },
        eth: {
          DEFAULT: '#627EEA',
          dim: '#627EEA18',
        },
        score: {
          high: '#00D992',
          mid: '#F59E0B',
          low: '#FF4D4D',
        },
      },
    },
  },
  plugins: [],
};
