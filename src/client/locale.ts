import type { Context } from "@deepseek-ai/cordis";
import type {} from "@deepseek-ai/dsh-client-locale/client";
import type { TranslateNS } from "@deepseek-ai/dsh-client-ui-slots";
import { useSyncExternalStore } from "react";

export const DRAFT_LOCALE_NAMESPACE = "draft-sessions";

const zh = {
  "section.label": "草稿",
  "section.aria": "草稿会话",
  "draft.untitled": "未命名草稿",
  "draft.row": "{title}，草稿",
  "draft.title.input": "草稿标题",
  "draft.status.default": "草稿",
  "draft.status.error": "错误",
  "action.new": "新建草稿",
  "action.actions": "{title} 的操作",
  "action.rename": "重命名",
  "action.duplicate": "复制",
  "action.delete": "删除",
  "action.delete.ellipsis": "删除…",
  "delete.confirm": "删除这个未发送的草稿吗？",
  "action.cancel": "取消",
  "footer.count": "草稿（{count}）",
  "error.workspace.required": "请先选择工作区",
} as const;

export type DraftLocaleKey = keyof typeof zh;

const en = {
  "section.label": "Drafts",
  "section.aria": "Draft sessions",
  "draft.untitled": "Untitled draft",
  "draft.row": "{title}, Draft",
  "draft.title.input": "Draft title",
  "draft.status.default": "Draft",
  "draft.status.error": "Error",
  "action.new": "New draft",
  "action.actions": "Actions for {title}",
  "action.rename": "Rename",
  "action.duplicate": "Duplicate",
  "action.delete": "Delete",
  "action.delete.ellipsis": "Delete…",
  "delete.confirm": "Delete this unsent draft?",
  "action.cancel": "Cancel",
  "footer.count": "Drafts ({count})",
  "error.workspace.required": "Choose a Workspace before creating a draft",
} as const satisfies Record<DraftLocaleKey, string>;

const ru = {
  "section.label": "Черновики",
  "section.aria": "Сеансы черновиков",
  "draft.untitled": "Без названия",
  "draft.row": "{title}, черновик",
  "draft.title.input": "Название черновика",
  "draft.status.default": "Черновик",
  "draft.status.error": "Ошибка",
  "action.new": "Новый черновик",
  "action.actions": "Действия для {title}",
  "action.rename": "Переименовать",
  "action.duplicate": "Создать копию",
  "action.delete": "Удалить",
  "action.delete.ellipsis": "Удалить…",
  "delete.confirm": "Удалить этот неотправленный черновик?",
  "action.cancel": "Отмена",
  "footer.count": "Черновики ({count})",
  "error.workspace.required": "Сначала выберите рабочую область",
} as const satisfies Record<DraftLocaleKey, string>;

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    "draft-sessions": DraftLocaleKey;
  }
}

export type DraftTranslate = TranslateNS<typeof DRAFT_LOCALE_NAMESPACE>;

export const dictionaries = { zh, en, ru } as const;

export function registerDraftLocale(ctx: Pick<Context, "locale">): () => void {
  const disposeTyped = ctx.locale.register(DRAFT_LOCALE_NAMESPACE, { zh, en });
  let disposeRussian: () => void;
  try {
    disposeRussian = ctx.locale.register(DRAFT_LOCALE_NAMESPACE, "ru", ru);
  } catch (error) {
    disposeTyped();
    throw error;
  }
  return () => {
    disposeRussian();
    disposeTyped();
  };
}

export function useDraftTranslate(
  ctx: Pick<Context, "locale">,
): DraftTranslate {
  useSyncExternalStore(
    (listener) => ctx.locale.subscribe(listener),
    () => ctx.locale.getSnapshot(),
    () => ctx.locale.getSnapshot(),
  );
  return ctx.locale.bind(DRAFT_LOCALE_NAMESPACE);
}
