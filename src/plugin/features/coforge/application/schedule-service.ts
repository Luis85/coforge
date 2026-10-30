import { scheduledStream } from "../domain/schedule";
import type {
  ScheduleActions,
  SchedulePreparation,
  ScheduleStep,
  ScheduleStorage,
} from "./schedule-ports";
import type { StudioStore } from "./studio-store";
import { recordOperation } from "./population";
/** Plans are passive notes. Each external preparation step requires a reviewed, current revision. */
export class ScheduleService implements ScheduleActions {
  private busy = false;
  constructor(
    private readonly storage: ScheduleStorage,
    private readonly prepare: SchedulePreparation,
    private readonly store: StudioStore,
  ) {}
  list() {
    return this.storage.list();
  }
  async save(input: unknown, expected: string | null) {
    const note = await this.storage.save(scheduledStream(input), expected);
    await this.store.transaction((state) =>
      recordOperation(
        state,
        "schedule-saved",
        "committed",
        undefined,
        1,
        note.plan.id,
      ),
    );
    return note;
  }
  async open(id: string): Promise<void> {
    await this.storage.open(id);
    await this.store.transaction((state) =>
      recordOperation(
        state,
        "schedule-note-opened",
        "committed",
        undefined,
        1,
        id,
      ),
    );
  }
  async apply(id: string, expected: string, step: ScheduleStep): Promise<void> {
    if (this.busy)
      throw new Error("Finish the current preparation step first.");
    this.busy = true;
    try {
      const note = (await this.storage.list()).find(
        (note) => note.plan.id === id,
      );
      if (!note || note.revision !== expected)
        throw new Error(
          "The plan changed. Refresh and review its settings before applying them.",
        );
      if (note.plan.status !== "planned")
        throw new Error("Only planned streams can be prepared.");
      if (
        !this.store
          .internalSnapshot()
          .projects.some(
            (project) =>
              project.id === note.plan.projectId && !project.unavailable,
          )
      )
        throw new Error(
          "Choose an available project before preparing this stream.",
        );
      await this.prepare[step](note.plan);
      const codes = {
        project: "schedule-project-applied",
        channel: "schedule-channel-applied",
        scenes: "schedule-scenes-applied",
        music: "schedule-music-prepared",
      } as const;
      await this.store.transaction((state) =>
        recordOperation(state, codes[step], "committed", undefined, 1, id),
      );
    } finally {
      this.busy = false;
    }
  }
}
