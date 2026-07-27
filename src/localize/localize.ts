import en from './en.json';
import fr from './fr.json';

type LocaleTree = { [key: string]: string | LocaleTree };

const LOCALES: Record<string, LocaleTree> = { en, fr };

function resolveKey(tree: LocaleTree, key: string): string | undefined {
  const parts = key.split('.');
  let node: string | LocaleTree | undefined = tree;
  for (const part of parts) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Resolves a translation key against the given language, falling back to English. */
export function localize(language: string | undefined, key: string, vars?: Record<string, string | number>): string {
  const lang = (language || 'en').split('-')[0].toLowerCase();
  const tree = LOCALES[lang] || LOCALES.en;
  let value = resolveKey(tree, key) ?? resolveKey(LOCALES.en, key) ?? key;
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.replace(`{${name}}`, String(replacement));
    }
  }
  return value;
}

export function supportedLanguages(): string[] {
  return Object.keys(LOCALES);
}
