/** Human-readable duration with an adaptive scale (m → h → d → weeks). */
export function formatDuration(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs === 0) return "0m";
  if (abs < 60) return `${abs}m`;

  const totalH = Math.floor(abs / 60);
  const remM = abs % 60;
  if (totalH < 24) return remM ? `${totalH}h ${remM}m` : `${totalH}h`;

  const totalD = Math.floor(totalH / 24);
  const remH = totalH % 24;
  if (totalD < 7) return remH ? `${totalD}d ${remH}h` : `${totalD}d`;

  const weeks = Math.floor(totalD / 7);
  const remD = totalD % 7;
  return remD ? `${weeks}sem ${remD}d` : `${weeks}sem`;
}
