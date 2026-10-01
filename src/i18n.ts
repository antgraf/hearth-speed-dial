/**
 * Chrome / Firefox extension i18n helper.
 *
 * English copy lives in `_locales/en/messages.json` (store + runtime).
 * When `browser.i18n` / `chrome.i18n` is unavailable (unit tests, Vite preview),
 * the same English catalog is used as a fallback so UI stays readable.
 */

import { tryExtensionApi } from "./webext.ts";
import enMessages from "../_locales/en/messages.json" with { type: "json" };

export type MessageName = keyof typeof enMessages;

type LocaleEntry = {
  message: string;
  description?: string;
  placeholders?: Record<string, { content: string; example?: string }>;
};

const catalog = enMessages as Record<MessageName, LocaleEntry>;

function substitutionsList(substitutions?: string | string[]): string[] {
  if (substitutions == null) return [];
  return Array.isArray(substitutions) ? substitutions : [substitutions];
}

/** Apply `$1`…`$9` placeholders the same way chrome.i18n.getMessage does. */
export function formatMessageTemplate(template: string, substitutions?: string | string[]): string {
  const list = substitutionsList(substitutions);
  return template.replace(/\$(\d+)/g, (match, digits: string) => {
    const index = Number(digits) - 1;
    if (index < 0 || index >= list.length) return match;
    return list[index] ?? match;
  });
}

function fallbackMessage(name: MessageName, substitutions?: string | string[]): string {
  const entry = catalog[name];
  if (!entry) return name;
  return formatMessageTemplate(entry.message, substitutions);
}

/**
 * Resolve a message by key. Prefer the extension i18n API when present;
 * otherwise use the English catalog (tests / preview).
 */
export function t(name: MessageName, substitutions?: string | string[]): string {
  const api = tryExtensionApi();
  try {
    const fromApi = api?.i18n?.getMessage?.(name, substitutions);
    if (fromApi) return fromApi;
  } catch {
    // Missing API or key — fall through to English catalog.
  }
  return fallbackMessage(name, substitutions);
}

/** English catalog entry (for tests asserting source-of-truth copy). */
export function englishMessage(name: MessageName): string {
  return catalog[name]?.message ?? name;
}

/** All message keys shipped in `_locales/en/messages.json`. */
export function englishMessageNames(): MessageName[] {
  return Object.keys(catalog) as MessageName[];
}
