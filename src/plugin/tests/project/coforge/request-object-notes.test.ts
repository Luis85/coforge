// @vitest-environment happy-dom
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import { App, Plugin } from "obsidian";
import { createTestApp, flushObsidian } from "@test/obsidian";
import { StudioService } from "../../../features/coforge/application/studio";
import { createDemoRunner } from "../../../features/coforge/application/demo-agent";
import { nodeTimers } from "./memory-storage";
import {
  VaultStudioStorage,
  readIdeaNote,
  splitNote,
} from "../../../infrastructure/coforge/vault-storage";
import { ideaFingerprint } from "../../../features/coforge/domain/integrity";
import { requestObjectRevision } from "../../../features/coforge/domain/request-object";
import { objectDefinition } from "./request-object-fixture";

it("treats external custom value changes as canonical input rather than an echo, then permits a reviewed edit after quarantine", async () => {
  const value = await fixture();
  try {
    await value.studio.updateProject({ requestObject: objectDefinition() });
    await value.studio.createIdea(input);
    const id = value.studio.state().ideas[0]!.id;
    await value.studio.store.transaction((state) => {
      const idea = state.ideas[0]!;
      idea.status = "screened";
      idea.screening = {
        verdict: "clear",
        reason: "Reviewed",
        signals: [],
        checkedAt: new Date().toISOString(),
        provider: "demo",
      };
    });
    const invalid = vi.fn();
    value.storage.watch((change) => {
      void value.studio.applyNoteChange(change);
    }, invalid);
    const file = value.storage.file(id)!;
    const beforeBody = splitNote(value.kit.read(file.path)).body;
    await value.app.vault.process(file, (current) =>
      current.replace("business-value: 0", "business-value: 90"),
    );
    await flushObsidian();
    await expect
      .poll(
        () =>
          value.studio.state().ideas[0]?.requestObject?.values[
            "business-value"
          ],
      )
      .toBe(90);
    const external = value.studio.state().ideas[0]!;
    expect(external.status).toBe("inbox");
    expect(external.screening).toBeUndefined();
    await value.studio.updateRequestValues(
      id,
      { "business-value": 100 },
      ideaFingerprint(external),
    );
    await flushObsidian();
    expect(
      value.studio.state().ideas[0]?.requestObject?.values["business-value"],
    ).toBe(100);
    expect(splitNote(value.kit.read(file.path)).body).toBe(beforeBody);
    expect(invalid).not.toHaveBeenCalled();
  } finally {
    await value.studio.stop();
  }
});

async function fixture() {
  const app = new App();
  const kit = createTestApp({ app, layoutReady: true });
  class TestPlugin extends Plugin {}
  const plugin = new TestPlugin(app, {
    id: "coforge",
    name: "CoForge",
    version: "0.1.0",
    minAppVersion: "1.13.7",
    description: "",
    author: "",
  });
  const storage = new VaultStudioStorage(plugin);
  const timers = nodeTimers();
  const runner = createDemoRunner(timers, [1, 1]);
  const studio = new StudioService(storage, {
    timers,
    runners: { demo: runner, claude: runner },
    probeRuntime: async () => ({
      cliAvailable: false,
      projectPath: null,
      allowImplementation: false,
    }),
  });
  await studio.start();
  if (!studio.state().projects?.length)
    await studio.createProject({
      projectName: "Business studio",
      projectBrief: "Private business proposals and explicit review.",
      projectPath: "/synthetic/business",
    });
  return { app, kit, plugin, storage, studio };
}
const input = {
  title: "A better onboarding flow",
  description: "Reduce the time until the first useful result.",
  category: "Gameplay",
  username: "Owner",
};

it("changes the project schema for new requests only and reloads captured native properties", async () => {
  const value = await fixture();
  try {
    await value.studio.createIdea(input);
    const old = value.studio.state().ideas[0]!;
    const oldFile = value.storage.file(old.id)!;
    await value.app.vault.process(
      oldFile,
      (current) =>
        current.replace(
          "---\n",
          '---\nrequest-class: "Legacy class" # preserve\npriority: Human\n',
        ) + "My original body stays.\r\n",
    );
    const oldBytes = value.kit.read(oldFile.path);
    const definition = objectDefinition();
    await value.studio.updateProject({ requestObject: definition });
    expect(value.kit.read(oldFile.path)).toBe(oldBytes);
    await value.studio.createIdea({
      ...input,
      title: "A newly classified proposal",
      requestValues: { customer: "Studio", priority: "High" },
      requestObjectRevision: requestObjectRevision(definition),
    });
    const created = value.studio
      .state()
      .ideas.find((idea) => idea.id !== old.id)!;
    const file = value.storage.file(created.id)!;
    const beforeSchemaChange = value.kit.read(file.path);
    expect(beforeSchemaChange).toContain("type: coforge-idea");
    expect(readIdeaNote(beforeSchemaChange)?.requestObject).toMatchObject({
      className: "Business Idea",
      values: {
        customer: "Studio",
        priority: "High",
        validated: false,
        "business-value": 0,
      },
    });
    const nextDefinition = {
      ...definition,
      className: "Feature Idea",
      fields: definition.fields.filter((field) => field.key !== "customer"),
    };
    await value.studio.updateProject({ requestObject: nextDefinition });
    expect(value.kit.read(oldFile.path)).toBe(oldBytes);
    expect(value.kit.read(file.path)).toBe(beforeSchemaChange);
    await value.studio.stop();
    const loaded = await value.storage.load();
    expect(loaded.projects?.[0]?.settings.requestObject).toEqual(
      nextDefinition,
    );
    expect(
      loaded.notes.find((note) => note.id === created.id)?.requestObject
        ?.className,
    ).toBe("Business Idea");
    expect(
      loaded.notes.find((note) => note.id === old.id)?.requestObject,
    ).toBeUndefined();
  } finally {
    await value.studio.stop();
  }
});

it("edits captured values with exact body and unrelated frontmatter preservation, without reapplying defaults", async () => {
  const value = await fixture();
  try {
    await value.studio.updateProject({ requestObject: objectDefinition() });
    await value.studio.createIdea(input);
    const idea = value.studio.state().ideas[0]!;
    const file = value.storage.file(idea.id)!;
    await value.app.vault.process(
      file,
      (current) =>
        current.replace(
          "---\n",
          '---\nowner: "Keep quoted" # human annotation\n',
        ) + "Human notes stay.\r\n",
    );
    const body = splitNote(value.kit.read(file.path)).body;
    await value.studio.updateRequestValues(
      idea.id,
      { "business-value": 25, validated: true, priority: "High" },
      ideaFingerprint(idea),
    );
    const updated = value.studio.state().ideas[0]!;
    expect(updated.requestObject?.values).toEqual({
      "business-value": 25,
      validated: true,
      priority: "High",
    });
    expect(value.kit.read(file.path)).toContain(
      'owner: "Keep quoted" # human annotation\n',
    );
    expect(splitNote(value.kit.read(file.path)).body).toBe(body);
    await value.studio.updateRequestValues(
      idea.id,
      {},
      ideaFingerprint(updated),
    );
    expect(
      readIdeaNote(value.kit.read(file.path))?.requestObject?.values,
    ).toEqual({});
    expect(splitNote(value.kit.read(file.path)).body).toBe(body);
  } finally {
    await value.studio.stop();
  }
});

it("rejects unwatched canonical input edits and restores note bytes when plugin-data storage fails", async () => {
  const value = await fixture();
  try {
    await value.studio.updateProject({ requestObject: objectDefinition() });
    await value.studio.createIdea(input);
    const idea = value.studio.state().ideas[0]!;
    const file = value.storage.file(idea.id)!;
    const original = value.kit.read(file.path);
    const changed = original.replace("business-value: 0", "business-value: 50");
    await value.app.vault.modify(file, changed);
    await expect(
      value.studio.updateRequestValues(
        idea.id,
        { "business-value": 100 },
        ideaFingerprint(idea),
      ),
    ).rejects.toThrow(/changed outside/iu);
    expect(value.kit.read(file.path)).toBe(changed);
    await value.app.vault.modify(file, original);
    const dataBefore = await value.app.vault.adapter.read(
      value.storage.dataPath,
    );
    const write = value.app.vault.adapter.write.bind(value.app.vault.adapter);
    const failed = vi
      .spyOn(value.app.vault.adapter, "write")
      .mockImplementation(async (path, data) => {
        if (path === value.storage.dataPath) throw new Error("Disk full");
        await write(path, data);
      });
    await expect(
      value.studio.updateRequestValues(
        idea.id,
        { "business-value": 100 },
        ideaFingerprint(idea),
      ),
    ).rejects.toThrow("Disk full");
    failed.mockRestore();
    expect(value.kit.read(file.path)).toBe(original);
    expect(await value.app.vault.adapter.read(value.storage.dataPath)).toBe(
      dataBefore,
    );
    expect(
      value.studio.state().ideas[0]?.requestObject?.values["business-value"],
    ).toBe(0);
  } finally {
    await value.studio.stop();
  }
});
