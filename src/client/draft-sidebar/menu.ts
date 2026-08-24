import { createElement, Fragment, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { DraftSession } from "../../shared/types.js";
import type { DraftMenuPosition } from "./types.js";

interface DraftSidebarMenuProps {
  readonly draft: DraftSession;
  readonly confirming: boolean;
  readonly menuRef: RefObject<HTMLDivElement>;
  readonly position: DraftMenuPosition | undefined;
  readonly onCancelConfirm: () => void;
  readonly onConfirmDelete: () => void;
  readonly onRename: () => void;
  readonly onDuplicate: () => void;
  readonly onRequestDelete: () => void;
}

export function DraftSidebarMenu({
  confirming,
  menuRef,
  position,
  onCancelConfirm,
  onConfirmDelete,
  onRename,
  onDuplicate,
  onRequestDelete,
}: DraftSidebarMenuProps) {
  const menu = createElement(
    "div",
    {
      ref: menuRef,
      className: "dsd-menu",
      role: "menu",
      style:
        position === undefined
          ? { visibility: "hidden", top: 0, right: 0 }
          : position,
    },
    confirming
      ? createElement(
          Fragment,
          null,
          createElement(
            "div",
            { className: "dsd-confirm" },
            "Delete this unsent draft?",
          ),
          createElement(
            "div",
            { className: "dsd-confirm-actions" },
            createElement(
              "button",
              {
                type: "button",
                className: "dsd-menu-item",
                onClick: onCancelConfirm,
              },
              "Cancel",
            ),
            createElement(
              "button",
              {
                type: "button",
                className: "dsd-menu-item",
                "data-danger": true,
                onClick: onConfirmDelete,
              },
              "Delete",
            ),
          ),
        )
      : createElement(
          Fragment,
          null,
          createElement(
            "button",
            {
              type: "button",
              className: "dsd-menu-item",
              role: "menuitem",
              onClick: onRename,
            },
            "Rename",
          ),
          createElement(
            "button",
            {
              type: "button",
              className: "dsd-menu-item",
              role: "menuitem",
              onClick: onDuplicate,
            },
            "Duplicate",
          ),
          createElement(
            "button",
            {
              type: "button",
              className: "dsd-menu-item",
              role: "menuitem",
              "data-danger": true,
              onClick: onRequestDelete,
            },
            "Delete…",
          ),
        ),
  );
  return createPortal(menu, document.body);
}
