import {
  dictionaries,
  type DraftLocaleKey,
  type DraftTranslate,
} from "../src/client/locale.js";

type TestLocale = keyof typeof dictionaries;

export function createTestLocale(initial: TestLocale = "en") {
  let active = initial;
  let revision = 0;
  const listeners = new Set<() => void>();
  const translate: DraftTranslate = (key, params) =>
    dictionaries[active][key as DraftLocaleKey].replace(
      /\{(\w+)\}/gu,
      (_match, name: string) => String(params?.[name]),
    );
  let snapshot = Object.freeze({
    active,
    locales: [
      { id: "zh", label: "中文" },
      { id: "en", label: "English" },
    ],
    revision,
  });
  return {
    bind: () => translate,
    getSnapshot: () => snapshot,
    getLocale: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setLocale: (next: TestLocale) => {
      active = next;
      revision += 1;
      snapshot = Object.freeze({ ...snapshot, active, revision });
      for (const listener of listeners) listener();
    },
  };
}
