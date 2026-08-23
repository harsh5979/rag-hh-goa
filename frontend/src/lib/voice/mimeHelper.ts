import type { DeviceCategory } from "./types";

/**
 * Ordered list of preferred audio MIME type candidates for streaming recorders.
 */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
  "audio/ogg;codecs=opus",
  "audio/wav",
] as const;

/**
 * Returns the best supported audio MIME type for the current browser/OS.
 * Falls back to empty string if no candidate is supported or if running on SSR.
 */
export function getOptimalAudioMimeType(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return "";
  }

  for (const candidate of MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore browsers where isTypeSupported throws
    }
  }

  return "";
}

/**
 * Detects whether the current device is Android, iOS, or Desktop.
 */
export function detectDeviceCategory(): DeviceCategory {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "desktop";
  }

  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";

  if (/android/i.test(ua)) {
    return "android";
  }

  // iOS detection including iPad on iOS 13+
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }

  if (/Windows|Macintosh|Linux/i.test(ua)) {
    return "desktop";
  }

  return "other";
}

/**
 * Verifies that audio recording hardware and APIs are available in the browser.
 */
export function isAudioRecordingSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}
