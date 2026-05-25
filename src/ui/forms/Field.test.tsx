import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Field } from "./Field";
import { TextField } from "./TextField";

describe("Field", () => {
  it("associates label with control via htmlFor", () => {
    render(
      <Field label="Email">
        {({ id }) => <TextField id={id} aria-label="Email" />}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input.id).toBeTruthy();
    expect(screen.getByText("Email").getAttribute("for")).toBe(input.id);
  });
  it("renders error text", () => {
    render(
      <Field label="Email" error="Required">
        {({ id }) => <TextField id={id} aria-label="Email" />}
      </Field>,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
  });
  it("associates help text via aria-describedby", () => {
    render(
      <Field label="Email" help="We never share.">
        {({ id, describedBy }) => (
          <TextField id={id} aria-describedby={describedBy} aria-label="Email" />
        )}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const help = screen.getByText("We never share.");
    expect(help.id).toBe(describedBy);
  });
  it("omits help id from aria-describedby when error suppresses help rendering", () => {
    render(
      <Field label="Email" help="We never share." error="Required">
        {({ id, describedBy }) => (
          <TextField id={id} aria-describedby={describedBy} aria-label="Email" />
        )}
      </Field>,
    );
    const input = screen.getByRole("textbox", { name: "Email" });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(screen.queryByText("We never share.")).toBeNull();
    for (const refId of describedBy!.split(" ")) {
      expect(document.getElementById(refId)).not.toBeNull();
    }
  });
  it("has no axe violations", async () => {
    const { container } = render(
      <Field label="Email" help="We never share.">
        {({ id, describedBy }) => (
          <TextField id={id} aria-describedby={describedBy} aria-label="Email" />
        )}
      </Field>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
