const HUES = [0, 45, 90, 135, 180, 225, 270, 315];

export function addressToSpriteColor(address: string): string {
  const index = parseInt(address.slice(2, 4), 16) % 8;
  return `hsl(${HUES[index]}, 70%, 60%)`;
}

export function statusToAnimation(status?: string): string {
  if (status === "active") return "anim-work";
  return "anim-idle";
}

export function statusToColor(status?: string): string {
  if (status === "active") return "var(--success)";
  if (status === "idle") return "var(--warning)";
  return "var(--muted-foreground)";
}

export function statusToActionText(status?: string, action?: string): string {
  if (status === "active" && action) return `Calling ${action}...`;
  if (status === "registered") return "Standing by";
  return "Wandering around...";
}
