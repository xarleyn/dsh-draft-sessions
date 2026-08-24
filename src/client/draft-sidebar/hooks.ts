import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import type { DraftSession } from "../../shared/types.js";
import type { DraftMenuPosition } from "./types.js";

export function useRovingDraftFocus(rows: readonly DraftSession[]): {
  readonly activeId: string | undefined;
  readonly refs: MutableRefObject<Map<string, HTMLDivElement>>;
  readonly setActiveId: (id: string) => void;
  readonly focusAt: (index: number) => void;
} {
  const [activeId, setActiveId] = useState(() => rows[0]?.id);
  const refs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (activeId !== undefined && rows.some((row) => row.id === activeId)) {
      return;
    }
    setActiveId(rows[0]?.id);
  }, [activeId, rows]);

  const focusAt = (index: number) => {
    const next = rows[Math.max(0, Math.min(rows.length - 1, index))];
    if (next === undefined) return;
    setActiveId(next.id);
    refs.current.get(next.id)?.focus();
  };

  return { activeId, refs, setActiveId, focusAt };
}

export function useDraftMenuPosition(
  menuId: string | undefined,
  confirmingId: string | undefined,
): {
  readonly actionRefs: MutableRefObject<Map<string, HTMLButtonElement>>;
  readonly menuRef: RefObject<HTMLDivElement>;
  readonly menuPosition: DraftMenuPosition | undefined;
} {
  const actionRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<DraftMenuPosition>();

  useLayoutEffect(() => {
    if (menuId === undefined) {
      setMenuPosition(undefined);
      return;
    }
    const place = () => {
      const trigger = actionRefs.current.get(menuId);
      if (trigger === undefined) return;
      const rect = trigger.getBoundingClientRect();
      const panelHeight = menuRef.current?.offsetHeight ?? 0;
      const below = rect.bottom + 4;
      const top =
        below + panelHeight <= window.innerHeight - 8
          ? below
          : Math.max(8, rect.top - panelHeight - 4);
      setMenuPosition({
        top,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [confirmingId, menuId]);

  return { actionRefs, menuRef, menuPosition };
}
