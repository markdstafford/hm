import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useShortcut } from "./useShortcut";

function Probe(props: { binding: string | string[]; onFire: () => void; allowInForm?: boolean }) {
  useShortcut(props.binding, props.onFire, { allowInForm: props.allowInForm });
  return <input data-testid="field" />;
}

describe("useShortcut", () => {
  it("fires on a single key", async () => {
    const onFire = vi.fn();
    render(<Probe binding="[" onFire={onFire} />);
    const ev = new KeyboardEvent("keydown", { key: "[", bubbles: true });
    act(() => { window.dispatchEvent(ev); });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("fires on a modifier combo", async () => {
    const onFire = vi.fn();
    render(<Probe binding="⌘+shift+d" onFire={onFire} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", metaKey: true, shiftKey: true, bubbles: true }));
    });
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it("fires on a sequence", async () => {
    vi.useFakeTimers();
    const onFire = vi.fn();
    render(<Probe binding={["g", "i"]} onFire={onFire} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
    });
    expect(onFire).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("resets sequence after timeout", async () => {
    vi.useFakeTimers();
    const onFire = vi.fn();
    render(<Probe binding={["g", "i"]} onFire={onFire} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", bubbles: true }));
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "i", bubbles: true }));
    });
    expect(onFire).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("ignores keys when focus is in a form field", async () => {
    const onFire = vi.fn();
    const { getByTestId } = render(<Probe binding="[" onFire={onFire} />);
    const field = getByTestId("field") as HTMLInputElement;
    field.focus();
    const ev = new KeyboardEvent("keydown", { key: "[", bubbles: true });
    Object.defineProperty(ev, "target", { value: field });
    act(() => { window.dispatchEvent(ev); });
    expect(onFire).not.toHaveBeenCalled();
  });

  it("fires inside form field when allowInForm = true", async () => {
    const onFire = vi.fn();
    const { getByTestId } = render(<Probe binding="[" onFire={onFire} allowInForm />);
    const field = getByTestId("field") as HTMLInputElement;
    field.focus();
    const ev = new KeyboardEvent("keydown", { key: "[", bubbles: true });
    Object.defineProperty(ev, "target", { value: field });
    act(() => { window.dispatchEvent(ev); });
    expect(onFire).toHaveBeenCalled();
  });
});
