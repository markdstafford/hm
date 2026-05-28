import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { Button } from "../../ui/buttons/Button";
import { UndoToastProvider, useUndoToast } from "./UndoToast";

function Harness({ undo = vi.fn() }: { undo?: () => void | Promise<void> }) {
  const toast = useUndoToast();
  return (
    <>
      <Button
        onClick={() =>
          toast.show({
            message: "Approved 2 suggestions",
            description: "Written to Jira; logged locally.",
            reversible: true,
            undo,
          })
        }
      >
        Show reversible
      </Button>
      <Button
        onClick={() =>
          toast.show({
            message: "Rejected 1 suggestion",
            description: "Logged locally; one-click undo is unavailable.",
            reversible: false,
          })
        }
      >
        Show non-reversible
      </Button>
      <Button onClick={toast.dismiss}>Dismiss toast</Button>
    </>
  );
}

function renderHarness(undo = vi.fn()) {
  return render(
    <UndoToastProvider>
      <Harness undo={undo} />
    </UndoToastProvider>,
  );
}

describe("UndoToast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a reversible toast with Undo", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Show reversible" }));

    expect(screen.getByText("Approved 2 suggestions")).toBeInTheDocument();
    expect(screen.getByText("Written to Jira; logged locally.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("calls undo once and dismisses", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    renderHarness(undo);

    await user.click(screen.getByRole("button", { name: "Show reversible" }));
    await user.click(screen.getByRole("button", { name: "Undo" }));

    expect(undo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Approved 2 suggestions")).not.toBeInTheDocument());
  });

  it("omits Undo for non-reversible inputs", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Show non-reversible" }));

    expect(screen.getByText("Rejected 1 suggestion")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("replaces the previous toast when showing a new one", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Show reversible" }));
    await user.click(screen.getByRole("button", { name: "Show non-reversible" }));

    expect(screen.queryByText("Approved 2 suggestions")).not.toBeInTheDocument();
    expect(screen.getByText("Rejected 1 suggestion")).toBeInTheDocument();
  });

  it("auto-dismisses after 8 seconds", async () => {
    vi.useFakeTimers();
    renderHarness();

    // Use fireEvent (synchronous) to avoid userEvent hanging with fake timers
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Show reversible" }));
    });
    // Flush the 0ms setTimeout used to open the toast
    await act(async () => {
      vi.advanceTimersByTime(0);
    });
    expect(screen.getByText("Approved 2 suggestions")).toBeInTheDocument();

    // Advance past the 8s auto-dismiss
    await act(async () => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.queryByText("Approved 2 suggestions")).not.toBeInTheDocument();
  });

  it("has no axe violations when visible", async () => {
    const user = userEvent.setup();
    const { container } = renderHarness();

    await user.click(screen.getByRole("button", { name: "Show reversible" }));

    expect(await axe(container)).toHaveNoViolations();
  });
});
