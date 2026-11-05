import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSettings, useSyncStatus, clearSample } from './store.js';
import { Icon, Toaster, LogoMark } from './components/ui.jsx';
import { DEFAULT_LOGO } from './lib/logo.js';
import { useTheme, useLogoIcon } from './lib/theme.js';
import { useSwipe } from './lib/swipe.js';
import { useOpenSheet, closeSheet, newBooking } from './lib/open.js';
import HomeView from './views/HomeView.jsx';
import BookingsView from './views/BookingsView.jsx';
import StatsView from './views/StatsView.jsx';
import ClientsView from './views/ClientsView.jsx';
import PricingView from './views/PricingView.jsx';
import NewBooking from './components/NewBooking.jsx';
import BookingSheet from './components/BookingSheet.jsx';
import ClientSheet from './components/ClientSheet.jsx';
import ServiceSheet from './components/ServiceSheet.jsx';

// Settings opens now and then, so it loads separately (fetched in the background after start-up).
const loadSettings = () => import('./components/SettingsSheet.jsx');
const SettingsSheet = lazy(loadSettings);

const TABS = [
  { id: 'home', label: 'Home', View: HomeView },
  { id: 'bookings', label: 'Bookings', View: BookingsView },
  { id: 'stats', label: 'Stats', View: StatsView },
  { id: 'clients', label: 'Clients', View: ClientsView },
  { id: 'pricing', label: 'Pricing', View: PricingView },
];

const tabFromHash = () => {
  const h = window.location.hash.slice(1);
  return TABS.some((t) => t.id === h) ? h : 'home';
};

export default function App() {
  const [tab, setTab] = useState(tabFromHash);
  const tabRef = useRef(tab);
  const [enter, setEnter] = useState(0); // which side the new tab slides in from
  const pager = useRef(null);
  const [settings, setSettings] = useState(false);
  const s = useSettings();
  const sync = useSyncStatus();
  const sheet = useOpenSheet();
  useTheme();
  useLogoIcon();

  useEffect(() => {
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    idle(() => loadSettings().catch(() => {}));
  }, []);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#new') {
        history.replaceState(null, '', `#${tabRef.current}`);
        return newBooking();
      }
      const next = tabFromHash();
      const idx = (id) => TABS.findIndex((t) => t.id === id);
      setEnter(Math.sign(idx(next) - idx(tabRef.current)));
      tabRef.current = next;
      setTab(next);
      window.scrollTo(0, 0);
    };
    // A Home Screen shortcut can open straight into a new booking (…/#new).
    if (window.location.hash === '#new') onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // For a moment after a page appears, things already checked or picked don't replay their animations.
  const [settling, setSettling] = useState(true);
  useEffect(() => {
    setSettling(true);
    const t = setTimeout(() => setSettling(false), 700);
    return () => clearTimeout(t);
  }, [tab]);

  const go = (id) => {
    if (id === tab) return window.scrollTo({ top: 0, behavior: 'smooth' });
    const idx = (x) => TABS.findIndex((t) => t.id === x);
    setEnter(Math.sign(idx(id) - idx(tabRef.current)));
    tabRef.current = id;
    setTab(id);
    window.scrollTo(0, 0);
    history.pushState(null, '', `#${id}`);
  };
  useEffect(() => {
    const onGo = (e) => go(e.detail);
    window.addEventListener('shoot:go', onGo);
    return () => window.removeEventListener('shoot:go', onGo);
  });

  // Swipe anywhere on a page to move between tabs.
  const tabIdx = TABS.findIndex((t) => t.id === tab);
  useSwipe(pager, {
    can: (dir) => !!TABS[tabIdx + dir],
    onSwipe: (dir) => TABS[tabIdx + dir] && go(TABS[tabIdx + dir].id),
  });

  const { View } = TABS.find((t) => t.id === tab);
  const syncLabel = {
    local: 'This device only',
    'signed-out': 'Not signed in',
    syncing: 'Syncing',
    synced: 'Synced',
    offline: 'Offline',
    error: 'Sync problem',
  }[sync.state];

  return (
    <div className={`app${settling ? ' settling' : ''}`}>
      <header className="topbar">
        <div className="brand" aria-label="shoot+">
          <span aria-hidden="true">shoot</span>
          <LogoMark color={s.logoColor || DEFAULT_LOGO} />
        </div>
        <div className="top-right">
          <button className="sync-btn" onClick={() => setSettings(true)} aria-label={`Settings. ${syncLabel}`}>
            <span className={`sync-dot s-${sync.state}`} aria-hidden="true" />
            <span className="sync-text">{syncLabel}</span>
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {s.sample && (
        <div className="banner">
          <span>You’re looking at sample data.</span>
          <button className="mini" onClick={clearSample}>Clear it</button>
        </div>
      )}

      <div className="pager app-pager" ref={pager}>
        <main className={`view${enter ? (enter > 0 ? ' enter-next' : ' enter-prev') : ''}`} key={tab}>
          <View />
        </main>
      </div>

      <button className="fab" onClick={() => newBooking()} aria-label="Add a booking">
        <Icon name="plus" size={28} />
      </button>

      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            <Icon name={t.id} size={22} />
            {t.label}
          </button>
        ))}
      </nav>

      {sheet && sheet.type === 'new' && <NewBooking key={sheet.key} preset={sheet.preset} onClose={closeSheet} />}
      {sheet && sheet.type === 'booking' && <BookingSheet key={sheet.key} id={sheet.id} onClose={closeSheet} />}
      {sheet && sheet.type === 'client' && <ClientSheet key={sheet.key} id={sheet.id} onClose={closeSheet} />}
      {sheet && sheet.type === 'service' && <ServiceSheet key={sheet.key} id={sheet.id} onClose={closeSheet} />}
      <Suspense fallback={null}>{settings && <SettingsSheet onClose={() => setSettings(false)} />}</Suspense>
      <Toaster />
    </div>
  );
}
