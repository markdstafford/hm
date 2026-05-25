import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { SettingsSidebar } from "./SettingsSidebar";

describe("SettingsSidebar", () => {
  it("renders all four categories", () => {
    render(<SettingsSidebar current="general" onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /General/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Appearance/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sources/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI providers/ })).toBeInTheDocument();
  });

  it("marks the current category with aria-current=page", () => {
    render(<SettingsSidebar current="appearance" onPick={() => {}} />);
    expect(screen.getByRole("button", { name: /Appearance/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: /General/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("calls onPick with the chosen category", async () => {
    const onPick = vi.fn();
    render(<SettingsSidebar current="general" onPick={onPick} />);
    await userEvent.click(screen.getByRole("button", { name: /Sources/ }));
    expect(onPick).toHaveBeenCalledWith("sources");
  });
});
