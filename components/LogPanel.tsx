import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Database, HardDrive } from 'lucide-react';

interface LogPanelProps {
  logs: LogEntry[];
  dbStatus: boolean; // True if writing
}

const LogPanel: React.FC<LogPanelProps> = ({ logs, dbStatus }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-48 bg-slate-950 border-t border-slate-700 flex flex-col font-sans">
      <div className="h-8 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
          <Database size={12} />
          系统日志与数据库流
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">异步写入:</span>
          <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded ${
            dbStatus ? 'bg-green-900 text-green-400' : 'bg-slate-800 text-slate-500'
          }`}>
            <HardDrive size={10} />
            {dbStatus ? "写入中" : "空闲"}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
        {logs.map((log) => (
          <div key={log.id} className="flex gap-2 hover:bg-slate-900/50 p-0.5 rounded">
            <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>
            <span className={`shrink-0 font-bold w-12 ${
              log.type === 'ERROR' ? 'text-red-500' :
              log.type === 'WARN' ? 'text-amber-500' :
              log.type === 'DATA' ? 'text-blue-400' : 'text-green-400'
            }`}>
              {log.type}
            </span>
            <span className="text-slate-300">{log.message}</span>
            {log.details && <span className="text-slate-600 hidden md:inline">| {log.details}</span>}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default LogPanel;