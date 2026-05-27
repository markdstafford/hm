import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SectionHeader } from "./SectionHeader";

describe("SectionHeader", () => {
  it("renders mixed-case label with real OpenType small-caps, count, and expanded chevron", () => {
    render(
      <SectionHeader
        bucketKey="doing"
        label="In progress"
        count={2}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
      />
    );

    const labelEl = screen.getByText("In progress");
    expect(labelEl).toHaveStyle({ fontVariantCaps: "all-small-caps" });
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse in progress/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows collapsed chevron and aria-expanded=false when collapsed", async () => {
    const user = userEvent.setup();
    const onToggleCollapsed = vi.fn();
    render(
      <SectionHeader
        bucketKey="done"
        label="Done"
        count={0}
        collapsed={true}
        onToggleCollapsed={onToggleCollapsed}
      />
    );

    const button = screen.getByRole("button", { name: /expand done/i });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await user.click(button);
    expect(onToggleCollapsed).toHaveBeenCalledWith("done");
  });
});
