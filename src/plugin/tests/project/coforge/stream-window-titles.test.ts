import { describe, expect, it } from "vitest";
import { StreamWindowSlots } from "../../../infrastructure/coforge/stream-window-titles";

describe("stable unique stream capture titles", () => {
  it("numbers live windows per surface without changing the first base title", () => {
    const slots = new StreamWindowSlots<object>();
    const first = slots.acquire({}, "kanban");
    const second = slots.acquire({}, "kanban");
    const chat = slots.acquire({}, "chat");
    expect(first).toEqual({
      surface: "kanban",
      slot: 1,
      title: "CoForge Stream - Kanban",
    });
    expect(second).toEqual({
      surface: "kanban",
      slot: 2,
      title: "CoForge Stream - Kanban (2)",
    });
    expect(chat).toEqual({
      surface: "chat",
      slot: 1,
      title: "CoForge Stream - Chat",
    });
  });
  it("honors a free restored slot, resolves collisions and releases only the closed owner", () => {
    const slots = new StreamWindowSlots<object>();
    const restored = {};
    const first = {};
    const collision = {};
    expect(slots.acquire(restored, "kanban", 4).title).toBe(
      "CoForge Stream - Kanban (4)",
    );
    expect(slots.acquire(first, "kanban").slot).toBe(1);
    expect(slots.acquire(collision, "kanban", 4).slot).toBe(2);
    slots.release(restored);
    expect(slots.acquire({}, "kanban", 4).slot).toBe(4);
    expect(slots.get(first)?.title).toBe("CoForge Stream - Kanban");
  });
  it("keeps a document's allocation across retargeting and ignores invalid restored slots", () => {
    const slots = new StreamWindowSlots<object>();
    const owner = {};
    const first = slots.acquire(owner, "kanban", 2);
    expect(slots.acquire(owner, "chat", 9)).toBe(first);
    expect(slots.get(owner)).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
    for (const slot of [
      undefined,
      0,
      -2,
      1.5,
      Infinity,
      NaN,
      "PRIVATE_VAULT_NAME",
    ])
      expect(
        new StreamWindowSlots<object>().acquire({}, "community", slot).title,
      ).toBe("CoForge Stream - Community");
  });
});
