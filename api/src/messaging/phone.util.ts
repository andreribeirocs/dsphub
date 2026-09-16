/**
 * Format a phone number to E.164 (+447700900123).
 * Numbers without a country code are assumed to be UK numbers.
 */
export function toE164(phoneNumber: string): string {
  let digits = phoneNumber.replace(/\D/g, "");

  if (digits.startsWith("0") && digits.length === 11) {
    digits = "44" + digits.substring(1);
  } else if (!digits.startsWith("44") && digits.length === 10) {
    digits = "44" + digits;
  }

  return `+${digits}`;
}
