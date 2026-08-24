import type { DraftSession } from "../../shared/types.js";

export interface DraftDropTarget {
  readonly workspaceId: string;
  readonly beforeDraftId?: string;
}

export interface DraftSidebarViewProps {
  readonly surface?: "inline" | "tab" | "popover";
  readonly drafts: readonly DraftSession[];
  readonly currentSessionId?: string;
  readonly workspaceNames?: Readonly<Record<string, string>>;
  readonly onCreate: () => Promise<void>;
  readonly onOpen: (draft: DraftSession) => void;
  readonly onRename: (draft: DraftSession, title: string) => Promise<void>;
  readonly onDuplicate: (draft: DraftSession) => Promise<void>;
  readonly onDelete: (draft: DraftSession) => Promise<void>;
  readonly onReorder: (
    workspaceId: string,
    draftId: string,
    beforeDraftId?: string,
  ) => Promise<void>;
}

export interface DraftMenuPosition {
  readonly top: number;
  readonly right: number;
}

export interface DraftDropMarker {
  readonly id: string;
  readonly half: "before" | "after";
}
