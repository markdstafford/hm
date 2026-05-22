import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import App from "./App";

vi.mock("./bindings", () => ({
  commands: {
    appStatus: vi.fn().mockResolvedValue({ version: "0.1.0", ready: true }),
    preferencesRead: vi.fn().mockResolvedValue({ status: "ok", data: {} }),
    preferencesWrite: vi.fn().mockResolvedValue({ status: "ok", data: null }),
  },
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(() => ({
    setSize: vi.fn(),
    setPosition: vi.fn(),
    innerSize: vi.fn().mockResolvedValue({ width: 1200, height: 800 }),
    outerPosition: vi.fn().mockResolvedValue({ x: 100, y: 100 }),
    listen: vi.fn().mockResolvedValue(() => {}),
  })),
  LogicalSize: vi.fn(),
  LogicalPosition: vi.fn(),
}));

describe("App", () => {
  it("renders hello hm heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /hello hm/i })).toBeInTheDocument();
  });

  it("renders the settings opener button", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /open settings/i })).toBeInTheDocument();
  });

  it("opens the settings panel when opener is clicked", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /open settings/i }));
    expect(screen.getByRole("dialog", { name: /settings/i })).toBeInTheDocument();
  });

  it("has no accessibility violations on initial render", async () => {
    const { container } = render(<App />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
