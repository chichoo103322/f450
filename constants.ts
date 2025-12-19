export const APP_CONFIG = {
  // Communication
  MAVLINK_PORT: 14550,
  HEARTBEAT_INTERVAL_MS: 1000,
  
  // Control Logic
  EMA_ALPHA: 0.2, // Smoothing factor
  DEADZONE: 0.05, // 5% Dynamic Deadzone
  
  // RC Limits
  RC_MIN: 1000,
  RC_MID: 1500,
  RC_MAX: 2000,

  // Safety
  EMERGENCY_LOCK_CODE: 21196,
  
  // Simulation
  SIMULATION_UPDATE_RATE_MS: 50, // 20Hz
};

export const COLORS = {
  active: '#22c55e', // green-500
  inactive: '#64748b', // slate-500
  warning: '#f59e0b', // amber-500
  danger: '#ef4444', // red-500
  highlight: '#3b82f6', // blue-500
};