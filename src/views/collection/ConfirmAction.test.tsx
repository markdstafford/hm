import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { useState } from "react";
import { Button } from "../../ui/buttons/Button";
import { ConfirmActionProvider, useConfirmAction } from "./ConfirmAction";

function Harness({ kind = "primary" }: { kind?: "primary" | "destructive" }) {
  const confirm = useConfirmAction();
  const [result, setResult] = useState("not run");
  return (
    <>
      <Button
        onClick={async () => {
          const confirmed = await confirm({
            title: "Approve 2 suggestions?",
            description: "This writes two safe fake changes and records them locally.",
            confirmLabel: "Approve",
            cancelLabel: "Cancel",
            kind,
          });
          setResult(confirmed ? "confirmed" : "cancelled");
        }}
      >
        Open confirm
      </Button>
      <output>{result}</output>
    </>
  );
}

function renderHarness(kind: "primary" | "destructive" = "primary") {
  return render(
    <ConfirmActionProvider>
      <Harness kind={kind} />
    </ConfirmActionProvider>,
  );
}

describe("ConfirmAction", () => {
  it("resolves true when the action is confirmed", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("confirmed")).toBeInTheDocument();
  });

  it("resolves false when cancelled", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(await screen.findByText("cancelled")).toBeInTheDocument();
  });

  it("resolves false when dismissed with Escape", async () => {
    const user = userEvent.setup();
    renderHarness();

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    await user.keyboard("{Escape}");

    expect(await screen.findByText("cancelled")).toBeInTheDocument();
  });

  it("uses destructive button styling for destructive actions", async () => {
    const user = userEvent.setup();
    renderHarness("destructive");

    await user.click(screen.getByRole("button", { name: "Open confirm" }));

    expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute("data-variant", "destructive");
  });

  it("has no axe violations in open state", async () => {
    const user = userEvent.setup();
    const { container } = renderHarness();

    await user.click(screen.getByRole("button", { name: "Open confirm" }));
    await waitFor(() => expect(screen.getByRole("alertdialog")).toBeInTheDocument());

    expect(await axe(container)).toHaveNoViolations();
  });
});
