import en from './en.json';

export type MessageKey = keyof typeof en;

const messages: Record<MessageKey, string> = en;

export const locale = 'en';

/**
 * Looks up a UI string and fills in `{name}` placeholders. Only English exists until M4 adds
 * fr, de and hu.
 */
export function t(key: MessageKey, params: Record<string, string> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}

/** True if the key exists, for keys built at runtime such as `event.<id>.title`. */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(messages, key);
}
