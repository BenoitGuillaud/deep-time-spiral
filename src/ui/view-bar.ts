import { t, type MessageKey } from '../i18n/i18n';
import type { ViewName } from '../render3d/camera';

/**
 * Big buttons to change the view: Home, Top, Side, Move (on/off), 2D ⇄ 3D, the journey again, and
 * the voice on/off.
 */

export interface ViewBar {
  element: HTMLElement;
  /** Shows the 3D buttons (in 3D), or in 2D only the "3D" button (where 3D works) and Journey. */
  setMode(mode: '2d' | '3d', has3d: boolean): void;
  /** Shows the voice as on or off; greyed out where there is no voice for the language. */
  setVoice(on: boolean, available: boolean): void;
}

// Simple line icons, 24 × 24.
const ICONS: Record<ViewName | 'move' | '2d' | '3d' | 'journey' | 'voice', string> = {
  home: 'M4 11 12 4l8 7M6 10v9h12v-9',
  top: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0',
  side: 'M5 5h14M7 9h10M9 13h6M11 17h2',
  move: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3',
  '2d': 'M4 6h16v12H4z',
  '3d': 'M12 3 20 7.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  journey: 'M8 5v14l11-7z',
  voice: 'M4 9v6h4l5 4V5L8 9zM16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12',
};

function button(kind: keyof typeof ICONS, label: MessageKey, hint: MessageKey): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'view-button';
  b.dataset.view = kind;
  b.title = t(hint);
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[kind]}"/></svg>`;
  const text = document.createElement('span');
  text.textContent = t(label);
  b.append(text);
  return b;
}

export function createViewBar(handlers: {
  onView: (view: ViewName) => void;
  onToggle: () => void;
  /** Move mode on: dragging slides the model instead of turning it. */
  onMove: (on: boolean) => void;
  /** Plays the landing journey again. */
  onJourney: () => void;
  onVoice: (on: boolean) => void;
}): ViewBar {
  const bar = document.createElement('nav');
  bar.className = 'view-bar';
  bar.setAttribute('aria-label', t('view.bar'));
  const views: [ViewName, MessageKey, MessageKey][] = [
    ['home', 'view.home', 'view.home.hint'],
    ['top', 'view.top', 'view.top.hint'],
    ['side', 'view.side', 'view.side.hint'],
  ];
  const viewButtons = views.map(([view, label, hint]) => {
    const b = button(view, label, hint);
    b.addEventListener('click', () => {
      handlers.onView(view);
    });
    return b;
  });
  const move = button('move', 'view.move', 'view.move.hint');
  move.setAttribute('aria-pressed', 'false');
  move.addEventListener('click', () => {
    const on = move.getAttribute('aria-pressed') !== 'true';
    move.setAttribute('aria-pressed', String(on));
    handlers.onMove(on);
  });
  const to2d = button('2d', 'view.2d', 'view.2d.hint');
  const to3d = button('3d', 'view.3d', 'view.3d.hint');
  for (const b of [to2d, to3d]) b.addEventListener('click', handlers.onToggle);
  const journey = button('journey', 'journey.play', 'journey.play.hint');
  journey.addEventListener('click', handlers.onJourney);
  const voice = button('voice', 'voice.toggle', 'voice.toggle.hint');
  voice.setAttribute('aria-pressed', 'true');
  voice.addEventListener('click', () => {
    handlers.onVoice(voice.getAttribute('aria-pressed') !== 'true');
  });
  bar.append(...viewButtons, move, to2d, to3d, journey, voice);

  const setMode = (mode: '2d' | '3d', has3d: boolean): void => {
    for (const b of [...viewButtons, move, to2d]) b.hidden = mode === '2d';
    to3d.hidden = mode === '3d' || !has3d;
  };
  const setVoice = (on: boolean, available: boolean): void => {
    voice.setAttribute('aria-pressed', String(on && available));
    voice.disabled = !available;
    voice.title = available ? t('voice.toggle.hint') : t('voice.missing');
  };
  setMode('2d', false);
  bar.hidden = true;
  return { element: bar, setMode, setVoice };
}
