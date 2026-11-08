import { defineTheme } from '@astryxdesign/core/theme';
import '@astryxdesign/theme-chocolate/theme.css';
import { chocolateTheme } from '@astryxdesign/theme-chocolate/built';

/**
 * Sekeping's identity: a warm paper canvas, moss-green accent, terracotta
 * for money going out and honey for transfers. Built on the Chocolate theme
 * (Fraunces + Albert Sans) so the typography stays editorial and calm.
 */
export const sekepingTheme = defineTheme({
  extends: chocolateTheme,
  name: 'sekeping',
  tokens: {
    // Brand
    '--color-accent': ['#2F6B57', '#8FD8C0'],
    '--color-accent-muted': ['#2F6B571F', '#8FD8C026'],
    '--color-on-accent': ['#FFFDF9', '#10231C'],
    '--color-text-accent': ['#275747', '#A9E6D2'],
    '--color-icon-accent': ['#2F6B57', '#8FD8C0'],

    // Canvas
    '--color-background-body': ['#F6F1E7', '#141312'],
    '--color-background-surface': ['#FFFCF6', '#1C1B19'],
    '--color-background-card': ['#FFFCF6', '#1C1B19'],
    '--color-background-popover': ['#FFFCF6', '#242320'],
    '--color-background-muted': ['#2F6B570F', '#8FD8C014'],

    // Ink
    '--color-text-primary': ['#231E18', '#F1EBE1'],
    '--color-text-secondary': ['#6E6357', '#B3A897'],
    '--color-text-disabled': ['#A79C8E', '#6C6357'],
    '--color-border': ['#2F6B571A', '#F1EBE11A'],
    '--color-border-emphasized': ['#DCD1BF', '#48433B'],

    // Money semantics
    '--color-success': ['#2E7D4F', '#4CC47F'],
    '--color-error': ['#B8452F', '#F08974'],
    '--color-warning': ['#A9761C', '#E2B15A'],

    // Shape
    '--radius-element': '10px',
    '--radius-container': '16px',
    '--radius-page': '28px',

    // Type
    '--font-family-heading': 'Fraunces, "Iowan Old Style", Palatino, Georgia, serif',
    '--font-family-body': '"Albert Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
});
