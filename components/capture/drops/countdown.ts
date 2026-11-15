const SECOND = 1000;
const MINUTE = 60;
const HOUR = 3600;

/** m:ss under an hour, h:mm:ss from an hour up. Rounds up so 0:00 appears only when the drop is over. */
export function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.ceil(remainingMs / SECOND));
  const hours = Math.floor(total / HOUR);
  const minutes = Math.floor((total % HOUR) / MINUTE);
  const seconds = total % MINUTE;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
