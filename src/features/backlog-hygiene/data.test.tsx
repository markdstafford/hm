import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useHygieneSuggestions, mapHygieneSuggestion } from "./data";

// Mock bindings
vi.mock("../../bindings", () => ({
  commands: {
    hygieneSuggestionsList: vi.fn(),
  },
}));

import { commands } from "../../bindings";

const mockDto = {
  id: "sug-1",
  category: "stale",
  action: "close-as-resolved",
  confidence: 60,
  rationale: "Reference gardener output: proves the local suggestion pipeline.",
  target: {
    key: "TEST-1",
    title: "Test issue title",
    status: "Open",
    assignee: null,
    updated_at: "2026-01-01T00:00:00Z",
    body: null,
    labels: [],
  },
  duplicate_of: null,
  last_activity_at: "2026-01-01T00:00:00Z",
  proposed: null,
};

describe("useHygieneSuggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as any).__TAURI_INTERNALS__ = { invoke: vi.fn() };
  });

  it("loads command-backed suggestions by default", async () => {
    vi.mocked(commands.hygieneSuggestionsList).mockResolvedValue({
      status: "ok",
      data: [mockDto],
    });

    const { result } = renderHook(() => useHygieneSuggestions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestions).toHaveLength(1);
    expect(result.current.suggestions[0].target.key).toBe("TEST-1");
    expect(result.current.error).toBeNull();
  });

  it("returns empty list in non-Tauri browser environment instead of fixtures", async () => {
    delete (window as any).__TAURI_INTERNALS__;

    const { result } = renderHook(() => useHygieneSuggestions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestions).toHaveLength(0);
    expect(result.current.error).toBeNull();
    // Verify the command was NOT called
    expect(commands.hygieneSuggestionsList).not.toHaveBeenCalled();
  });

  it("surfaces a safe display error without raw command details", async () => {
    vi.mocked(commands.hygieneSuggestionsList).mockRejectedValue(
      new Error("SQLITE_AUTH token abc123")
    );

    const { result } = renderHook(() => useHygieneSuggestions());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Could not load hygiene suggestions.");
    expect(result.current.error).not.toContain("SQLITE_AUTH");
    expect(result.current.error).not.toContain("abc123");
  });

  it("retry re-runs the command", async () => {
    vi.mocked(commands.hygieneSuggestionsList)
      .mockRejectedValueOnce(new Error("transient failure"))
      .mockResolvedValueOnce({ status: "ok", data: [mockDto] });

    const { result } = renderHook(() => useHygieneSuggestions());

    // Wait for first (failed) load
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Could not load hygiene suggestions.");

    // Trigger retry
    result.current.retry!();

    // Wait for second (successful) load
    await waitFor(() => expect(result.current.suggestions).toHaveLength(1));
    expect(result.current.error).toBeNull();
  });
});

describe("mapHygieneSuggestion", () => {
  it("maps DTO fields to HygieneSuggestion shape correctly", () => {
    const mapped = mapHygieneSuggestion(mockDto);
    expect(mapped.id).toBe("sug-1");
    expect(mapped.category).toBe("stale");
    expect(mapped.action).toBe("close-as-resolved");
    expect(mapped.confidence).toBe(60);
    expect(mapped.target.key).toBe("TEST-1");
    expect(mapped.target.updatedAt).toBe("2026-01-01T00:00:00Z");
    expect(mapped.lastActivityAt).toBe("2026-01-01T00:00:00Z");
  });
});
