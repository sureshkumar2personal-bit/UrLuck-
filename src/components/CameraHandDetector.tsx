"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CameraHandDetectorProps {
  /** Fired with a number (1-5) when the user picks it. */
  onDetect: (n: number) => void;
}

export default function CameraHandDetector({
  onDetect,
}: CameraHandDetectorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>(0);
  const startedRef = useRef(false);
  const videoWidthRef = useRef(0);
  const videoHeightRef = useRef(0);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);

  // ---- Check if camera hardware exists ----
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) {
        setCameraAvailable(false);
        return;
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled)
          setCameraAvailable(devices.some((d) => d.kind === "videoinput"));
      } catch {
        if (!cancelled) setCameraAvailable(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

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

      videoWidthRef.current = video.videoWidth;
      videoHeightRef.current = video.videoHeight;
      setReady(true);
      startedRef.current = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(
        msg.includes("PermissionDenied") || msg.includes("NotAllowed")
          ? "Camera permission denied. Allow camera access and try again."
          : msg.includes("NotFound") || !cameraAvailable
            ? "No camera found on this device."
            : "Camera failed to start: " + msg,
      );
    }
  }, [cameraAvailable]);

  const stop = useCallback(() => {
    startedRef.current = false;
    const stream = videoRef.current?.srcObject as MediaStream | null;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    setReady(false);
  }, []);

  useEffect(() => {
    return () => {
      startedRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const stream = videoRef.current?.srcObject as MediaStream | null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const hasCameraSupport =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  if (!hasCameraSupport) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-white/[0.06]">
        <span className="text-lg" aria-hidden="true">📷</span>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Camera not supported on this device/browser.
        </p>
      </div>
    );
  }

  if (cameraAvailable === null && !error && !ready) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-lg dark:border-white/10 dark:bg-white/[0.04]"
          style={{ width: 320, height: 240 }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-slate-600 dark:text-slate-300">
            <span className="animate-pulse text-lg">🔍 Checking camera…</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Detecting camera availability…
        </p>
      </div>
    );
  }

  if (cameraAvailable === false && !error && !ready) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-lg dark:border-white/10 dark:bg-white/[0.04]"
          style={{ width: 320, height: 240 }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 text-slate-600 dark:text-slate-300">
            <span className="text-lg" aria-hidden="true">❌</span>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No camera found on this device.
        </p>
      </div>
    );
  }

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
        {!ready && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white">
            <span className="animate-pulse text-lg">📹 Open camera to start</span>
            <span className="mt-2 text-xs opacity-80">Click Open camera below</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-white/[0.06]">
        {ready ? (
          <>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Pick your number
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
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-white/10"
          >
            📷 Open camera
          </button>
        )}
      </div>

      {/* Instant number picker — works immediately, no model needed */}
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onDetect(n)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-300 dark:hover:bg-violet-500/10 dark:hover:border-violet-400/30 dark:hover:text-violet-200"
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
