import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { CalibrationState, GestureType, RCChannels } from '../types';
import { calculateEMA, clamp } from '../utils/math';
import { APP_CONFIG } from '../constants';

// NPM Imports for build environment
// Fix: Use namespace import to handle CommonJS/ESM interop issues with Vite
import * as mpHands from '@mediapipe/hands';
import * as mpDrawingUtils from '@mediapipe/drawing_utils';
import type { Results } from '@mediapipe/hands';

// Handle potential ESM/CJS interop issues with Vite
// Safely extract Hands class and drawing functions checking both default and named exports
const Hands = (mpHands as any).Hands || (mpHands as any).default?.Hands;
const drawConnectors = mpDrawingUtils.drawConnectors || (mpDrawingUtils as any).default?.drawConnectors;
const drawLandmarks = mpDrawingUtils.drawLandmarks || (mpDrawingUtils as any).default?.drawLandmarks;

// Define HAND_CONNECTIONS locally with explicit type
const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

interface VideoHUDProps {
  isActive: boolean;
  calibration: CalibrationState;
  onCalibrationStep: (val: number) => void;
  onGestureUpdate: (gesture: GestureType, intensity: number, rc: RCChannels) => void;
}

const VideoHUD: React.FC<VideoHUDProps> = ({ 
  isActive, 
  calibration, 
  onCalibrationStep,
  onGestureUpdate 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [streamActive, setStreamActive] = useState(false);
  const [isVisionReady, setIsVisionReady] = useState(false);
  
  // Logic State
  const logicState = useRef({
    smoothedIntensity: 0,
    lastFrameTime: 0,
  });

  // Safety Refs
  const lastHandTime = useRef<number>(Date.now());
  const lastValidRC = useRef<RCChannels>({
    ch1: APP_CONFIG.RC_MID,
    ch2: APP_CONFIG.RC_MID,
    ch3: APP_CONFIG.RC_MIN,
    ch4: APP_CONFIG.RC_MID
  });

  // MediaPipe Instance
  const handsRef = useRef<any>(null); // Use any for the instance as Types might mismatch with the manual import

  // Process Results Callback
  const onResults = useCallback((results: Results) => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // 1. Draw Video Frame (Mirrored)
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, width, height);
    
    // Draw Landmarks
    if (results.multiHandLandmarks) {
      for (const landmarks of results.multiHandLandmarks) {
        if (drawConnectors) {
          drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {color: '#00FF00', lineWidth: 2});
        }
        if (drawLandmarks) {
          drawLandmarks(ctx, landmarks, {color: '#FF0000', lineWidth: 1, radius: 2});
        }
      }
    }
    ctx.restore();

    // 2. Gesture Logic
    let gesture = GestureType.NONE;
    let rawScale = 0;
    let hasHand = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      hasHand = true;
      lastHandTime.current = Date.now();
      const lm = results.multiHandLandmarks[0]; // Get first hand

      // --- Python Logic: Calculate Scale (Wrist [0] to Middle MCP [9]) ---
      // Distance calculation
      rawScale = Math.sqrt(
        Math.pow(lm[0].x - lm[9].x, 2) + Math.pow(lm[0].y - lm[9].y, 2)
      );

      // --- Python Logic: Finger State Detection ---
      // Check tips [8, 12, 16, 20] vs pips [6, 10, 14, 18]
      // Note: In MediaPipe Y is 0 at top, 1 at bottom. Tip < Pip means extended up.
      const fingerIndices = [8, 12, 16, 20];
      const fingers = fingerIndices.map(tipIdx => {
        return lm[tipIdx].y < lm[tipIdx - 2].y ? 1 : 0;
      });
      
      const sumFingers = fingers.reduce((a: number, b: number) => a + b, 0);

      // --- Python Logic: Gesture Classification ---
      if (sumFingers === 4) {
        gesture = GestureType.FORWARD; // "前进"
      } else if (sumFingers === 0) {
        gesture = GestureType.BACKWARD; // "后退"
      } else if (fingers[0] === 1 && sumFingers === 1) {
        gesture = GestureType.UP; // "上升" (Index finger only)
      } else {
        gesture = GestureType.HOVER; // "悬停"
      }
    }

    // 3. Calibration & Control Logic
    let currentIntensity = 0;
    let rcCmd: RCChannels = { ...lastValidRC.current }; // Start with hold

    // If we have a hand, we calculate new RC; otherwise we handle failsafe below
    if (hasHand && calibration.stage === 3) {
      // Normalize
      const normalized = clamp(
        (rawScale - calibration.minScale) / (calibration.maxScale - calibration.minScale),
        0, 1
      );

      // EMA Smoothing
      logicState.current.smoothedIntensity = calculateEMA(
        normalized,
        logicState.current.smoothedIntensity,
        APP_CONFIG.EMA_ALPHA
      );

      // Dynamic Deadzone
      if (logicState.current.smoothedIntensity > APP_CONFIG.DEADZONE) {
        currentIntensity = logicState.current.smoothedIntensity;
      } else {
        currentIntensity = 0;
      }

      // --- Python Logic: RC Mapping ---
      // Reset base cmd
      rcCmd = { 
        ch1: APP_CONFIG.RC_MID, 
        ch2: APP_CONFIG.RC_MID, 
        ch3: APP_CONFIG.RC_MIN, 
        ch4: APP_CONFIG.RC_MID 
      };

      const amp = Math.floor(currentIntensity * 450); // 450 PWM amplitude
      
      if (gesture === GestureType.FORWARD) {
        // Forward -> Pitch Down (Low PWM usually?) 
        // Python: rc_cmd[1] = MID - amp
        rcCmd.ch2 = APP_CONFIG.RC_MID - amp; 
      } else if (gesture === GestureType.BACKWARD) {
        // Backward -> Pitch Up
        // Python: rc_cmd[1] = MID + amp
        rcCmd.ch2 = APP_CONFIG.RC_MID + amp;
      } else if (gesture === GestureType.UP) {
        // Up -> Throttle Up
        // Python: rc_cmd[2] = MIN + int(current_intensity * 800)
        rcCmd.ch3 = APP_CONFIG.RC_MIN + Math.floor(currentIntensity * 800);
      }

      lastValidRC.current = rcCmd;
    }

    // Failsafe Logic (No hand)
    const timeSinceHand = Date.now() - lastHandTime.current;
    if (!hasHand) {
      if (timeSinceHand < 500) {
        // Hold last valid
        rcCmd = lastValidRC.current;
      } else {
        // Failsafe reset
        rcCmd = { 
          ch1: APP_CONFIG.RC_MID, 
          ch2: APP_CONFIG.RC_MID, 
          ch3: APP_CONFIG.RC_MIN, 
          ch4: APP_CONFIG.RC_MID 
        };
      }
    }

    // 4. Update Parent
    if (isActive) {
      onGestureUpdate(gesture, currentIntensity, rcCmd);
    }
    
    // 5. Calibration Hook
    if (hasHand && (calibration.stage === 1 || calibration.stage === 2)) {
      onCalibrationStep(rawScale);
    }

    // Draw HUD Elements (Context is already restored)
    drawHUD(ctx, width, height, gesture, currentIntensity, calibration.stage === 3, hasHand, timeSinceHand, rawScale, calibration);

  }, [calibration, isActive, onCalibrationStep, onGestureUpdate]);

  const onResultsRef = useRef(onResults);
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  // Start Camera
  useEffect(() => {
    let animationFrameId: number;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640 }, 
            height: { ideal: 480 },
            frameRate: { ideal: 30 } 
          } 
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setStreamActive(true);
            videoRef.current?.play();
            setIsVisionReady(true);
            processVideo();
          };
        }
      } catch (err) {
        console.error("Camera access failed", err);
      }
    };

    // Ensure Hands class exists
    if (!Hands) {
      console.error("MediaPipe Hands module failed to load properly. Check imports.");
      return;
    }

    const hands = new Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });

    hands.onResults((results: Results) => {
      if (onResultsRef.current) onResultsRef.current(results);
    });
    
    handsRef.current = hands;

    const processVideo = async () => {
      if (videoRef.current && handsRef.current) {
        // Only process if video has data
        if (videoRef.current.readyState >= 2) {
          await handsRef.current.send({ image: videoRef.current });
        }
      }
      animationFrameId = requestAnimationFrame(processVideo);
    };

    startCamera();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (handsRef.current) handsRef.current.close();
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(t => t.stop());
      }
    };
  }, []);

  const drawHUD = (
    ctx: CanvasRenderingContext2D, w: number, h: number, 
    gesture: GestureType, intensity: number, ready: boolean, 
    hasHand: boolean, timeSinceHand: number, rawScale: number,
    cal: CalibrationState
  ) => {
    
    // Center Crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w/2 - 20, h/2); ctx.lineTo(w/2 + 20, h/2);
    ctx.moveTo(w/2, h/2 - 20); ctx.lineTo(w/2, h/2 + 20);
    ctx.stroke();

    // Calibration Overlay
    if (cal.stage === 1 || cal.stage === 2) {
       ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
       ctx.fillRect(10, 10, 260, 80);
       ctx.fillStyle = '#00ff00';
       ctx.font = '16px "Microsoft YaHei", sans-serif';
       ctx.fillText(`原始比例 (Raw): ${rawScale.toFixed(4)}`, 20, 35);
       ctx.fillStyle = 'white';
       ctx.fillText(`当前阶段: ${cal.stage}`, 20, 60);
       ctx.fillStyle = '#ffff00';
       ctx.font = '12px "Microsoft YaHei", sans-serif';
       ctx.fillText("按 'S' 键采样当前值", 20, 80);
    }

    // Status / Failsafe Overlay
    if (ready) {
      if (hasHand) {
        // Intensity Bar
        const barH = h * 0.5;
        const barW = 15;
        const barX = w - 30;
        const barY = (h - barH) / 2;
        
        // Bar Background
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        
        // Bar Fill
        const fillH = barH * intensity;
        // Color gradient based on intensity
        ctx.fillStyle = intensity > 0.8 ? '#ef4444' : (intensity > 0 ? '#3b82f6' : '#64748b');
        ctx.fillRect(barX, barY + barH - fillH, barW, fillH);
        
        // Border
        ctx.strokeStyle = 'white';
        ctx.strokeRect(barX, barY, barW, barH);
        
        // Gesture Label
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(`${gesture}`, 30, h - 30);
        ctx.font = '16px "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText(`强度: ${(intensity * 100).toFixed(0)}%`, 30, h - 10);
      } else {
        // No Hand Logic
        if (timeSinceHand < 500) {
           ctx.fillStyle = 'orange';
           ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
           ctx.fillText(`信号丢失 - 保持姿态 (${(500 - timeSinceHand).toFixed(0)}ms)`, w/2 - 140, h/2 - 50);
        } else {
           ctx.fillStyle = 'red';
           ctx.font = 'bold 24px "Microsoft YaHei", sans-serif';
           ctx.fillText(`!! 故障保护触发 !!`, w/2 - 100, h/2 - 50);
           ctx.font = '16px "Microsoft YaHei", sans-serif';
           ctx.fillText(`RC通道已回中`, w/2 - 60, h/2 - 20);
        }
      }
    } else {
      if (cal.stage === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(w/2 - 150, h/2 - 40, 300, 80);
        ctx.fillStyle = '#fbbf24'; // Amber
        ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("系统待机 - 等待校准", w/2, h/2);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '14px "Microsoft YaHei", sans-serif';
        ctx.fillText("请按 'C' 键开始手势行程校准", w/2, h/2 + 25);
        ctx.textAlign = 'left';
      }
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden border border-slate-700 shadow-2xl">
      <video 
        ref={videoRef} 
        className="hidden" // Hide video element, draw on canvas
        playsInline 
        muted 
      />
      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480} 
        className="absolute top-0 left-0 w-full h-full object-contain"
      />
      {!isVisionReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 font-sans bg-slate-900 z-10">
          <Camera size={48} className="mb-4 animate-bounce text-blue-500" />
          <p className="text-lg">正在加载 MediaPipe 视觉模型...</p>
          <p className="text-xs text-slate-600 mt-2">首次加载可能需要几秒钟</p>
        </div>
      )}
    </div>
  );
};

export default VideoHUD;