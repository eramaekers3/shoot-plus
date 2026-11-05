// Opens a booking, client or service sheet from anywhere (a row on any page, a stat, another sheet).
// App.jsx shows whichever one is open.
import { useSyncExternalStore } from 'react';

let current = null; // { type: 'booking' | 'client' | 'service' | 'new', id, preset }
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

export const open = (type, id = null, preset = null) => {
  current = { type, id, preset, key: Date.now() };
  emit();
};
export const openBooking = (id) => open('booking', id);
export const openClient = (id) => open('client', id);
export const openService = (id) => open('service', id);
/** The stepped "new booking" sheet. preset can fill in the service, package or client. */
export const newBooking = (preset) => open('new', null, preset);
export const closeSheet = () => {
  current = null;
  emit();
};

export function useOpenSheet() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current
  );
}

/** Switch tabs from inside a page ("See all" links). App.jsx listens for this. */
export const goTab = (id) => window.dispatchEvent(new CustomEvent('shoot:go', { detail: id }));
