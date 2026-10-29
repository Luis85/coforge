// @vitest-environment happy-dom
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, disposePinia } from "pinia";
import { defineComponent, h } from "vue";
import { expect, it, vi } from "vitest";
vi.mock("obsidian", () => import("@test/obsidian"));
import CouncilView from "../../../presentation/components/coforge/CouncilView.vue";
import { useCouncilIdeaDraft } from "../../../presentation/composables/coforge/use-council-idea-draft";
import { useIdeaCardMenu } from "../../../presentation/composables/coforge/use-idea-card-menu";
import { useStudioStore } from "../../../presentation/stores/coforge-studio";
import { useCouncilStore } from "../../../presentation/stores/coforge-council";
import {
  coforgeKey,
  type CoforgeContext,
} from "../../../presentation/context/coforge-context";
import { councilControlsFixture } from "./council-controls-fixture";

it("offers a screened card action and asks before replacing an unrelated question or its Council selection", async () => {
  const f = await councilControlsFixture(false);
  const pinia = createPinia();
  const studio = useStudioStore(pinia);
  studio.state = f.studio.state();
  const council = useCouncilStore(pinia);
  council.taskTitle = "My unrelated question";
  council.taskQuestion = "Keep these words";
  council.taskTeam = "original-team";
  council.taskCouncil = "original-council";
  const key = council.taskDraftKey;
  const idea = studio.state.ideas.find((item) => item.status === "shipped")!;
  let draft: ReturnType<typeof useCouncilIdeaDraft> | undefined;
  let menu: ReturnType<typeof useIdeaCardMenu> | undefined;
  const Probe = defineComponent({
    setup() {
      draft = useCouncilIdeaDraft();
      menu = useIdeaCardMenu(
        { idea },
        { voted: false, voteDisabled: false, vote() {} },
      );
      return () => h("div");
    },
  });
  const context: CoforgeContext = {
    studio: f.studio,
    startupError: () => null,
    onNotice: () => () => {},
    host: {
      council: f.module.actions,
      setSecret: () => false,
      hasSecret: () => false,
      openIdeaNote: async () => false,
      saveExport: async () => "private.json",
      publishBoard: async () => ({ folder: "", changed: false }),
      installPagesWorkflow: async () => ({
        folder: "",
        workflow: "",
        created: false,
      }),
    },
  };
  const wrapper = mount(
    defineComponent({ render: () => h("div", [h(Probe), h(CouncilView)]) }),
    {
      global: {
        plugins: [pinia],
        provide: { [coforgeKey as symbol]: context },
        directives: { "cf-icon": () => {} },
      },
    },
  );
  try {
    await flushPromises();
    if (!menu || !draft) throw new Error("Missing draft actions");
    const item = menu.items
      .flat()
      .find((item) => "label" in item && item.label === "Send to the Council");
    expect(item).toMatchObject({ disabled: false });
    await draft.request(idea);
    await flushPromises();
    expect(
      wrapper.get('[aria-label="Replace Council draft"]').text(),
    ).toContain("My unrelated question");
    const click = async (label: string) => {
      const button = wrapper
        .findAll("button")
        .find((item) => item.text() === label);
      if (!button) throw new Error("Missing replacement action");
      await button.trigger("click");
      await flushPromises();
    };
    await click("Keep current draft");
    expect(council.taskDraftKey).toBe(key);
    expect(council.taskQuestion).toBe("Keep these words");
    expect(council.taskCouncil).toBe("original-council");
    await draft.request(idea);
    await flushPromises();
    await click("Replace draft with item assessment");
    expect(council.taskLinkedIdea?.ideaId).toBe(idea.id);
    expect(council.taskTitle).toContain(idea.id);
    expect(council.taskCouncil).toBe("");
    expect(council.taskTeam).toBe("");
    expect(f.module.actions.snapshot().runs).toHaveLength(0);
    expect(await f.module.actions.listTasks()).toHaveLength(0);
  } finally {
    wrapper.unmount();
    studio.dispose();
    disposePinia(pinia);
    await f.dispose();
  }
});
