/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class', // Strictly light mode by default
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Cormorant Garamond"', '"Playfair Display"', 'Georgia', 'serif'],
        display: ['"Cormorant Garamond"', 'serif'],
      },
      colors: {
        // Backgrounds: Soft, warm, clinical but inviting off-whites
        sand: {
          50: '#FAF9F8',
          100: '#F4F2F0',
          200: '#E8E5E1',
          300: '#DBD6CF',
          400: '#C2B8AC',
        },
        // Brand/Accents: Calming therapeutic Sage Greens
        sage: {
          50: '#F4F7F5',
          100: '#E4EBE6',
          200: '#CAD7CE',
          300: '#A3B8AA',
          400: '#7F9A87',
          500: '#6B8874',
          600: '#5F7A68', // Primary buttons & focal elements
          700: '#4A6152', // Hover & pressed states
          800: '#394C3F',
          900: '#27342C',
        },
        // Brand/Accents: Muted calming Blues (for secondary badges & highlights)
        mutedBlue: {
          50: '#F5F8FA',
          100: '#E6EFF5',
          200: '#CDDFEC',
          300: '#ABC7DD',
          400: '#8BA4B5',
          500: '#6E8B9F',
          600: '#557285',
        },
        // Typography: Soft slate neutrals avoiding harsh pure black (#000000)
        slate: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B', // Muted text & captions
          600: '#475569', // Body text
          700: '#334155', // Subheadings & labels
          800: '#1E293B', // Main Headings
          900: '#0F172A',
        },
        // Terracotta / Warm accent for badges & subtle notice highlights
        terracotta: {
          50: '#FDF7F4',
          100: '#FAECE5',
          200: '#F3D5C5',
          500: '#C97A5E',
          600: '#B06145',
        }
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(15, 23, 42, 0.03), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
        'card': '0 4px 20px -2px rgba(15, 23, 42, 0.05)',
        'card-hover': '0 12px 32px -4px rgba(15, 23, 42, 0.08)',
        'modal': '0 20px 48px -8px rgba(15, 23, 42, 0.12)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.8)',
      },
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'reveal': 'cubic-bezier(0.25, 1, 0.5, 1)',
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
