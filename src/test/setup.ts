import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// jsdom does not implement window.matchMedia; provide a minimal stub
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
