import React from 'react';
import { Battery, Signal, Navigation, Activity, Crosshair } from 'lucide-react';
import { ConnectionState, TelemetryData, CalibrationState } from '../types';

interface TelemetryPanelProps {
  connectionState: ConnectionState;
  telemetry: TelemetryData;
  calibration: CalibrationState;
}

const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ connectionState, telemetry, calibration }) => {
  const isConnected = connectionState === ConnectionState.CONNECTED;
  const opacity = isConnected ? 'opacity-100' : 'opacity-40 grayscale';

  return (
    <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col p-4 gap-6 transition-all duration-500 font-sans">
      
      {/* Header */}
      <div className="pb-4 border-b border-slate-700">
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Activity className={isConnected ? "text-green-500 animate-pulse" : "text-slate-500"} />
          F450 遥测数据
        </h2>
        <div className="mt-2 flex items-center gap-2 text-sm font-mono">
          <span className={`w-3 h-3 rounded-full ${
            connectionState === ConnectionState.CONNECTED ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 
            connectionState === ConnectionState.CONNECTING ? 'bg-amber-500 animate-ping' : 'bg-red-500'
          }`} />
          <span>{connectionState === ConnectionState.CONNECTED ? "MAVLINK: 正常 (57600)" : "未连接"}</span>
        </div>
      </div>

      {/* Calibration Panel (Visible during Stage 1 & 2) */}
      {(calibration.stage === 1 || calibration.stage === 2) && (
        <div className="p-4 bg-yellow-900/20 rounded-lg border border-yellow-500/50 animate-pulse">
          <div className="flex items-center gap-2 mb-3 text-yellow-500">
            <Crosshair size={18} />
            <span className="font-bold text-sm tracking-wider">校准模式</span>
          </div>
          <div className="space-y-3 font-mono text-sm">
             <div className="flex justify-between items-center border-b border-slate-700 pb-2">
                <span className="text-slate-400">最小值 (远):</span>
                <span className={calibration.stage > 1 ? "text-green-400 font-bold" : "text-yellow-200"}>
                  {calibration.stage > 1 ? calibration.minScale.toFixed(4) : "等待 [S]..."}
                </span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-slate-400">最大值 (近):</span>
                <span className="text-slate-600">
                   等待 [S]...
                </span>
             </div>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700 text-[10px] text-yellow-500/80 uppercase font-semibold">
             {calibration.stage === 1 ? "第一步: 伸直手臂 -> 按 'S'" : "第二步: 靠近身体 -> 按 'S'"}
          </div>
        </div>
      )}

      {/* Battery */}
      <div className={`p-4 bg-slate-900 rounded-lg border border-slate-700 ${opacity}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-slate-400 text-sm">电池电压 (BATTERY)</span>
          <Battery size={20} className={telemetry.batteryVoltage < 10.8 ? "text-red-500" : "text-green-500"} />
        </div>
        <div className="text-3xl font-mono text-white tracking-widest">
          {telemetry.batteryVoltage.toFixed(2)} <span className="text-base text-slate-500">V</span>
        </div>
      </div>

      {/* Attitude */}
      <div className={`p-4 bg-slate-900 rounded-lg border border-slate-700 ${opacity}`}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-400 text-sm">飞行姿态 (ATTITUDE)</span>
          <Navigation size={20} className="text-blue-500" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-slate-500 mb-1">横滚 (Roll)</div>
            <div className="text-xl font-mono">{telemetry.roll.toFixed(1)}°</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">俯仰 (Pitch)</div>
            <div className="text-xl font-mono">{telemetry.pitch.toFixed(1)}°</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">偏航 (Yaw)</div>
            <div className="text-xl font-mono">{telemetry.yaw.toFixed(0)}°</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">高度 (Alt)</div>
            <div className="text-xl font-mono text-amber-500">{telemetry.altitude.toFixed(1)}m</div>
          </div>
        </div>
      </div>

      {/* RC Channels Output Visualization */}
      <div className={`flex-1 p-4 bg-slate-900 rounded-lg border border-slate-700 flex flex-col ${opacity}`}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-slate-400 text-sm">PWM 输出</span>
          <Signal size={20} className="text-purple-500" />
        </div>
        
        {/* Simple PWM Bars */}
        {[
          { label: '横滚 (Rol)', ch: 'Roll' }, 
          { label: '俯仰 (Pit)', ch: 'Pitch' }, 
          { label: '油门 (Thr)', ch: 'Thr' }, 
          { label: '偏航 (Yaw)', ch: 'Yaw' }
        ].map((item, idx) => (
          <div key={item.ch} className="mb-3">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{item.label}</span>
              <span className="font-mono">1500</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-slate-600 w-1/2 mx-auto rounded-full transition-all" style={{width: '50%'}}></div> 
              {/* Note: In a real app we'd map the actual RC values here */}
            </div>
          </div>
        ))}
        
        {telemetry.armState ? (
          <div className="mt-auto p-2 bg-red-900/50 border border-red-500 text-red-500 text-center font-bold animate-pulse rounded">
            已解锁 (ARMED)
          </div>
        ) : (
          <div className="mt-auto p-2 bg-green-900/50 border border-green-500 text-green-500 text-center font-bold rounded">
            已加锁 (DISARMED)
          </div>
        )}
      </div>

    </div>
  );
};

export default TelemetryPanel;