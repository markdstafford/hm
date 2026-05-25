import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders a toast with title", () => {
    render(
      <Toast.Provider>
        <Toast.Root open>
          <Toast.Title>Saved</Toast.Title>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>,
    );
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<Toast.Provider><Toast.Viewport /></Toast.Provider>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
