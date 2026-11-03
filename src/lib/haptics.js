/** Tiny haptic tap where supported (Android). Silently does nothing elsewhere. */
export function buzz(pattern = 12) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch { /* unsupported */ }
}
