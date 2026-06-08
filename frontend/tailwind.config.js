/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
        sans: ['Inter', 'Geist Variable', 'sans-serif'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      colors: {
        // shadcn semantic tokens (used by premium component libraries)
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          1: 'var(--chart-1)',
          2: 'var(--chart-2)',
          3: 'var(--chart-3)',
          4: 'var(--chart-4)',
          5: 'var(--chart-5)',
        },
        // Sentinel design system (existing app)
        bg: {
          base: '#09090B',
          surface: '#0F0F12',
          card: '#141418',
          elevated: '#1A1A20',
          overlay: '#1F1F26',
        },
        border: {
          DEFAULT: 'var(--border)',
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
