import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReRootBanner } from "./ReRootBanner";

describe("ReRootBanner", () => {
  it("names the active scoped collection and exposes a return action", () => {
    const onBack = vi.fn();
    render(
      <ReRootBanner
        label="Related to AMP-1087"
        totalCount={8}
        matchingCount={3}
        backLabel="Back to All open"
        onBack={onBack}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Related to AMP-1087");
    expect(screen.getByText("3 matching of 8 related items")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to All open" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("uses total count copy when filters do not hide items", () => {
    render(<ReRootBanner label="Related" totalCount={2} matchingCount={2} backLabel="Back to All open" onBack={vi.fn()} />);
    expect(screen.getByText("2 related items")).toBeInTheDocument();
  });
});
