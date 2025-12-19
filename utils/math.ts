/**
 * Exponential Moving Average (EMA) Filter
 * New = Alpha * Target + (1-Alpha) * Old
 */
export const calculateEMA = (current: number, previous: number, alpha: number): number => {
  return (alpha * current) + ((1 - alpha) * previous);
};

/**
 * Maps a value from one range to another
 */
export const mapRange = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

/**
 * Clamps a value between min and max
 */
export const clamp = (val: number, min: number, max: number): number => {
  return Math.min(Math.max(val, min), max);
};

/**
 * Applies deadzone to a normalized input (-1 to 1 or 0 to 1)
 */
export const applyDeadzone = (value: number, threshold: number): number => {
  if (Math.abs(value) < threshold) return 0;
  // Rescale remaining range
  const sign = Math.sign(value);
  return sign * ((Math.abs(value) - threshold) / (1 - threshold));
};