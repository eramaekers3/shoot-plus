// Undo history: earlier versions of your records, kept on the server for 90 days
// (supabase/history.sql), plus deleted records and a backup file from this device.
import { supabase } from '../supabase.js';
import { put, allRecords, SETTINGS_ID } from '../store.js';
import { todayISO } from './dates.js';

const SETUP = 'History isn’t turned on yet. Run supabase/history.sql in the Supabase SQL Editor.';

async function rows(query) {
  if (!supabase) throw new Error('Sign in to see history.');
  const { data, error } = await query;
  if (error) throw new Error(/record_history|does not exist|schema cache/i.test(error.message) ? SETUP : error.message);
  return data || [];
}
const COLS = 'hid, record_id, kind, data, deleted, updated_at, replaced_at';

/** Earlier versions of your settings (tax rate, colors…), newest first. */
export const settingsVersions = () =>
  rows(supabase.from('record_history').select(COLS).eq('record_id', SETTINGS_ID).order('replaced_at', { ascending: false }).limit(30));

/** The latest changes to everything else, newest first. */
export const recentChanges = () =>
  rows(supabase.from('record_history').select(COLS).neq('kind', 'settings').order('replaced_at', { ascending: false }).limit(80));

/** Puts a version back. It syncs to your other devices like any other edit. */
export const restoreVersion = (v) => put(v.kind, { ...v.data, id: v.record_id || v.id });

const KIND_NAMES = { booking: 'Booking', client: 'Client', service: 'Service', taxpay: 'Tax payment' };
export const kindName = (k) => KIND_NAMES[k] || k.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());
export function labelOf(d = {}) {
  if (d.name) return d.name;
  if (d.date && d.price != null) return `${d.title || 'Booking'} · $${d.price} · ${d.date}`;
  if (d.date && d.amount != null) return `$${d.amount} · ${d.date}`;
  return d.title || d.date || 'Untitled';
}

/** "25% tax · Sky accent" — what was in a settings version. */
export function settingsSummary(d = {}) {
  const parts = [];
  if (d.businessName) parts.push(d.businessName);
  if (d.taxRate != null) parts.push(`${d.taxRate}% tax`);
  if (d.mileRate != null) parts.push(`$${d.mileRate}/mile`);
  return parts.join(' · ');
}

/** Saves a backup file with everything on this device (sharing it on iPhone, downloading elsewhere). */
export async function exportBackup() {
  const body = JSON.stringify({ app: 'shoot+', exportedAt: new Date().toISOString(), records: allRecords().filter((r) => r.kind !== 'secret') }, null, 1);
  const name = `shoot-plus-backup-${todayISO()}.json`;
  const file = new File([body], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'shoot+ backup' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
