import en from './en.json';

export type MessageKey = keyof typeof en;

const messages: Record<MessageKey, string> = en;

/** Looks up a UI string. Only English exists until M4 adds fr, de and hu. */
export function t(key: MessageKey): string {
  return messages[key];
}
