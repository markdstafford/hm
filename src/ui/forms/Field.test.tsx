import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Field } from "./Field";
import { TextField } from "./TextField";

describe("Field", () => {
  it("associates label with control via htmlFor", () => {
    render(
      <Field label="Email">
        {(id) => <TextField id={id} aria-label="Email" />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.id).toBeTruthy();
    expect(screen.getByText("Email").getAttribute("for")).toBe(input.id);
  });
  it("renders error text", () => {
    render(
      <Field label="Email" error="Required">
        {(id) => <TextField id={id} aria-label="Email" />}
      </Field>,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <Field label="Email" help="We never share.">
        {(id) => <TextField id={id} aria-label="Email" />}
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
