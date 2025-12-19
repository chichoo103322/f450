import { TelemetryData } from '../types';

/**
 * Simulates receiving MAVLink packets (Heartbeat, SYS_STATUS, ATTITUDE, VFR_HUD)
 * In a real electron/backend app, this would use 'dgram' or a serial port.
 */
export const generateMockTelemetry = (currentData: TelemetryData, isArmed: boolean): TelemetryData => {
  // Simulate slight sensor noise
  const noise = (amount: number) => (Math.random() - 0.5) * amount;

  // Simulate battery drain
  const newVoltage = Math.max(10.5, currentData.batteryVoltage - 0.0005);

  // Simulate attitude drift if armed, or static if disarmed
  const drift = isArmed ? 2.0 : 0.1;

  return {
    ...currentData,
    roll: currentData.roll * 0.95 + noise(drift), // Return to level tendency
    pitch: currentData.pitch * 0.95 + noise(drift),
    yaw: (currentData.yaw + noise(0.5)) % 360,
    altitude: isArmed ? Math.max(0, currentData.altitude + noise(0.1)) : 0,
    batteryVoltage: newVoltage,
    satelliteCount: 12 + Math.floor(Math.random() * 3),
    armState: isArmed
  };
};

export const INITIAL_TELEMETRY: TelemetryData = {
  roll: 0,
  pitch: 0,
  yaw: 0,
  altitude: 0,
  batteryVoltage: 12.6, // 3S LiPo Full
  satelliteCount: 0,
  armState: false
};