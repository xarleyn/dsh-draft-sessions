import {
  createElement,
  Fragment,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { displayDraftTitle, type DraftSession } from "../../shared/types.js";
import { useDraftMenuPosition, useRovingDraftFocus } from "./hooks.js";
import { DraftSidebarMenu } from "./menu.js";
import { DraftSidebarRow } from "./row.js";
import { DRAFT_SIDEBAR_CSS } from "./styles.js";
import type {
  DraftDropMarker,
  DraftDropTarget,
  DraftSidebarViewProps,
} from "./types.js";

function ordered(drafts: readonly DraftSession[]): DraftSession[] {
  return [...drafts].sort(
    (left, right) =>
      left.workspaceId.localeCompare(right.workspaceId) ||
      Number(right.pinned === true) - Number(left.pinned === true) ||
      left.order - right.order ||
      left.id.localeCompare(right.id),
  );
}

export function resolveDraftDropTarget(
  drafts: readonly DraftSession[],
  sourceId: string,
  targetId: string,
  half: "before" | "after",
): DraftDropTarget | undefined {
  const source = drafts.find((draft) => draft.id === sourceId);
  const target = drafts.find((draft) => draft.id === targetId);
  if (
    source === undefined ||
    target === undefined ||
    source.workspaceId !== target.workspaceId ||
    Boolean(source.pinned) !== Boolean(target.pinned)
  ) {
    return undefined;
  }
  const workspace = ordered(
    drafts.filter((draft) => draft.workspaceId === source.workspaceId),
  );
  const targetIndex = workspace.findIndex((draft) => draft.id === targetId);
  const beforeDraftId =
    half === "before" ? targetId : workspace[targetIndex + 1]?.id;
  return {
    workspaceId: source.workspaceId,
    ...(beforeDraftId === undefined ? {} : { beforeDraftId }),
  };
}

function rowTitle(draft: DraftSession): string {
  return displayDraftTitle(draft) || "Untitled draft";
}

export function DraftSidebarView({
  surface = "inline",
  drafts,
  currentSessionId,
  workspaceNames = {},
  onCreate,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
  onReorder,
}: DraftSidebarViewProps) {
  const rows = ordered(drafts);
  const { activeId, refs, setActiveId, focusAt } = useRovingDraftFocus(rows);
  const [menuId, setMenuId] = useState<string>();
  const [confirmingId, setConfirmingId] = useState<string>();
  const [editingId, setEditingId] = useState<string>();
  const [renameText, setRenameText] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [draggingId, setDraggingId] = useState<string>();
  const [drop, setDrop] = useState<DraftDropMarker>();
  const { actionRefs, menuRef, menuPosition } = useDraftMenuPosition(
    menuId,
    confirmingId,
  );

  const beginRename = (draft: DraftSession) => {
    setMenuId(undefined);
    setConfirmingId(undefined);
    setEditingId(draft.id);
    setRenameText(rowTitle(draft));
    setError(undefined);
  };
  const run = (draft: DraftSession, action: () => Promise<void>) => {
    setBusyId(draft.id);
    setError(undefined);
    void action()
      .then(() => {
        setMenuId(undefined);
        setConfirmingId(undefined);
        setEditingId(undefined);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setBusyId(undefined));
  };
  const createDraft = () => {
    setCreating(true);
    setError(undefined);
    void onCreate()
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => setCreating(false));
  };
  const keyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    draft: DraftSession,
  ) => {
    if (event.currentTarget !== event.target) return;
    const index = rows.findIndex((row) => row.id === draft.id);
    if (
      event.key === "ContextMenu" ||
      (event.key === "F10" && event.shiftKey)
    ) {
      event.preventDefault();
      setConfirmingId(undefined);
      setMenuId(draft.id);
      return;
    }
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusAt(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusAt(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusAt(0);
        break;
      case "End":
        event.preventDefault();
        focusAt(rows.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        onOpen(draft);
        break;
      case "F2":
        event.preventDefault();
        beginRename(draft);
        break;
      case "Delete":
        event.preventDefault();
        setMenuId(draft.id);
        setConfirmingId(draft.id);
        break;
      case "Escape":
        event.preventDefault();
        setMenuId(undefined);
        setConfirmingId(undefined);
        setEditingId(undefined);
        break;
    }
  };
  const dragOver = (event: DragEvent<HTMLDivElement>, draft: DraftSession) => {
    if (draggingId === undefined) return;
    const source = rows.find((row) => row.id === draggingId);
    if (
      source === undefined ||
      source.workspaceId !== draft.workspaceId ||
      Boolean(source.pinned) !== Boolean(draft.pinned)
    ) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDrop({
      id: draft.id,
      half: event.clientY < rect.top + rect.height / 2 ? "before" : "after",
    });
  };

  const menuDraft = rows.find((draft) => draft.id === menuId);
  return createElement(
    Fragment,
    null,
    createElement("style", null, DRAFT_SIDEBAR_CSS),
    createElement(
      "section",
      {
        className: "dsd-panel",
        "data-surface": surface,
        "aria-label": "Draft sessions",
      },
      createElement(
        "div",
        { className: "dsd-heading" },
        createElement("span", { className: "dsd-heading-label" }, "Drafts"),
        createElement(
          "button",
          {
            type: "button",
            className: "dsd-add",
            "aria-label": "New draft",
            disabled: creating,
            onClick: createDraft,
          },
          "+",
        ),
      ),
      createElement(
        "div",
        { role: "tree", "aria-label": "Draft sessions" },
        ...rows.map((draft) => {
          const selected = draft.sessionId === currentSessionId;
          const editing = editingId === draft.id;
          const menuOpen = menuId === draft.id;
          const disabled = busyId === draft.id;
          const title = rowTitle(draft);
          return createElement(DraftSidebarRow, {
            key: draft.id,
            draft,
            title,
            workspaceName: workspaceNames[draft.workspaceId] ?? "",
            selected,
            active: activeId === draft.id,
            editing,
            menuOpen,
            disabled,
            renameText,
            drop,
            rowRef: (node: HTMLDivElement | null) => {
              if (node === null) refs.current.delete(draft.id);
              else refs.current.set(draft.id, node);
            },
            actionRef: (node: HTMLButtonElement | null) => {
              if (node === null) actionRefs.current.delete(draft.id);
              else actionRefs.current.set(draft.id, node);
            },
            onFocus: () => setActiveId(draft.id),
            onOpen: () => onOpen(draft),
            onKeyDown: (event: KeyboardEvent<HTMLDivElement>) =>
              keyDown(event, draft),
            onContextMenu: (event: MouseEvent) => {
              event.preventDefault();
              setMenuId(draft.id);
            },
            onDragStart: (event: DragEvent<HTMLDivElement>) => {
              setDraggingId(draft.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", draft.id);
            },
            onDragOver: (event: DragEvent<HTMLDivElement>) =>
              dragOver(event, draft),
            onDrop: (event: DragEvent<HTMLDivElement>) => {
              event.preventDefault();
              const sourceId = draggingId;
              const marker = drop;
              setDraggingId(undefined);
              setDrop(undefined);
              if (sourceId === undefined || marker === undefined) return;
              const target = resolveDraftDropTarget(
                rows,
                sourceId,
                marker.id,
                marker.half,
              );
              if (target === undefined) return;
              void onReorder(
                target.workspaceId,
                sourceId,
                target.beforeDraftId,
              ).catch((cause: unknown) => {
                setError(
                  cause instanceof Error ? cause.message : String(cause),
                );
              });
            },
            onDragEnd: () => {
              setDraggingId(undefined);
              setDrop(undefined);
            },
            onRenameText: setRenameText,
            onRenameCancel: () => setEditingId(undefined),
            onRenameSubmit: () => {
              const title = renameText.trim();
              if (title !== "") run(draft, () => onRename(draft, title));
            },
            onToggleMenu: (event: MouseEvent) => {
              event.stopPropagation();
              setConfirmingId(undefined);
              setMenuId(menuOpen ? undefined : draft.id);
            },
          });
        }),
      ),
      error === undefined
        ? null
        : createElement(
            "div",
            { className: "dsd-error", role: "alert" },
            error,
          ),
      menuDraft === undefined
        ? null
        : createElement(DraftSidebarMenu, {
            draft: menuDraft,
            confirming: confirmingId === menuDraft.id,
            menuRef,
            position: menuPosition,
            onCancelConfirm: () => setConfirmingId(undefined),
            onConfirmDelete: () => run(menuDraft, () => onDelete(menuDraft)),
            onRename: () => beginRename(menuDraft),
            onDuplicate: () => run(menuDraft, () => onDuplicate(menuDraft)),
            onRequestDelete: () => setConfirmingId(menuDraft.id),
          }),
    ),
  );
}
