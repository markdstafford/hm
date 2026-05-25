import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, it, expect } from "vitest";
import { SettingRow } from "./SettingRow";

describe("SettingRow", () => {
  it("renders label, description, and the control slot", () => {
    render(
      <SettingRow label="Theme" description="Light or dark.">
        <button>control</button>
      </SettingRow>,
    );
    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText("Light or dark.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "control" })).toBeInTheDocument();
  });

  it("renders without a description", () => {
    render(<SettingRow label="Bare"><span>x</span></SettingRow>);
    expect(screen.getByText("Bare")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <SettingRow label="A" description="B"><button>c</button></SettingRow>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
