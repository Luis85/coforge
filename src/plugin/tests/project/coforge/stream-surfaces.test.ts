import { describe, expect, it } from "vitest";
import { streamSurfaceSnapshot } from "../../../features/coforge/domain/stream-surfaces";
import { createSeed } from "../../../features/coforge/domain/seed";
import { PublicStreamSource } from '../../../features/coforge/application/stream-surface-source';
import { emptyStore } from './memory-storage';
describe("stream-safe presentation contract", () => {
  it('pins the public board and gives subscribers only a frozen read-only capability', async () => {
    const { store } = await emptyStore(); const id = store.snapshot().activeProjectId!;
    const source = new PublicStreamSource(store, id); source.start(); const port = source.asPort();
    expect(Object.keys(port).sort()).toEqual(['snapshot', 'subscribe']); expect(Object.isFrozen(port)).toBe(true);
    const original = port.snapshot().board.project; let updates = 0; port.subscribe(() => { updates++; });
    await store.transaction(state => { const project = state.projects[0]!; state.projects.push({ ...structuredClone(project), id: 'CFP-002', settings: { ...project.settings, projectName: 'PRIVATE_OTHER_PROJECT' } }); state.activeProjectId = 'CFP-002'; state.settings = state.projects[1]!.settings; });
    expect(port.snapshot().board.project).toBe(original); expect(JSON.stringify(port.snapshot())).not.toContain('PRIVATE_OTHER_PROJECT');
    source.dispose(); const before = updates; await store.transaction(state => { state.settings.projectName = 'Another private edit'; }); expect(updates).toBe(before);
  });
  it("whitelists screened requests and live channel chat without private runtime, account or CRM data", () => {
    const state = createSeed();
    const at = new Date().toISOString();
    state.settings.projectBrief = "PRIVATE_PROJECT_BRIEF";
    state.settings.agentPrompt = "PRIVATE_AGENT_PROMPT";
    state.runtime = {
      ...state.runtime,
      projectPath: "C:/PRIVATE_PATH",
      twitch: {
        phase: "connected",
        message: "PRIVATE_CONNECTION_DETAIL",
        canChat: true,
        canManage: true,
        canModerate: true,
      },
    };
    state.ideas.find((idea) => idea.id === "CF-107")!.description =
      "PRIVATE_UNSCREENED";
    state.chat = [
      {
        id: "PRIVATE_INTERNAL_ID",
        userId: "twitch:PRIVATE_ACCOUNT_ID",
        username: "Public viewer",
        text: "**Live Twitch message**",
        createdAt: at,
        kind: "message",
        source: "twitch",
        twitchChannelId: "channel",
      },
      {
        id: "other",
        userId: "other",
        username: "Other",
        text: "PRIVATE_OTHER_CHANNEL",
        createdAt: at,
        kind: "message",
        source: "twitch",
        twitchChannelId: "other-channel",
      },
      {
        id: "local",
        userId: "simulator:local",
        username: "Local",
        text: "PRIVATE_SIMULATION",
        createdAt: at,
        kind: "message",
        source: "simulator",
      },
      {
        id: "system",
        userId: "system:coforge",
        username: "CoForge",
        text: "PRIVATE_DIAGNOSTIC",
        createdAt: at,
        kind: "error",
        source: "twitch",
        twitchChannelId: "channel",
      },
    ];
    const snapshot = streamSurfaceSnapshot(state, {
      channelId: "channel",
      liveSince: 0,
    });
    expect(snapshot.chat.messages).toMatchObject([
      { name: "Public viewer", text: "**Live Twitch message**" },
    ]);
    expect(JSON.stringify(snapshot)).not.toContain("PRIVATE_");
    expect(
      snapshot.board.columns
        .flatMap((column) => column.ideas)
        .map((idea) => idea.id),
    ).not.toContain("CF-107");
    state.runtime.twitch!.phase = "reconnecting";
    expect(
      streamSurfaceSnapshot(state, { channelId: "channel", liveSince: 0 }).chat
        .messages,
    ).toEqual([]);
    state.runtime.twitch!.phase = "connected";
    expect(
      streamSurfaceSnapshot(state, {
        channelId: "channel",
        liveSince: Date.now() + 60000,
      }).chat.messages,
    ).toEqual([]);
  });
});
