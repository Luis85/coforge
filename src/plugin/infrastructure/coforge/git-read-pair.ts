/** Bound independent reads to two children and settle both before returning or failing. */
export async function settledReadPair<First, Second>(first: Promise<First>, second: Promise<Second>): Promise<[First, Second]> {
  const reads: [Promise<First>, Promise<Second>] = [first, second];
  const [left, right] = await Promise.allSettled(reads);
  if (left.status === 'rejected') throw left.reason;
  if (right.status === 'rejected') throw right.reason;
  return [left.value, right.value];
}
