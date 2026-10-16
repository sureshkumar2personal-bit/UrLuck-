"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision";

interface CameraHandDetectorProps {
  /** Fired with a stably-detected number (1-5) when the user holds up that many fingers. */
  onDetect: (n: number) => void;
}

const HAND_CONNECTIONS = HandLandmarker.HAND_CONNECTIONS;

export default function CameraHandDetector({
  onDetect,
}: CameraHandDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);
  const lastEmitRef = useRef<number | null>(null);
  const stableRef = useRef({ n: -1, frames: 0 });
  const videoWidthRef = useRef(0);
  const videoHeightRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [detected, setDetected] = useState<number | null>(null);

  const STABLE_FRAMES = 12;
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/float16/1/hand_landmarker.task";
  const WASM_URL =
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

  // [index, middle, ring, pinky]: tip above PIP joint => extended
  const FINGERS: [number, number][] = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ];

  const countFingers = useCallback(
    (landmarks: NormalizedLandmark[], handednessLeft: boolean): number => {
      let count = 0;
      for (const [tip, pip] of FINGERS) {
        if (landmarks[tip].y < landmarks[pip].y) count += 1;
      }
      const tipX = landmarks[4].x;
      const ipX = landmarks[3].x;
      if (handednessLeft) {
        if (tipX < ipX) count += 1;
      } else {
        if (tipX > ipX) count += 1;
      }
      return count; // 0..5
    },
    [],
  );

  const emitIfStable = useCallback(
    (n: number) => {
      const prev = stableRef.current;
      if (n === prev.n) {
        prev.frames += 1;
      } else {
        prev.n = n;
        prev.frames = 1;
      }
      if (
        n >= 1 &&
        n <= 5 &&
        prev.frames >= STABLE_FRAMES &&
        n !== lastEmitRef.current
      ) {
        lastEmitRef.current = n;
        onDetect(n);
        setDetected(n);
      }
    },
    [onDetect],
  );

  const startCamera = useCallback(async () => {
    if (startedRef.current) return;
    setError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
      });
      const video = videoRef.current;
      if (!video) throw new Error("video element missing");
      video.srcObject = stream;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => resolve();
      });

      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      landmarkerRef.current = landmarker;

      videoWidthRef.current = video.videoWidth;
      videoHeightRef.current = video.videoHeight;
      setReady(true);
      startedRef.current = true;
      requestAnimationFrame(tick);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Camera access failed. Allow camera and try again.",
      );
    }
  }, []);

  const tick = useCallback(
    (time: number) => {
      if (!startedRef.current) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;
      const canvas = canvasRef.current;
      if (!video || !landmarker || !canvas) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (video.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          ctx.save();
          ctx.clearRect(0, 0, w, h);
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, w, h);
          ctx.restore();
        }

        const result = landmarker.detectForVideo(video, time);

        if (result.landmarks[0]) {
          const landmarks = result.landmarks[0] as NormalizedLandmark[];
          const handednessLeft =
            result.handednesses?.[0]?.[0]?.categoryName === "Left";
          const n = countFingers(landmarks, handednessLeft);
          emitIfStable(n);
          drawCanvas(canvas, landmarks);
        } else {
          stableRef.current = { n: -1, frames: 0 };
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [countFingers, emitIfStable],
  );

  const drawCanvas = useCallback(
    (canvas: HTMLCanvasElement, landmarks: NormalizedLandmark[]) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);

      ctx.lineWidth = 3;
      ctx.strokeStyle = "#8b5cf6";
      ctx.fillStyle = "#fff";
      for (const conn of HAND_CONNECTIONS) {
        const p1 = landmarks[conn.start];
        const p2 = landmarks[conn.end];
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
      for (const p of landmarks) {
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    [],
  );

  useEffect(() => {
    startCamera();
    return () => {
      startedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      landmarkerRef.current?.close();
    };
  }, [startCamera]);

  useEffect(() => {
    const setSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = videoWidthRef.current || 320;
      canvas.height = videoHeightRef.current || 240;
    };
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      setSize();
    } else {
      const onLoaded = () => setSize();
      video?.addEventListener("loadedmetadata", onLoaded);
      return () => video?.removeEventListener("loadedmetadata", onLoaded);
    }
  }, []);

  const stop = useCallback(() => {
    startedRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setReady(false);
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-200/90">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-lg dark:border-white/10 dark:bg-white/[0.04]"
        style={{ width: 320, height: 240 }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="block w-full h-full"
        />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
            <span className="animate-pulse text-lg">📹 Loading camera…</span>
            <span className="mt-2 text-xs opacity-80">Allow camera access</span>
          </div>
        )}
        {detected !== null && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
            <span className="text-emerald-100">✋</span>
            {detected}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
        {ready ? (
          <>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Show 1–5 fingers
            </span>
            <button
              type="button"
              onClick={stop}
              className="text-xs text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
            >
              Stop
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={startCamera}
            disabled={!navigator.mediaDevices?.getUserMedia}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📷 Open camera
          </button>
        )}
      </div>
    </div>
  );
}
