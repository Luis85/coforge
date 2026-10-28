import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App } from "obsidian";
import { createTestApp } from "@test/obsidian";
import {
  CouncilMessageNotes,
  renderCouncilMessage,
} from "../../../infrastructure/coforge/council-message-notes";
import { readCouncilSource } from "../../../infrastructure/coforge/council-source-notes";
import type { TeamMessage } from "../../../features/coforge/domain/team-messages";
import { Lexer } from 'marked';

it("protects and publishes one canonical message note, retaining edits on conflicting repair", async () => {
  const app = new App();
  createTestApp({ app });
  const protections: string[][] = [];
  const notes = new CouncilMessageNotes(app.vault, async (folders) => {
    protections.push(folders);
  });
  const message: TeamMessage = {
    id: "message",
    purpose: "information",
    recipientId: "team",
    body: "Shared guidance.",
    rootId: "root",
    runId: "run",
    attemptId: "attempt",
    senderId: "operator",
    projectId: "project",
    teamId: "team",
    threadId: "thread",
    createdAt: "2026-10-28T12:00:00Z",
    depth: 0,
    startsRun: false,
    reservedInvocations: 0,
  };
  const path = await notes.deliver(message);
  expect(await notes.deliver(message)).toBe(path);
  expect(app.vault.getMarkdownFiles()).toHaveLength(1);
  expect(protections[0]).toEqual(["CoForge/Messages"]);
  const file = app.vault.getFileByPath(path)!;
  const original = await app.vault.read(file);
  expect(readCouncilSource(original, path, []).sourceId).toBe("message");
  await app.vault.modify(file, `${original}\nMy annotation.\n`);
  await expect(notes.deliver(message)).rejects.toThrow("conflict");
  expect(await app.vault.read(file)).toBe(`${original}\nMy annotation.\n`);
  const unsafe = {
    ...message,
    body: '<img src="https://invalid.example/pixel">\n\n![[Private note]]\n\n```dataviewjs\nwindow.alert(1)\n```',
  };
  const projected = renderCouncilMessage(unsafe);
  expect(projected).toContain('\\<img');
  expect(Lexer.lex(projected).some(token => token.type === 'html')).toBe(false);
  expect(projected).not.toContain("![[Private note]]");
  expect(projected).not.toContain("```dataviewjs");
  expect(unsafe.body).toContain("<img");
});
