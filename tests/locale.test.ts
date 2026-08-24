// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftSidebarView } from "../src/client/draft-sidebar-view.js";
import { dictionaries } from "../src/client/locale.js";

afterEach(cleanup);

const ru = {
  "section.label": "Черновики",
  "section.aria": "Сеансы черновиков",
  "action.new": "Новый черновик",
} as const;

describe("draft locale", () => {
  it("includes Russian copy for the missing-Workspace error", () => {
    expect(Reflect.get(dictionaries.ru, "error.workspace.required")).toBe(
      "Сначала выберите рабочую область",
    );
  });

  it("renders browser copy through the supplied translator", () => {
    const t = (key: keyof typeof ru) => ru[key];
    render(
      createElement(DraftSidebarView, {
        drafts: [],
        onCreate: vi.fn(async () => undefined),
        onOpen: vi.fn(),
        onRename: vi.fn(async () => undefined),
        onDuplicate: vi.fn(async () => undefined),
        onDelete: vi.fn(async () => undefined),
        onReorder: vi.fn(async () => undefined),
        t,
      } as never),
    );

    expect(screen.getByRole("button", { name: "Новый черновик" })).toBeTruthy();
    expect(
      screen.getByRole("tree", { name: "Сеансы черновиков" }),
    ).toBeTruthy();
    expect(screen.getByText("Черновики")).toBeTruthy();
  });
});
