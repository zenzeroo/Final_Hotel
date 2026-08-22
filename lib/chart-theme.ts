/**
 * Chart.js theme — extracted from globals.css design tokens.
 * Keeps chart colors consistent with the rest of the Zenzero UI.
 */

export const chartColors = {
  primary: '#082717',
  primaryContainer: '#1f3d2b',
  secondary: '#765a26',
  secondaryContainer: '#fed798',
  tertiary: '#512d30',
  outline: '#c2c8c1',
  outlineVariant: '#e3e3df',
  surfaceDim: '#dadad7',
  textMuted: '#727972',
  onSurface: '#1a1c1a',
  background: '#faf9f6',
  success: '#466551',
} as const

export const chartFont = {
  family: '"Inter", system-ui, sans-serif',
} as const
