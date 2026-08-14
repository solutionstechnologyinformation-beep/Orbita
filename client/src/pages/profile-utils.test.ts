import { describe, expect, it } from "vitest";
import { getProfileFormValues } from "./profile-utils";

describe("profile form values", () => {
  it("loads the current user name and company", () => {
    expect(getProfileFormValues({ name: "Ana Souza", company: "LS Solutions" })).toEqual({
      name: "Ana Souza",
      company: "LS Solutions",
    });
  });

  it("falls back to empty strings when auth.me is unavailable or fields are null", () => {
    expect(getProfileFormValues(null)).toEqual({ name: "", company: "" });
    expect(getProfileFormValues({ name: null, company: null })).toEqual({ name: "", company: "" });
  });
});
