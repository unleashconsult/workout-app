import './styles.css';
import { Store } from './storage/store';
import type { ViewContext } from './ui/context';
import { dayView } from './ui/dayView';
import { h, toast } from './ui/dom';
import { historyView } from './ui/historyView';
import { icon } from './ui/icons';
import { exerciseView, newExerciseView, programView } from './ui/programView';
import { settingsView } from './ui/settingsView';
import { Timer } from './ui/timer';
import { isDateKey } from './domain/dates';

const store = new Store();
const app = document.getElementById('app')!;
const viewHost = h('div', { id: 'view-host' });
const timerHost = h('div', { id: 'timer', hidden: true });
const timer = new Timer(timerHost, () => store.get().settings.soundEnabled);

let cleanups: Array<() => void> = [];

const TABS = [
  { path: '/', label: 'I dag', icon: 'today' },
  { path: '/history', label: 'Overblik', icon: 'history' },
  { path: '/program', label: 'Program', icon: 'program' },
  { path: '/settings', label: 'Indstillinger', icon: 'settings' },
] as const;

function currentPath(): string {
  return location.hash.replace(/^#/, '') || '/';
}

function navigate(path: string): void {
  if (currentPath() === path) render();
  else location.hash = path;
}

const ctx: ViewContext = {
  store,
  timer,
  navigate,
  now: () => new Date(),
  onCleanup: (fn) => cleanups.push(fn),
};

function resolve(path: string): HTMLElement {
  const [, section = '', param = ''] = path.split('/');
  switch (section) {
    case '':
      return dayView(ctx);
    case 'day':
      return isDateKey(param) ? dayView(ctx, param) : dayView(ctx);
    case 'history':
      return historyView(ctx);
    case 'program':
      return programView(ctx);
    case 'exercise':
      return param === 'new' ? newExerciseView(ctx) : exerciseView(ctx, decodeURIComponent(param));
    case 'settings':
      return settingsView(ctx);
    default:
      return dayView(ctx);
  }
}

function activeTab(path: string): string {
  if (path.startsWith('/day')) return '/';
  if (path.startsWith('/exercise')) return '/program';
  return TABS.some((t) => t.path === path) ? path : '/';
}

let lastPath = '';

function render(): void {
  const path = currentPath();
  const keepScroll = path === lastPath;
  const scrollY = window.scrollY;
  cleanups.forEach((fn) => fn());
  cleanups = [];

  let view: HTMLElement;
  try {
    view = resolve(path);
  } catch (err) {
    console.error(err);
    view = h('main', { class: 'view' }, h('h1', null, 'Noget gik galt'), h('p', { class: 'error' }, String(err)));
  }
  viewHost.replaceChildren(view);

  const tab = activeTab(path);
  for (const btn of nav.querySelectorAll<HTMLAnchorElement>('a')) {
    const active = btn.dataset.path === tab;
    btn.classList.toggle('active', active);
    if (active) btn.setAttribute('aria-current', 'page');
    else btn.removeAttribute('aria-current');
  }
  window.scrollTo(0, keepScroll ? scrollY : 0);
  lastPath = path;
}

const nav = h(
  'nav',
  { class: 'tabbar', 'aria-label': 'Hovedmenu' },
  TABS.map((t) => h('a', { href: `#${t.path}`, 'data-path': t.path }, icon(t.icon, 'tab-icon'), h('span', null, t.label))),
);

app.replaceChildren(viewHost, timerHost, h('div', { id: 'toasts', 'aria-live': 'polite' }), nav);

store.subscribe(() => {
  render();
  if (store.persistError) toast(`Kunne ikke gemme: ${store.persistError}`, 'error');
});
window.addEventListener('hashchange', render);

// Skift automatisk til ny dag hvis appen står åben over midnat.
let renderedDay = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const day = new Date().toDateString();
  if (day !== renderedDay) {
    renderedDay = day;
    render();
  }
});

render();

if (store.loadError) {
  toast(`Gemte data kunne ikke læses og er gemt til side. (${store.loadError})`, 'error');
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err: unknown) => console.warn('Service worker fejlede', err));
  });
}
