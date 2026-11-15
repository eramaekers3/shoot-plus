// Push notifications. On iPhone these only work once shoot+ is added to the Home Screen.
// Each phone that turns them on is saved in Supabase (push_subscriptions, app 'shoot'); the server
// (api/push-tick.js) sends shoot, gallery and tax reminders to it.
import { useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

export const APP = 'shoot';
const ON_KEY = 'shootplus.push';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isInstalled = () =>
  typeof window !== 'undefined' && (window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Quick check (no waiting) for whether this phone has notifications on. */
export const pushOn = () => {
  try {
    return localStorage.getItem(ON_KEY) === '1' && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  } catch {
    return false;
  }
};
const setOn = (v) => {
  try {
    if (v) localStorage.setItem(ON_KEY, '1');
    else localStorage.removeItem(ON_KEY);
  } catch {
    /* storage unavailable */
  }
};

const toKey = (b64) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
};

async function registration() {
  if (!navigator.serviceWorker.controller) await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

async function save(sub) {
  const j = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    app: APP,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    user_agent: navigator.userAgent.slice(0, 200),
    updated_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(/push_subscriptions|app/.test(error.message)
      ? 'The database isn’t set up for shoot+ notifications yet. Run supabase/push.sql in Supabase.'
      : error.message);
  }
}

async function signedInSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

/** Asks permission, subscribes this phone and saves it. Must be called from a tap. */
export async function enablePush() {
  if (!(await signedInSession())) throw new Error('Sign in first so notifications can reach this phone.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Turn them on in iPhone Settings → Notifications → shoot+.');
  const res = await fetch('/api/push');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Couldn’t reach the notification server.');
  const reg = await registration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(body.publicKey) });
  await save(sub);
  setOn(true);
}

export async function disablePush() {
  setOn(false);
  const reg = await registration();
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const session = await signedInSession();
  const res = await fetch('/api/push', { method: 'POST', headers: { Authorization: `Bearer ${session && session.access_token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'The test didn’t send.');
}

/** 'unsupported' | 'install' | 'blocked' | 'off' | 'on' (null while checking) */
export function usePushState() {
  const [state, setState] = useState(null);
  const refresh = async () => {
    if (!pushSupported()) return setState(isIOS() && !isInstalled() ? 'install' : 'unsupported');
    if (Notification.permission === 'denied') return setState('blocked');
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      const on = !!sub && Notification.permission === 'granted';
      setOn(on);
      setState(on ? 'on' : 'off');
    } catch {
      setState('off');
    }
  };
  useEffect(() => {
    refresh();
  }, []);
  return [state, refresh];
}

/** Keeps this phone's time zone current on the server (e.g. after travel). Mount once. */
export function usePushKeepAlive(signedIn) {
  useEffect(() => {
    if (!signedIn || !pushSupported() || Notification.permission !== 'granted') return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg && reg.pushManager.getSubscription())
      .then((sub) => {
        setOn(!!sub);
        return sub && save(sub);
      })
      .catch(() => {});
  }, [signedIn]);
}
