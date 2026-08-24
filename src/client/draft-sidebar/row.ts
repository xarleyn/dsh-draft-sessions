import {
  createElement,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from "react";
import type { DraftSession } from "../../shared/types.js";
import type { DraftDropMarker } from "./types.js";

interface DraftSidebarRowProps {
  readonly draft: DraftSession;
  readonly title: string;
  readonly workspaceName: string;
  readonly selected: boolean;
  readonly active: boolean;
  readonly editing: boolean;
  readonly menuOpen: boolean;
  readonly disabled: boolean;
  readonly renameText: string;
  readonly drop: DraftDropMarker | undefined;
  readonly rowRef: Ref<HTMLDivElement>;
  readonly actionRef: Ref<HTMLButtonElement>;
  readonly onFocus: () => void;
  readonly onOpen: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  readonly onContextMenu: (event: MouseEvent) => void;
  readonly onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDrop: (event: DragEvent<HTMLDivElement>) => void;
  readonly onDragEnd: () => void;
  readonly onRenameText: (value: string) => void;
  readonly onRenameCancel: () => void;
  readonly onRenameSubmit: () => void;
  readonly onToggleMenu: (event: MouseEvent) => void;
}

export function DraftSidebarRow({
  draft,
  title,
  workspaceName,
  selected,
  active,
  editing,
  menuOpen,
  disabled,
  renameText,
  drop,
  rowRef,
  actionRef,
  onFocus,
  onOpen,
  onKeyDown,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRenameText,
  onRenameCancel,
  onRenameSubmit,
  onToggleMenu,
}: DraftSidebarRowProps) {
  return createElement(
    "div",
    {
      ref: rowRef,
      className: "dsd-row",
      role: "treeitem",
      tabIndex: active ? 0 : -1,
      "aria-selected": selected,
      "aria-label": `${title}, Draft`,
      "data-selected": selected,
      "data-state": draft.state,
      "data-menu": menuOpen,
      "data-drop": drop?.id === draft.id ? drop.half : undefined,
      draggable: !editing && !disabled,
      onFocus,
      onClick: () => {
        if (!editing && !menuOpen) onOpen();
      },
      onKeyDown,
      onContextMenu,
      onDragStart,
      onDragOver,
      onDrop,
      onDragEnd,
    },
    createElement("span", {
      className: "dsd-dot",
      "aria-hidden": true,
    }),
    editing
      ? createElement("input", {
          className: "dsd-rename",
          value: renameText,
          autoFocus: true,
          "aria-label": "Draft title",
          disabled,
          onClick: (event: MouseEvent) => event.stopPropagation(),
          onChange: (event: { currentTarget: HTMLInputElement }) =>
            onRenameText(event.currentTarget.value),
          onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onRenameCancel();
            } else if (event.key === "Enter") {
              event.preventDefault();
              onRenameSubmit();
            }
          },
        })
      : createElement("span", { className: "dsd-title" }, title),
    createElement("span", { className: "dsd-workspace" }, workspaceName),
    createElement(
      "span",
      { className: "dsd-badge" },
      draft.state === "error" ? "Error" : "Draft",
    ),
    createElement(
      "span",
      { className: "dsd-actions" },
      createElement(
        "button",
        {
          ref: actionRef,
          type: "button",
          className: "dsd-menu-button",
          "aria-label": `Actions for ${title}`,
          "aria-expanded": menuOpen,
          disabled,
          onClick: onToggleMenu,
        },
        "⋯",
      ),
    ),
  );
}
