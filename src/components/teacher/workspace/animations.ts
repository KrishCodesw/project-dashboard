// Shared animation configuration for workspace components
// Custom easing: strong ease-out for responsive UI feel
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

// Duration presets
export const DURATION = {
  FAST: 0.15,    // 150ms — button press feedback
  NORMAL: 0.2,   // 200ms — dropdowns, small elements
  SLOW: 0.3,     // 300ms — cards, sections
} as const;

// Stagger delay between sibling elements
export const STAGGER = {
  FAST: 0.04,   // 40ms — dense lists
  NORMAL: 0.06, // 60ms — card grids
  SLOW: 0.08,   // 80ms — sparse sections
} as const;

// Variants for staggered entrance animations
export const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: STAGGER.NORMAL },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION.SLOW, ease: EASE_OUT },
  },
};
