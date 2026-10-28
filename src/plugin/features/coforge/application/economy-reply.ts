/** Twitch replies are limited to 500 Unicode code points; catalog pages reserve 150 for settlement. */
export const compactEconomyLabel = (value: string, limit = 20): string => {
  const points = [...value];
  return points.length <= limit
    ? value
    : points.slice(0, limit - 1).join("") + "…";
};
export function economyRowPages(
  rows: readonly string[],
  budget: number,
): string[][] {
  const pages: string[][] = [];
  let page: string[] = [];
  let size = 0;
  for (const row of rows) {
    const length = [...row].length;
    if (length > budget)
      throw new Error("An Economy catalog row exceeds its reply allowance.");
    if (page.length && size + length + 3 > budget) {
      pages.push(page);
      page = [];
      size = 0;
    }
    page.push(row);
    size += length + (page.length > 1 ? 3 : 0);
  }
  if (page.length) pages.push(page);
  return pages.length ? pages : [[]];
}

export function economySettledReply(
  message: string,
  summary: string,
  outcomes: readonly { id: string; name: string }[],
): string {
  const allowance = 500 - [...summary].length - 1;
  const base =
    [...message].length <= allowance
      ? message
      : compactEconomyLabel(message, allowance - 25) +
        " [Full receipt: streamer]";
  let reply = `${base} ${summary}`;
  for (let index = 0; index < outcomes.length; index++) {
    const outcome = outcomes[index]!;
    const detail = ` Won ${outcome.id} (${compactEconomyLabel(outcome.name, 20)}).`;
    const remaining = outcomes.length - index - 1;
    const more = remaining
      ? ` ${remaining} more outcomes in streamer receipt.`
      : "";
    if ([...(reply + detail + more)].length > 500) break;
    reply += detail;
  }
  return reply;
}
