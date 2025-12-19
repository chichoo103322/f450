export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
}

export enum GestureType {
  NONE = '未检测',
  HOVER = '悬停',
  FORWARD = '前进',
  BACKWARD = '后退',
  UP = '上升',
}

export interface TelemetryData {
  roll: number;
  pitch: number;
  yaw: number;
  altitude: number;
  batteryVoltage: number;
  satelliteCount: number;
  armState: boolean;
}

export interface CalibrationState {
  stage: 0 | 1 | 2 | 3; // 0:Idle, 1:Far, 2:Near, 3:Ready
  minScale: number;
  maxScale: number;
}

export interface LogEntry {
  id: number;
  timestamp: string;
  type: 'INFO' | 'WARN' | 'ERROR' | 'DATA';
  message: string;
  details?: string;
}

export interface RCChannels {
  ch1: number; // Roll
  ch2: number; // Pitch
  ch3: number; // Throttle
  ch4: number; // Yaw
}