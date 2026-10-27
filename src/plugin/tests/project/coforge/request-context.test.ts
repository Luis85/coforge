import { describe, expect, it } from "vitest";
import { parseCommand } from "../../../features/coforge/domain/commands";
import { ingestChat } from "../../../features/coforge/application/chat";
import { seededStore, registerTestViewers } from "./memory-storage";
import { stageInput } from "../../../features/coforge/application/agent-prompts";
describe("viewer request context", () => {
  it("parses context, requires registration, appends across projects and returns the request to screening", async () => {
    expect(parseCommand("!context CF-101 **Use a controller**")).toEqual({
      type: "context",
      ideaId: "CF-101",
      text: "**Use a controller**",
    });
    const { store, storage } = await seededStore();
    const before = store.snapshot().ideas.find((idea) => idea.id === "CF-101")!;
    const message = {
      username: "Context viewer",
      text: "!context CF-101 **Use a controller**",
      source: "simulator" as const,
      messageId: "context-event",
    };
    expect(
      (await ingestChat(store, { ...message, messageId: "unregistered" })).ok,
    ).toBe(false);
    await registerTestViewers(store, [{ username: message.username }]);
    expect((await ingestChat(store, message)).ok).toBe(true);
    const after = store.snapshot().ideas.find((idea) => idea.id === "CF-101")!;
    expect(after.description).toBe(before.description);
    expect(after.voters).toEqual(before.voters);
    expect(after.status).toBe("inbox");
    expect(after.screening).toBeUndefined();
    expect(after.plan).toBeUndefined();
    expect(after.contexts).toMatchObject([
      { authorName: message.username, text: "**Use a controller**" },
    ]);
    expect(stageInput("screen", after, store.snapshot().settings)).toContain(
      "**Use a controller**",
    );
    expect((await ingestChat(store, message)).duplicate).toBe(true);
    expect(
      store.snapshot().ideas.find((idea) => idea.id === "CF-101")?.contexts,
    ).toHaveLength(1);
    const events: string[] = [];
    store.subscribeEvents((event) => {
      events.push(event.type);
    });
    storage.failNextSave = true;
    await expect(
      ingestChat(store, {
        ...message,
        messageId: "failed-event",
        text: "!context CF-101 Another detail",
      }),
    ).rejects.toThrow();
    expect(
      store.snapshot().ideas.find((idea) => idea.id === "CF-101")?.contexts,
    ).toHaveLength(1);
    expect(events).not.toContain("request-context-added");
  });
});
