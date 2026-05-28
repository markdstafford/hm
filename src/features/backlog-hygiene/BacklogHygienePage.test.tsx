import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BacklogHygienePage } from "./BacklogHygienePage";
import { HYGIENE_SUGGESTION_FIXTURE } from "./fixture";

beforeAll(() => {
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) window.HTMLElement.prototype.hasPointerCapture = () => false;
  if (!window.HTMLElement.prototype.releasePointerCapture) window.HTMLElement.prototype.releasePointerCapture = () => {};
  if (!window.HTMLElement.prototype.setPointerCapture) window.HTMLElement.prototype.setPointerCapture = () => {};
  if (!window.HTMLElement.prototype.scrollIntoView) window.HTMLElement.prototype.scrollIntoView = () => {};
});

vi.mock("./data", () => ({ useHygieneSuggestions: vi.fn() }));
vi.mock("../../bindings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../bindings")>();
  return {
    ...actual,
    commands: {
      ...actual.commands,
      collectionViewsSeedDefaults: vi.fn(),
      collectionViewSave: vi.fn(),
      collectionViewDelete: vi.fn(),
    },
  };
});
vi.mock("../../preferences/storage", () => ({ loadPreferences: vi.fn(), savePreferences: vi.fn() }));

import { useHygieneSuggestions } from "./data";
import { commands } from "../../bindings";
import { loadPreferences, savePreferences } from "../../preferences/storage";

const defaultViewRecords = [
  { id: "hygiene-suggestion-all", entity_kind: "hygiene-suggestion", display_name: "All", position: 0, is_default: true, config: {} },
  { id: "hygiene-suggestion-by-action", entity_kind: "hygiene-suggestion", display_name: "By action", position: 1, is_default: true, config: {} },
  { id: "hygiene-suggestion-high-confidence", entity_kind: "hygiene-suggestion", display_name: "High confidence", position: 2, is_default: true, config: {} },
];

function PageWrapper({ active = true }: { active?: boolean }) {
  const page = BacklogHygienePage({ active });
  return <div>{page.titleBar}{page.header}{page.content}</div>;
}

function renderPage(active = true) {
  return render(<PageWrapper active={active} />);
}

function mockDefaults() {
  vi.mocked(commands.collectionViewsSeedDefaults).mockResolvedValue({ status: "ok", data: defaultViewRecords });
  vi.mocked(commands.collectionViewSave).mockImplementation(async (view: any) => ({
    status: "ok",
    data: { id: view.id, entity_kind: view.entity_kind, display_name: view.display_name, position: view.position, is_default: view.is_default, config: view.config },
  }));
  vi.mocked(commands.collectionViewDelete).mockResolvedValue({ status: "ok", data: null });
  vi.mocked(loadPreferences).mockResolvedValue({});
  vi.mocked(savePreferences).mockImplementation(async (current: any, patch: any) => ({ ok: true, next: { ...current, ...patch } }));
}

describe("BacklogHygienePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
    mockDefaults();
    vi.mocked(useHygieneSuggestions).mockReturnValue({
      suggestions: HYGIENE_SUGGESTION_FIXTURE,
      loading: false,
      error: null,
      partialFailures: [],
    });
  });

  it("renders fixture suggestions and hygiene default view chips", async () => {
    renderPage();
    expect(await screen.findByRole("button", { name: "All" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "By action" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "High confidence" })).toBeInTheDocument();
    expect(screen.getByText("AMP-1149 → AMP-1102")).toBeInTheDocument();
    expect(screen.getByText("Merge as duplicate")).toBeInTheDocument();
  });

  it("opens category-specific detail content", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: /merge as duplicate.*amp-1149/i }));
    expect(await screen.findByRole("heading", { name: "This issue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Duplicate of" })).toBeInTheDocument();
  });

  it("renders loading state with accessible copy", () => {
    vi.mocked(useHygieneSuggestions).mockReturnValue({ suggestions: [], loading: true, error: null, partialFailures: [] });
    renderPage();
    expect(screen.getByRole("status", { name: "Loading hygiene suggestions" })).toBeInTheDocument();
  });

  it("renders empty state with hygiene copy", async () => {
    vi.mocked(useHygieneSuggestions).mockReturnValue({ suggestions: [], loading: false, error: null, partialFailures: [] });
    renderPage();
    expect(await screen.findByText("No suggestions yet")).toBeInTheDocument();
    expect(screen.getByText(/triage engines have not produced any suggestions/i)).toBeInTheDocument();
  });

  it("renders full-error state without raw details", async () => {
    vi.mocked(useHygieneSuggestions).mockReturnValue({ suggestions: [], loading: false, error: "SQLITE_AUTH token abc123", partialFailures: [] });
    renderPage();
    expect(await screen.findByText("Could not load hygiene suggestions")).toBeInTheDocument();
    expect(screen.queryByText(/SQLITE_AUTH|abc123/)).not.toBeInTheDocument();
  });

  it("renders partial failures above available rows", async () => {
    vi.mocked(useHygieneSuggestions).mockReturnValue({
      suggestions: HYGIENE_SUGGESTION_FIXTURE,
      loading: false,
      error: null,
      partialFailures: [{ source: "duplicate-detection", message: "The duplicate-detection engine is unavailable. Showing available suggestions." }],
    });
    renderPage();
    expect(await screen.findByText("AMP-1043")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("The duplicate-detection engine is unavailable. Showing available suggestions.");
  });
});
