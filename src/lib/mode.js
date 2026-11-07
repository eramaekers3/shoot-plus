// Which list the Bookings tab shows (bookings or business expenses). Remembered, so the tab reopens
// where you left it, and read by the + button so it adds the right thing.
import { useSyncExternalStore } from 'react';

const KEY = 'shootplus.moneyMode';
let mode = read();
const listeners = new Set();

function read() {
  try {
    return localStorage.getItem(KEY) === 'expenses' ? 'expenses' : 'bookings';
  } catch {
    return 'bookings';
  }
}

export function setMode(next) {
  mode = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function useMode() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => mode
  );
}
