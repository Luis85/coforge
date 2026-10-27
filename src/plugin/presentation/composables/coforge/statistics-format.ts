export const statisticNumber = (value: number | null | undefined, decimals = 0) =>
  value === null || value === undefined ? 'Unavailable' : value.toLocaleString(undefined, { maximumFractionDigits: decimals });
export const streamDate = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const elapsedTime = (minutes: number) => {
  const seconds = Math.max(0, Math.round(minutes * 60));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
