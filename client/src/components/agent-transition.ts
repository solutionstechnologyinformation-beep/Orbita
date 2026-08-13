export const FLOATING_AGENT_TRANSITION = "left,bottom" as const;

export function getFloatingAgentPlacement(compact: boolean) {
  return compact
    ? { left: "1rem", bottom: "5.5rem" }
    : { left: "calc(100vw - 4.75rem)", bottom: "1.25rem" };
}
