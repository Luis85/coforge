import type { ObsClient } from "./obs-client";
import { IntegrationFailure } from "../../features/coforge/domain/integration-failure";
const REQUIRED = [
  "GetSceneList",
  "GetStreamStatus",
  "SetCurrentProgramScene",
  "StartStream",
  "StopStream",
];
/** Capability leases belong to the current socket; a restarted OBS cannot inherit the prior server's features. */
export class ObsCapabilities {
  readonly available = new Set<string>();
  private loadedEpoch = -1;
  private pending: { epoch: number; value: Promise<void> } | undefined;
  reset(): void {
    this.loadedEpoch = -1;
    this.available.clear();
  }
  load(client: ObsClient): Promise<void> {
    const epoch = client.epoch;
    if (this.loadedEpoch === epoch && this.available.size)
      return Promise.resolve();
    if (this.pending?.epoch === epoch) return this.pending.value;
    const value = (async () => {
      const response = await client.request("GetVersion");
      const available = response.availableRequests;
      if (!client.connected || client.epoch !== epoch)
        throw new IntegrationFailure(
          "service",
          "The OBS connection changed during capability checks.",
        );
      if (
        !Array.isArray(available) ||
        available.length > 5000 ||
        REQUIRED.some((type) => !available.includes(type))
      )
        throw new IntegrationFailure(
          "validation",
          "This OBS server does not provide the required v5 stream controls.",
        );
      this.available.clear();
      for (const type of available)
        if (typeof type === "string") this.available.add(type);
      this.loadedEpoch = epoch;
    })().finally(() => {
      if (this.pending?.epoch === epoch) this.pending = undefined;
    });
    this.pending = { epoch, value };
    return value;
  }
}
