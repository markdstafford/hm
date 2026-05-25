import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { ProfileList } from "./ProfileList";
import type { AiProviderConfig } from "../../../aiProviders/types";

beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).PointerEvent = window.MouseEvent;
});

const CONFIG: AiProviderConfig = {
  version: 1,
  credentials: [{
    name: "k",
    kind: "ApiKey",
    source: { type: "Keychain", key_ref: "ai.credentials.k" },
  }],
  endpoints: [{
    name: "e",
    protocol: "AnthropicMessages",
    base_url: "https://api.example.com",
    credential_ref: "k",
  }],
  profiles: [{
    name: "p",
    endpoint_ref: "e",
    model: "claude-x",
    runner: "AnthropicMessages",
    execution_mode: "DirectApi",
    settings: { effort: "medium" },
  }],
  routing: { "question.answer": "p" },
};

describe("ProfileList", () => {
  it("renders empty state when there are no profiles", async () => {
    const empty: AiProviderConfig = { ...CONFIG, profiles: [], routing: {} };
    const onAdd = vi.fn();
    render(
      <ProfileList
        config={empty}
        smokeState={{}}
        onAdd={onAdd}
        onEdit={() => {}}
        onTest={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText(/No AI profiles configured/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Add profile/ }));
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("renders one row per profile with routing badge", () => {
    render(
      <ProfileList
        config={CONFIG}
        smokeState={{}}
        onAdd={() => {}}
        onEdit={() => {}}
        onTest={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.getByText("p")).toBeInTheDocument();
    expect(screen.getByText("question.answer")).toBeInTheDocument();
  });

  it("invokes edit / test / remove callbacks", async () => {
    const onEdit = vi.fn();
    const onTest = vi.fn();
    const onRemove = vi.fn();
    render(
      <ProfileList
        config={CONFIG}
        smokeState={{}}
        onAdd={() => {}}
        onEdit={onEdit}
        onTest={onTest}
        onRemove={onRemove}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Edit profile/ }));
    expect(onEdit).toHaveBeenCalledWith("p");
    await userEvent.click(screen.getByRole("button", { name: /Test connection/ }));
    expect(onTest).toHaveBeenCalledWith("p");
    await userEvent.click(screen.getByRole("button", { name: /Remove profile/ }));
    expect(onRemove).toHaveBeenCalledWith("p");
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <ProfileList
        config={CONFIG}
        smokeState={{}}
        onAdd={() => {}}
        onEdit={() => {}}
        onTest={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
