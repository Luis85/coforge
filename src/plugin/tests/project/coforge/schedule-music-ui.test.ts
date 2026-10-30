// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { expect, it, vi } from "vitest";
import ScheduleView from "../../../presentation/components/coforge/ScheduleView.vue";
import { scheduleDraft } from "../../../presentation/stores/coforge-schedule";
import {
  scheduledStream,
  type ScheduleNote,
} from "../../../features/coforge/domain/schedule";
import { workflowUiFixture } from "./workflow-ui-fixture";
import type { ObsProductionSnapshot } from "../../../features/coforge/domain/obs-production";

it("saves OBS music assignments without playback and requires saved review before explicit preparation", async () => {
  const fixture = await workflowUiFixture();
  const at = new Date().toISOString();
  const plan = {
    ...scheduleDraft(),
    name: "Music broadcast",
    startsAt: at,
    projectId: fixture.project.id,
    liveSceneId: "live",
    breakSceneId: "brb",
  };
  let note: ScheduleNote = {
    plan,
    body: "Private script",
    revision: "initial",
  };
  const save = vi.fn(async (input: unknown) => {
    note = { ...note, plan: scheduledStream(input), revision: "saved" };
    return structuredClone(note);
  });
  const apply = vi.fn(async () => {});
  fixture.context.host.schedule = {
    list: async () => [structuredClone(note)],
    save,
    apply,
    open: async () => {},
  };
  const snapshot: ObsProductionSnapshot = {
    context: { epoch: 1, collection: 0, revision: 0 },
    observedAt: at,
    broadcast: {
      epoch: 1,
      revision: 1,
      programSceneId: "live",
      active: false,
      reconnecting: false,
      transitioning: false,
      timecode: "",
      observedAt: at,
      scenes: [
        { id: "live", name: "Live" },
        { id: "brb", name: "BRB" },
      ],
    },
    available: ["media-action"],
    inputKinds: [],
    filterKinds: [],
    studioMode: false,
    transitions: [],
    transition: null,
    recording: null,
    replayBuffer: null,
    virtualCamera: null,
    video: null,
    recordDirectory: null,
    lastRecording: null,
    lastReplay: null,
    inputs: ["music", "break", "camera"].map((id) => ({
      id,
      name: id,
      kind: id === "camera" ? "dshow_input" : "ffmpeg_source",
      settings: {},
      audio: {
        muted: false,
        volumeDb: -18,
        monitor: null,
        syncOffset: null,
        tracks: null,
        peakDb: null,
        meterObservedAt: null,
      },
    })),
  };
  await fixture.studio.store.updateRuntime({ obsProduction: snapshot });
  const wrapper = mount(ScheduleView, {
    global: { plugins: [fixture.pinia, fixture.provider] },
  });
  try {
    await flushPromises();
    await wrapper.get(".cf-schedule-item").trigger("click");
    const music = wrapper.get('[aria-label="Planned OBS music"]');
    const choices = music.findAll("select");
    expect(choices[0]?.text()).not.toContain("camera");
    await choices[0]!.setValue("music");
    await choices[1]!.setValue("break");
    expect(apply).not.toHaveBeenCalled();
    await wrapper
      .get('form[aria-label="Stream plan settings"]')
      .trigger("submit");
    await flushPromises();
    expect(note.plan.music).toEqual({
      liveInputId: "music",
      breakInputId: "break",
    });
    expect(apply).not.toHaveBeenCalled();
    const review = wrapper
      .findAll("button")
      .find((button) => button.text() === "Review saved preparation");
    if (!review) throw new Error("Missing preparation review");
    await review.trigger("click");
    const prepare = wrapper
      .findAll("button")
      .find((button) => button.text() === "Apply music");
    if (!prepare) throw new Error("Missing music preparation");
    await prepare.trigger("click");
    await flushPromises();
    expect(apply).toHaveBeenCalledWith(plan.id, "saved", "music");
    expect(wrapper.find(".cf-music").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Playlist");
  } finally {
    wrapper.unmount();
    await fixture.dispose();
  }
});
