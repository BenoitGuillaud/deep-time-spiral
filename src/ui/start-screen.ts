import { LOCALES } from '../data/types';
import { LANGUAGE_NAMES, locale, switchLocale, t } from '../i18n/i18n';

/**
 * The start screen: the four languages as big buttons, each in its own name (flags are countries,
 * not languages), and one big Start. The tap on Start also lets the browser speak: voices may only
 * start after a tap.
 */

function languageButtons(className: string, short: boolean): HTMLElement {
  const group = document.createElement('div');
  group.className = className;
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', t('language.label'));
  for (const code of LOCALES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.lang = code;
    b.textContent = short ? code.toUpperCase() : LANGUAGE_NAMES[code];
    if (short) b.setAttribute('aria-label', LANGUAGE_NAMES[code]);
    b.setAttribute('aria-pressed', String(code === locale));
    b.addEventListener('click', () => {
      if (code !== locale) switchLocale(code);
    });
    group.append(b);
  }
  return group;
}

export interface StartScreen {
  element: HTMLElement;
  hide(): void;
}

export function createStartScreen(parent: HTMLElement, onStart: () => void): StartScreen {
  const screen = document.createElement('section');
  screen.className = 'start-screen';
  screen.setAttribute('aria-label', t('start.hint'));

  const start = document.createElement('button');
  start.type = 'button';
  start.className = 'start-button';
  start.title = t('start.hint');
  start.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const label = document.createElement('span');
  label.textContent = t('start.button');
  start.append(label);
  start.addEventListener('click', onStart);

  screen.append(languageButtons('start-languages', false), start);
  parent.append(screen);
  start.focus({ preventScroll: true });
  return {
    element: screen,
    hide() {
      screen.classList.add('leaving');
      window.setTimeout(() => {
        screen.remove();
      }, 500);
    },
  };
}

/** The small language switch in a corner, once the journey is over. */
export function createLanguageSwitch(parent: HTMLElement): HTMLElement {
  const group = languageButtons('language-switch', true);
  group.hidden = true;
  parent.append(group);
  return group;
}
