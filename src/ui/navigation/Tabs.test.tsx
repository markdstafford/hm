import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Tabs } from "./Tabs";

describe("Tabs", () => {
  it("shows the active panel", () => {
    render(
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="Sections">
          <Tabs.Trigger value="a">A</Tabs.Trigger>
          <Tabs.Trigger value="b">B</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Panel A</Tabs.Content>
        <Tabs.Content value="b">Panel B</Tabs.Content>
      </Tabs.Root>,
    );
    expect(screen.getByText("Panel A")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <Tabs.Root defaultValue="a">
        <Tabs.List aria-label="Sections"><Tabs.Trigger value="a">A</Tabs.Trigger></Tabs.List>
        <Tabs.Content value="a">A</Tabs.Content>
      </Tabs.Root>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
