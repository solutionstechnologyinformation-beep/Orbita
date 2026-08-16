import { describe, expect, it } from "vitest";
import { getAuthFeedbackClass, getAuthStageClass } from "./SecureLoginModal";

describe("SecureLoginModal transition states", () => {
  it("maps the 2FA forward transition to the expected CSS classes", () => {
    expect(getAuthStageClass("2fa", "forward")).toBe(
      "secure-login-stage secure-login-stage-2fa secure-login-stage-forward",
    );
  });

  it("maps the return transition to credentials", () => {
    expect(getAuthStageClass("credentials", "backward")).toContain("secure-login-stage-backward");
    expect(getAuthStageClass("credentials", "backward")).toContain("secure-login-stage-credentials");
  });

  it("exposes distinct feedback states for loading, error and success", () => {
    expect(getAuthFeedbackClass("loading")).toBe("secure-login-feedback secure-login-feedback-loading");
    expect(getAuthFeedbackClass("error")).toBe("secure-login-feedback secure-login-feedback-error");
    expect(getAuthFeedbackClass("success")).toBe("secure-login-feedback secure-login-feedback-success");
  });
});
