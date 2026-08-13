import { describe, expect, it } from "vitest";
import { FLOATING_AGENT_TRANSITION, getFloatingAgentPlacement } from "../client/src/components/agent-transition";

describe("Orbita AI sidebar transition", () => {
  it("places the agent above the sidebar profile when compact", () => {
    expect(getFloatingAgentPlacement(true)).toEqual({ left: "1rem", bottom: "5.5rem" });
  });

  it("places the agent in the lower-right corner when expanded", () => {
    expect(getFloatingAgentPlacement(false)).toEqual({ left: "calc(100vw - 4.75rem)", bottom: "1.25rem" });
  });

  it("animates only the position properties during mode changes", () => {
    expect(FLOATING_AGENT_TRANSITION).toBe("left,bottom");
  });
});
