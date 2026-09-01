/** Matches the mobile layout breakpoint in main.css */
export const MOBILE_MEDIA_QUERY = '(max-width: 900px)';

export function isMobileViewport(matchMediaFn = (q) => window.matchMedia(q)) {
  try {
    return Boolean(matchMediaFn(MOBILE_MEDIA_QUERY)?.matches);
  } catch {
    return false;
  }
}

/**
 * Read the control that the player can actually see.
 * Hidden desktop <select>s still keep a value (usually the first option),
 * so a naive `desktop.value || mobile.value` always returns the desktop one.
 */
export function readActiveControlValue(
  desktopId,
  mobileId,
  doc = document,
  matchMediaFn
) {
  const preferMobile = isMobileViewport(matchMediaFn);
  const primaryId = preferMobile ? mobileId : desktopId;
  const fallbackId = preferMobile ? desktopId : mobileId;
  const primary = doc.getElementById(primaryId)?.value;
  if (primary != null && primary !== '') return primary;
  return doc.getElementById(fallbackId)?.value;
}

export function bindPairedSelects(idA, idB, doc = document) {
  const a = doc.getElementById(idA);
  const b = doc.getElementById(idB);
  if (!a || !b) return;
  const sync = (from, to) => () => {
    if (to.value !== from.value) to.value = from.value;
  };
  a.addEventListener('change', sync(a, b));
  b.addEventListener('change', sync(b, a));
}
