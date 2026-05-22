import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import App from "./App";

// Mock the Tauri internals so commands.appStatus() doesn't throw in jsdom
vi.mock("./bindings", () => ({
  commands: {
    appStatus: vi.fn().mockResolvedValue({ version: "0.1.0", ready: true }),
  },
}));

describe("App", () => {
  it("renders hello hm heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /hello hm/i })).toBeInTheDocument();
  });

  it("renders open settings button", () => {
    render(<App />);
    expect(
      screen.getByRole("button", { name: /open settings/i })
    ).toBeInTheDocument();
  });

  it("has no accessibility violations on initial render", async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
