import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { vi, beforeAll, beforeEach, describe, it, expect } from "vitest";
import { SettingsPanel } from "./SettingsPanel";
import type { AppPreferences } from "../preferences";
import { EMPTY_STATES } from "../aiProviders/defaults";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
  if (!window.HTMLElement.prototype.hasPointerCapture) {
    window.HTMLElement.prototype.hasPointerCapture = () => false;
  }
  if (!window.HTMLElement.prototype.releasePointerCapture) {
    window.HTMLElement.prototype.releasePointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.setPointerCapture) {
    window.HTMLElement.prototype.setPointerCapture = () => {};
  }
  if (!window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }
  // Pretend we are inside Tauri so storage wrappers call the mocked commands.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__TAURI_INTERNALS__ = {};
});

vi.mock("../bindings", () => ({
  commands: {
    aiProviderConfigGet: vi.fn().mockResolvedValue({
      status: "ok",
      data: { version: 1, credentials: [], endpoints: [], profiles: [], routing: {} },
    }),
    aiProviderConfigSave: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretSet: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiCredentialSecretDelete: vi.fn().mockResolvedValue({ status: "ok", data: null }),
    aiProfileSmokeTest: vi.fn().mockResolvedValue({
      status: "ok",
      data: {
        status: "Success",
        profile: "test-profile",
        runner: "OpenAiChatCompletions",
        execution_mode: "DirectApi",
        model: "gpt-test",
        elapsed_ms: 100,
        preview: "ok",
        error: null,
        suggested_fix: null,
      },
    }),
  },
}));

const defaultPrefs: AppPreferences = {
  appearance: {
    themeMode: "system",
    lightTheme: "catppuccin-latte",
    darkTheme: "catppuccin-macchiato",
    themeFeatures: { catppuccin: { accent: "sapphire" } },
    uiFont: "Inter Variable",
    monoFont: "Fira Code",
  },
};

function renderPanel(props?: Partial<Parameters<typeof SettingsPanel>[0]>) {
  const onClose = vi.fn();
  const onUpdatePreferences = vi.fn().mockResolvedValue(undefined);
  const result = render(
    <SettingsPanel
      open={true}
      onClose={onClose}
      prefs={defaultPrefs}
      onUpdatePreferences={onUpdatePreferences}
      prefersDark={false}
      {...props}
    />
  );
  return { ...result, onClose, onUpdatePreferences };
}

async function openAiProviders(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^ai providers$/i }));
  await screen.findByRole("heading", { name: /^ai providers$/i });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AI providers settings tab", () => {
  it("sidebar has AI providers button", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /^ai providers$/i })).toBeInTheDocument();
  });

  it("AI providers is not the default active tab", () => {
    renderPanel();
    const btn = screen.getByRole("button", { name: /^ai providers$/i });
    expect(btn).not.toHaveAttribute("aria-current", "page");
  });

  it("clicking AI providers shows the heading", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    expect(screen.getByRole("heading", { name: /^ai providers$/i })).toBeInTheDocument();
  });

  it("shows the description text", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    expect(screen.getByText(/configure credentials/i)).toBeInTheDocument();
  });

  it("shows empty state for credentials", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    expect(await screen.findByText(EMPTY_STATES.credentials)).toBeInTheDocument();
  });

  it("shows empty state for endpoints", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    expect(await screen.findByText(EMPTY_STATES.endpoints)).toBeInTheDocument();
  });

  it("shows empty state for profiles", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    expect(await screen.findByText(EMPTY_STATES.profiles)).toBeInTheDocument();
  });

  it("shows empty state for routing", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    expect(await screen.findByText(EMPTY_STATES.routing)).toBeInTheDocument();
  });

  it("has no accessibility violations on empty AI providers tab", async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();
    await openAiProviders(user);
    // Wait for empty states to ensure load completed.
    await screen.findByText(EMPTY_STATES.routing);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("General tab still works after switching", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    await user.click(screen.getByRole("button", { name: /^general$/i }));
    expect(screen.getByRole("heading", { name: /^general$/i })).toBeInTheDocument();
  });

  it("renders Add credential form fields", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    // Wait for content
    await screen.findByText(EMPTY_STATES.credentials);
    // Form labels
    expect(screen.getByRole("button", { name: /add credential/i })).toBeInTheDocument();
  });

  it("smoke test button runs and shows success", async () => {
    const user = userEvent.setup();
    renderPanel();
    await openAiProviders(user);
    await screen.findByText(EMPTY_STATES.credentials);

    // Add a credential
    const credNameInputs = screen.getAllByRole("textbox");
    // First textbox is credential name
    await user.type(credNameInputs[0], "cred1");
    await user.click(screen.getByRole("button", { name: /add credential/i }));

    // Wait for credential row to appear (the heading row, exact match)
    await waitFor(() => {
      expect(screen.getAllByText("cred1").length).toBeGreaterThan(0);
    });

    // Find textbox by associated label for unambiguous targeting.
    // After adding credential, the Add-credential form's Name input is empty.
    // The Endpoint form's Name input is also empty. Use the endpoint form's "Base URL" label.
    const baseUrlInput = screen.getByLabelText(/base url/i);
    await user.type(baseUrlInput, "https://example.com");

    // Endpoint Name is the first textbox in endpoint form. Find it by its containing form.
    // Simpler: directly target via querySelector inside the endpoint section heading.
    const endpointHeading = screen.getByRole("heading", { name: /^endpoints$/i });
    const endpointSection = endpointHeading.closest("section") as HTMLElement;
    const endpointNameInput = endpointSection.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    await user.type(endpointNameInput, "ep1");

    const credSelect = screen.getByLabelText(/^credential$/i);
    await user.selectOptions(credSelect, "cred1");
    await user.click(screen.getByRole("button", { name: /add endpoint/i }));

    await waitFor(() => {
      expect(screen.getAllByText("ep1").length).toBeGreaterThan(0);
    });

    // Add a profile
    const profileHeading = screen.getByRole("heading", { name: /^profiles$/i });
    const profileSection = profileHeading.closest("section") as HTMLElement;
    const profileNameInput = profileSection.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement;
    await user.type(profileNameInput, "prof1");
    const endpointSelect = screen.getByLabelText(/^endpoint$/i);
    await user.selectOptions(endpointSelect, "ep1");
    const modelInput = screen.getByLabelText(/^model$/i);
    await user.type(modelInput, "gpt-test");
    await user.click(screen.getByRole("button", { name: /add profile/i }));

    await waitFor(() => {
      expect(screen.getAllByText("prof1").length).toBeGreaterThan(0);
    });

    // Click smoke test
    await user.click(screen.getByRole("button", { name: /smoke test/i }));

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument();
    });
  });
});
