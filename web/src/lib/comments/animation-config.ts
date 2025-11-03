/**
 * Animation Configuration
 * 
 * Controls the timing of the three-phase animation sequence:
 * 1. Exit: Items that won't appear in the next state fade out
 * 2. Layout: Remaining items smoothly transition to their new positions
 * 3. Enter: New items fade in at their final positions
 * 
 * Adjust these values to fine-tune the animation feel for your use case.
 */
export const ANIMATION_TIMING = {
  EXIT_DURATION: 350,       // Exit animation duration (ms)
  LAYOUT_DELAY: 350,        // Delay before layout animation starts (ms)
  ENTER_DELAY: 500,         // Delay before enter animation starts (ms)
  ENTER_DURATION: 500,      // Enter animation duration (ms)
};

