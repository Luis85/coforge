import { createHash, randomInt } from "node:crypto";
import type { Plugin } from "obsidian";
import type { Check } from "../../features/coforge/domain/check";
import { text } from "../../features/coforge/domain/check";
import { protectPrivateData } from "./private-data-guard";

const eventCheck = text({ min: 1, max: 2000 });
const inputCheck = text({ min: 1, max: 100000 });
const recovery = () =>
  new Error(
    "An Economy draw reservation needs recovery. Preserve the private coforge-economy-reservations records and restore valid evidence before retrying; no new charge or reward was committed.",
  );
const key = (eventKey: string) =>
  createHash("sha256").update(eventKey).digest("hex");
export function secureEconomyInteger(maxExclusive: number): number {
  if (
    !Number.isSafeInteger(maxExclusive) ||
    maxExclusive < 1 ||
    maxExclusive >= 2 ** 48
  )
    throw new Error("The reward draw range is invalid.");
  return randomInt(maxExclusive);
}
/** Immutable per-event private receipts freeze secure draws independently of a rolled-back ledger commit. */
export class VaultEconomyReservations<
  T extends { eventKey: string; inputIdentity: string },
> {
  readonly directory: string;
  private tail: Promise<unknown> = Promise.resolve();
  private blocked = false;
  constructor(
    private readonly plugin: Plugin,
    private readonly check: Check<T>,
    private readonly draw = secureEconomyInteger,
  ) {
    const root =
      plugin.manifest.dir ??
      `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
    this.directory = `${root}/coforge-economy-reservations`;
  }
  assertReady(): void {
    if (this.blocked) throw recovery();
  }
  async validate(): Promise<void> {
    this.assertReady();
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(this.directory))) return;
    if ((await adapter.stat(this.directory))?.type !== "folder") {
      this.blocked = true;
      throw recovery();
    }
    try {
      for (const path of (await adapter.list(this.directory)).files) {
        if (!/\/[a-f0-9]{64}\.json$/u.test(path)) continue;
        const record = this.read(await adapter.read(path));
        if (path !== this.path(record.eventKey)) throw recovery();
      }
    } catch {
      this.blocked = true;
      throw recovery();
    }
  }
  private path(eventKey: string) {
    return `${this.directory}/${key(eventKey)}.json`;
  }
  private read(bytes: string): T {
    if (bytes.length > 10000000) throw recovery();
    return this.check(JSON.parse(bytes));
  }
  private async retained(
    path: string,
    eventKey: string,
    inputIdentity: string,
  ): Promise<T | undefined> {
    const adapter = this.plugin.app.vault.adapter;
    if (!(await adapter.exists(path))) return undefined;
    let record: T;
    try {
      record = this.read(await adapter.read(path));
    } catch {
      this.blocked = true;
      throw recovery();
    }
    if (record.eventKey !== eventKey || record.inputIdentity !== inputIdentity)
      throw new Error(
        "This command source identity was already reserved for different input. Its original outcome was preserved; do not reuse the message ID.",
      );
    return structuredClone(record);
  }
  reserve(
    event: string,
    input: string,
    prepare: (draw: (maxExclusive: number) => number) => T,
  ): Promise<T> {
    const eventKey = eventCheck(event);
    const inputIdentity = inputCheck(input);
    const work = this.tail.then(async () => {
      this.assertReady();
      const path = this.path(eventKey);
      const existing = await this.retained(path, eventKey, inputIdentity);
      if (existing) return existing;
      await protectPrivateData(this.plugin);
      const adapter = this.plugin.app.vault.adapter;
      if (!(await adapter.exists(this.directory)))
        await adapter.mkdir(this.directory);
      if ((await adapter.stat(this.directory))?.type !== "folder")
        throw recovery();
      const record = this.check(
        prepare((max) => {
          if (!Number.isSafeInteger(max) || max < 1 || max >= 2 ** 48)
            throw new Error("The reward draw range is invalid.");
          const value = this.draw(max);
          if (!Number.isSafeInteger(value) || value < 0 || value >= max)
            throw new Error("The reward draw was outside its captured range.");
          return value;
        }),
      );
      if (
        record.eventKey !== eventKey ||
        record.inputIdentity !== inputIdentity
      )
        throw new Error(
          "The prepared reward reservation does not match this command.",
        );
      const encoded = JSON.stringify(record);
      if (encoded.length > 10000000)
        throw new Error(
          "The captured reward reservation exceeds its storage allowance.",
        );
      // Another admitted use of this key must win unchanged; prepared values have granted nothing.
      const retained = await this.retained(path, eventKey, inputIdentity);
      if (retained) return retained;
      try {
        await adapter.write(path, encoded);
      } catch (error) {
        if (!(await adapter.exists(path))) throw error;
        if ((await adapter.read(path)) !== encoded) {
          this.blocked = true;
          throw recovery();
        }
      }
      if ((await adapter.read(path)) !== encoded) {
        this.blocked = true;
        throw recovery();
      }
      return structuredClone(record);
    });
    this.tail = work.catch(() => undefined);
    return work;
  }
}
