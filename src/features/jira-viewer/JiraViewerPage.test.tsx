import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { JiraViewerPage } from "./JiraViewerPage";

describe("JiraViewerPage", () => {
  it("renders breadcrumb and empty list state", () => {
    render(<>{JiraViewerPage.titleBar} {JiraViewerPage.content}</>);
    expect(screen.getByText("Jira viewer")).toBeInTheDocument();
    expect(screen.getByText(/No issues yet/i)).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(<>{JiraViewerPage.titleBar} {JiraViewerPage.content}</>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
