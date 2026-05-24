import { describe, expect, it } from "vitest";
import { normalizeJiraServerUrl, validateJiraDraft, containsSecretShapedKey } from "./validation";
import { newJiraSourceDraft } from "./defaults";

describe("source validation", () => {
  it("normalizes Jira URLs and permits localhost http only", () => {
    expect(normalizeJiraServerUrl(" https://jira.example.com/ ")).toBe("https://jira.example.com");
    expect(normalizeJiraServerUrl("http://localhost:2990/jira/")).toBe("http://localhost:2990/jira");
    expect(() => normalizeJiraServerUrl("http://jira.example.com")).toThrow(/https/i);
  });

  it("requires PAT for new Jira source and not for edit", () => {
    const draft = newJiraSourceDraft();
    expect(validateJiraDraft(draft, "", "new")).toContain("Personal access token is required.");
    expect(validateJiraDraft(draft, "", "edit")).not.toContain("Personal access token is required.");
  });

  it("detects secret-shaped metadata keys", () => {
    expect(containsSecretShapedKey({ token: "bad" })).toBe(true);
    expect(containsSecretShapedKey({ auth: { credential_ref: "source.jira.src_a.pat" } })).toBe(false);
  });
});
