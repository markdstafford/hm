import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { describe, it, expect, vi } from "vitest";
import { Form } from "./Form";

describe("Form", () => {
  it("submits via Enter on input fields without page reload", async () => {
    const onSubmit = vi.fn();
    render(
      <Form onSubmit={onSubmit} aria-label="My form">
        <input aria-label="Name" defaultValue="x" />
        <Form.Actions>
          <button type="submit">Save</button>
        </Form.Actions>
      </Form>,
    );
    await userEvent.type(screen.getByLabelText("Name"), "{Enter}");
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("renders a fieldset+legend for each Form.Section", () => {
    render(
      <Form onSubmit={() => {}} aria-label="My form">
        <Form.Section label="Connection">
          <span>contents</span>
        </Form.Section>
      </Form>,
    );
    const fieldset = screen.getByRole("group", { name: "Connection" });
    expect(fieldset).toBeInTheDocument();
    expect(fieldset.tagName.toLowerCase()).toBe("fieldset");
  });

  it("renders form-level error with alert role", () => {
    render(
      <Form onSubmit={() => {}} aria-label="My form">
        <Form.Error>Save failed</Form.Error>
      </Form>,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Save failed");
  });

  it("Form.Actions renders its children in a right-aligned bar", () => {
    render(
      <Form onSubmit={() => {}} aria-label="My form">
        <Form.Actions>
          <button>Cancel</button>
          <button type="submit">Save</button>
        </Form.Actions>
      </Form>,
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <Form onSubmit={() => {}} aria-label="My form">
        <Form.Section label="S"><span>x</span></Form.Section>
        <Form.Actions><button type="submit">Save</button></Form.Actions>
      </Form>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
