import React, { useState, useEffect, useCallback, useRef } from 'react';
import VideoHUD from './components/VideoHUD';
import TelemetryPanel from './components/TelemetryPanel';
import LogPanel from './components/LogPanel';
import { APP_CONFIG } from './constants';
import { 
  ConnectionState, 
  TelemetryData, 
  CalibrationState, 
  LogEntry, 
  GestureType,
  RCChannels
} from './types';
import { generateMockTelemetry, INITIAL_TELEMETRY } from './services/mockMavlink';

const App: React.FC = () => {
  // --- System State ---
  const [connection, setConnection] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [telemetry, setTelemetry] = useState<TelemetryData>(INITIAL_TELEMETRY);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dbWriting, setDbWriting] = useState(false);
  
  // --- Control State ---
  const [calibration, setCalibration] = useState<CalibrationState>({ stage: 0, minScale: 0.1, maxScale: 0.3 });
  const lastSampleRef = useRef<number>(0);

  // --- Helpers ---
  const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ms = now.getMilliseconds().toString().padStart(3, '0').slice(0, 2);

    setLogs(prev => [...prev.slice(-49), { // Keep last 50
      id: now.getTime(),
      timestamp: `${timeStr}.${ms}`,
      type,
      message,
      details
    }]);
  }, []);

  // --- MAVLink Simulation Thread ---
  useEffect(() => {
    if (connection !== ConnectionState.CONNECTED) return;
    
    const interval = setInterval(() => {
      setTelemetry(prev => generateMockTelemetry(prev, prev.armState));
    }, APP_CONFIG.SIMULATION_UPDATE_RATE_MS);

    return () => clearInterval(interval);
  }, [connection]);

  // --- Connection Handler ---
  const toggleConnection = () => {
    if (connection === ConnectionState.DISCONNECTED) {
      setConnection(ConnectionState.CONNECTING);
      addLog('INFO', '正在初始化 UDP 连接至 0.0.0.0:14550...');
      setTimeout(() => {
        setConnection(ConnectionState.CONNECTED);
        addLog('INFO', '检测到 MAVLink 心跳包. System ID: 1, Comp ID: 1');
      }, 1500);
    } else {
      setConnection(ConnectionState.DISCONNECTED);
      setTelemetry(INITIAL_TELEMETRY);
      addLog('WARN', '用户断开连接。');
    }
  };

  // --- Connection Watchdog / Safety ---
  useEffect(() => {
    if (connection === ConnectionState.DISCONNECTED && telemetry.armState) {
       // If we were armed and link died, simulated failsafe logic
       // In a real app, this happens on the drone, but here we log the event.
       setTelemetry(prev => ({ ...prev, armState: false }));
       addLog('ERROR', '故障保护: 链路丢失。强制加锁/返航逻辑已触发。');
    }
  }, [connection, telemetry.armState, addLog]);


  // --- Arm/Disarm ---
  const toggleArm = () => {
    if (connection !== ConnectionState.CONNECTED) return;
    const newState = !telemetry.armState;
    setTelemetry(prev => ({ ...prev, armState: newState }));
    addLog(newState ? 'WARN' : 'INFO', `指令: ${newState ? '解锁 (ARM)' : '加锁 (DISARM)'} 执行。`);
  };

  // --- Keyboard Inputs ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Emergency Stop (Space)
      if (e.code === 'Space') {
        e.preventDefault();
        if (telemetry.armState) {
          setTelemetry(prev => ({ ...prev, armState: false }));
          addLog('ERROR', '紧急停机触发 (代码 21196)');
        }
      }
      // Calibration (C)
      if (e.code === 'KeyC') {
        setCalibration(prev => ({ ...prev, stage: 1 }));
        addLog('INFO', '校准开始。步骤 1: 保持远端，按 S');
      }
      // Sample (S)
      if (e.code === 'KeyS') {
        if (calibration.stage === 1) {
          // In real app, we'd grab from a ref. Here we assume the last sample passed up is valid
          setCalibration(prev => {
             const val = lastSampleRef.current;
             addLog('INFO', `采样远端: ${val.toFixed(3)}. 步骤 2: 保持近端，按 S`);
             return { ...prev, minScale: val, stage: 2 };
          });
        } else if (calibration.stage === 2) {
          setCalibration(prev => {
            const val = lastSampleRef.current;
            if (val <= prev.minScale) {
              addLog('ERROR', `校准无效。近端 (${val.toFixed(3)}) 必须大于 远端 (${prev.minScale.toFixed(3)})`);
              return prev;
            }
            addLog('INFO', `采样近端: ${val.toFixed(3)}. 视觉控制就绪。`);
            return { ...prev, maxScale: val, stage: 3 };
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [telemetry.armState, calibration.stage, addLog]);

  // --- Data Loop / Gesture Callback ---
  const handleGestureUpdate = useCallback((gesture: GestureType, intensity: number, rc: RCChannels) => {
    // This runs at 60fps from the Canvas loop
    
    // Safety check: If connection lost, ensure we aren't "writing" commands visually
    if (connection !== ConnectionState.CONNECTED) return;

    // Simulate DB Write indicator if data is active
    if (intensity > 0) {
      setDbWriting(true);
      // Debounce the false state
      if ((window as any).dbTimeout) clearTimeout((window as any).dbTimeout);
      (window as any).dbTimeout = setTimeout(() => setDbWriting(false), 200);
    }

    // In a real app, send RC Override here via MAVLink service
  }, [connection]);

  const handleCalibrationStep = useCallback((val: number) => {
    lastSampleRef.current = val;
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-200 overflow-hidden font-sans">
      
      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* Left: Vision Center */}
        <div className="flex-1 p-4 flex flex-col relative">
          <VideoHUD 
            isActive={true} 
            calibration={calibration}
            onCalibrationStep={handleCalibrationStep}
            onGestureUpdate={handleGestureUpdate}
          />
          
          {/* Controls Overlay */}
          <div className="absolute top-8 left-8 flex gap-4">
            <button 
              onClick={toggleConnection}
              className={`px-6 py-2 rounded font-bold shadow-lg transition-colors border ${
                connection === ConnectionState.CONNECTED 
                  ? 'bg-slate-800 border-green-500 text-green-500 hover:bg-slate-700' 
                  : 'bg-slate-800 border-slate-600 hover:border-orange-500 hover:text-orange-500'
              }`}
            >
              {connection === ConnectionState.CONNECTED ? '断开连接' : '连接 MINI HOMER'}
            </button>
            <button 
              onClick={toggleArm}
              disabled={connection !== ConnectionState.CONNECTED}
              className={`px-6 py-2 rounded font-bold shadow-lg transition-colors border ${
                !telemetry.armState
                  ? 'bg-slate-800 border-red-500 text-red-500 hover:bg-red-900/50' 
                  : 'bg-green-600 border-green-400 text-white hover:bg-green-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {telemetry.armState ? '已解锁 (点击加锁)' : '解锁 (ARM)'}
            </button>
          </div>
        </div>

        {/* Right: Status Panel */}
        <TelemetryPanel 
          connectionState={connection} 
          telemetry={telemetry} 
          calibration={calibration} 
        />
      </div>

      {/* Bottom: Logs */}
      <LogPanel logs={logs} dbStatus={dbWriting} />

    </div>
  );
};

export default App;