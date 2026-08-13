export const FLOATING_AGENT_TRANSITION = "left,bottom,width" as const;

export function getFloatingAgentPlacement(compact: boolean, panelWidth = 400) {
  const safeWidth = Math.max(320, Math.round(panelWidth));
  return compact
    ? { left: "1rem", bottom: "5.5rem" }
    : { left: `calc(100vw - ${safeWidth + 20}px)`, bottom: "1.25rem" };
}
