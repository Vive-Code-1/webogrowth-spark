export const toBnDigits = (s: string | number) => String(s);

export function bnRelative(target: Date | string): string {
  const t = typeof target === "string" ? new Date(target) : target;
  const diffMs = t.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  let label: string;
  if (d > 0) label = `${d}d`;
  else if (h > 0) label = `${h}h`;
  else if (m > 0) label = `${m}m`;
  else label = "now";
  if (label === "now") return "now";
  return past ? `${label} ago` : `in ${label}`;
}

export function bnDate(target: Date | string): string {
  const t = typeof target === "string" ? new Date(target) : target;
  return t.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function urgencyLevel(deadline: Date | string): "calm" | "warn" | "urgent" | "critical" {
  const t = typeof deadline === "string" ? new Date(deadline) : deadline;
  const hours = (t.getTime() - Date.now()) / 3600000;
  if (hours < 6) return "critical";
  if (hours < 24) return "urgent";
  if (hours < 72) return "warn";
  return "calm";
}
