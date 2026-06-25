const bnDigits = ["০","১","২","৩","৪","৫","৬","৭","৮","৯"];
export const toBnDigits = (s: string | number) =>
  String(s).replace(/[0-9]/g, (d) => bnDigits[+d]);

export function bnRelative(target: Date | string): string {
  const t = typeof target === "string" ? new Date(target) : target;
  const diffMs = t.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const m = Math.floor(abs / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  let label: string;
  if (d > 0) label = `${toBnDigits(d)} দিন`;
  else if (h > 0) label = `${toBnDigits(h)} ঘণ্টা`;
  else if (m > 0) label = `${toBnDigits(m)} মিনিট`;
  else label = "এখনই";
  return past ? `${label} আগে` : `${label} বাকি`;
}

export function bnDate(target: Date | string): string {
  const t = typeof target === "string" ? new Date(target) : target;
  return toBnDigits(
    t.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  );
}

export function urgencyLevel(deadline: Date | string): "calm" | "warn" | "urgent" | "critical" {
  const t = typeof deadline === "string" ? new Date(deadline) : deadline;
  const hours = (t.getTime() - Date.now()) / 3600000;
  if (hours < 6) return "critical";
  if (hours < 24) return "urgent";
  if (hours < 72) return "warn";
  return "calm";
}
