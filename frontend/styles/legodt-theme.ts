/**
 * LEGODT 디자인 시스템 - "Let Life Be Your Playground"
 * 라이프스타일 브랜드의 깔끔하고 모던한 스타일을 적용
 */

export const legodtTheme = {
  // 색상 팔레트 - LEGODT 브랜드 컬러
  colors: {
    // Primary Colors - 브랜드 메인 컬러
    primary: {
      50: '#f8fafc',   // 매우 연한 회색
      100: '#f1f5f9',  
      200: '#e2e8f0',  
      300: '#cbd5e1',  
      400: '#94a3b8',  
      500: '#64748b',  // 메인 그레이
      600: '#475569',  
      700: '#334155',  
      800: '#1e293b',  
      900: '#0f172a',  
      DEFAULT: '#64748b',
    },
    
    // Secondary Colors - 포인트 컬러
    secondary: {
      50: '#fefce8',   
      100: '#fef9c3',  
      200: '#fef08a',  
      300: '#fde047',  
      400: '#facc15',  
      500: '#eab308',  // 레고트 옐로우
      600: '#ca8a04',  
      700: '#a16207',  
      800: '#854d0e',  
      900: '#713f12',  
      DEFAULT: '#eab308',
    },
    
    // Accent Colors - 액센트
    accent: {
      50: '#f0fdf4',   
      100: '#dcfce7',  
      200: '#bbf7d0',  
      300: '#86efac',  
      400: '#4ade80',  
      500: '#22c55e',  // 그린 액센트
      600: '#16a34a',  
      700: '#15803d',  
      800: '#166534',  
      900: '#14532d',  
      DEFAULT: '#22c55e',
    },
    
    // Neutral Colors
    neutral: {
      white: '#ffffff',
      light: '#f8fafc',
      gray: '#64748b',
      dark: '#1e293b',
      black: '#0f172a',
    },
    
    // Background & Surface
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
    },
    
    // Text Colors
    text: {
      primary: '#1e293b',
      secondary: '#64748b',
      tertiary: '#94a3b8',
      inverse: '#ffffff',
    },
    
    // Status Colors
    status: {
      success: '#22c55e',
      warning: '#eab308',
      error: '#ef4444',
      info: '#3b82f6',
    }
  },
  
  // 타이포그래피
  typography: {
    fontFamily: {
      primary: '"Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
      secondary: '"Noto Sans KR", sans-serif',
      mono: '"Fira Code", "Monaco", monospace',
    },
    fontSize: {
      xs: '0.75rem',     // 12px
      sm: '0.875rem',    // 14px
      base: '1rem',      // 16px
      lg: '1.125rem',    // 18px
      xl: '1.25rem',     // 20px
      '2xl': '1.5rem',   // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem',  // 36px
      '5xl': '3rem',     // 48px
      '6xl': '3.75rem',  // 60px
    },
    fontWeight: {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
      extrabold: '800',
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  
  // 간격 시스템
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
    '3xl': '4rem',   // 64px
  },
  
  // Border Radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',    // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    full: '9999px',
  },
  
  // Shadow System
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
  
  // Animation & Transition
  animation: {
    duration: {
      fast: '150ms',
      normal: '250ms',
      slow: '350ms',
    },
    easing: {
      ease: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    },
  },
  
  // Component-specific tokens
  components: {
    button: {
      height: {
        sm: '2rem',      // 32px
        md: '2.5rem',    // 40px
        lg: '3rem',      // 48px
      },
      padding: {
        sm: '0.5rem 1rem',
        md: '0.75rem 1.5rem',
        lg: '1rem 2rem',
      },
    },
    card: {
      padding: '1.5rem',
      borderRadius: '0.75rem',
      shadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
    input: {
      height: '2.5rem',
      padding: '0.75rem 1rem',
      borderRadius: '0.5rem',
    },
  },
  
  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const;

// CSS Variables 생성 함수
export const generateCSSVariables = () => {
  return `
    :root {
      /* Primary Colors */
      --legodt-primary-50: ${legodtTheme.colors.primary[50]};
      --legodt-primary-500: ${legodtTheme.colors.primary.DEFAULT};
      --legodt-primary-900: ${legodtTheme.colors.primary[900]};
      
      /* Secondary Colors */
      --legodt-secondary-50: ${legodtTheme.colors.secondary[50]};
      --legodt-secondary-500: ${legodtTheme.colors.secondary.DEFAULT};
      --legodt-secondary-900: ${legodtTheme.colors.secondary[900]};
      
      /* Accent Colors */
      --legodt-accent-500: ${legodtTheme.colors.accent.DEFAULT};
      
      /* Background */
      --legodt-bg-primary: ${legodtTheme.colors.background.primary};
      --legodt-bg-secondary: ${legodtTheme.colors.background.secondary};
      
      /* Text */
      --legodt-text-primary: ${legodtTheme.colors.text.primary};
      --legodt-text-secondary: ${legodtTheme.colors.text.secondary};
      
      /* Spacing */
      --legodt-spacing-sm: ${legodtTheme.spacing.sm};
      --legodt-spacing-md: ${legodtTheme.spacing.md};
      --legodt-spacing-lg: ${legodtTheme.spacing.lg};
      
      /* Border Radius */
      --legodt-radius-md: ${legodtTheme.borderRadius.md};
      --legodt-radius-lg: ${legodtTheme.borderRadius.lg};
      
      /* Shadows */
      --legodt-shadow-sm: ${legodtTheme.shadows.sm};
      --legodt-shadow-md: ${legodtTheme.shadows.md};
      
      /* Typography */
      --legodt-font-primary: ${legodtTheme.typography.fontFamily.primary};
    }
  `;
};

export type LegodtTheme = typeof legodtTheme;