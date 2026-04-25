export type EmailDeliveryMode = "resend" | "log-only";

export function parseEmailDeliveryMode(
  value: string | null | undefined,
): EmailDeliveryMode | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "resend") {
    return "resend";
  }
  if (normalized === "log-only") {
    return "log-only";
  }
  return null;
}
