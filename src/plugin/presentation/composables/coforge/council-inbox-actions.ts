import type { CouncilActions } from "../../../features/coforge/application/council-ports";
import type { CouncilTarget } from "../../../features/coforge/application/council-execution";
import type { IntakeBinding } from "../../../features/coforge/domain/intake-bindings";
import type { useCouncilStore } from "../../stores/coforge-council";

export function councilInboxActions(host: {
  store: ReturnType<typeof useCouncilStore>;
  service(): CouncilActions;
  projectId(): string;
  target(): CouncilTarget;
  run(work: () => Promise<void>): Promise<void>;
}) {
  const { store } = host;
  return {
    resetTarget: () =>
      store.state?.preferences.bindings.find(
        (item) => item.id === store.resetInboxId,
      )?.path ?? "",
    prepareReset: (id: string) => {
      store.resetInboxId = id;
      store.resetInboxConfirmed = false;
    },
    resetInbox: () =>
      host.run(async () => {
        if (!store.resetInboxConfirmed || !store.resetInboxId)
          throw new Error("Confirm the exact inbox activation to reset.");
        const service = host.service();
        await service.resetInbox(
          store.resetInboxId,
          service.snapshot().preferences.revision,
        );
        store.resetInboxId = "";
        store.resetInboxConfirmed = false;
        store.inboxPreviewed = false;
        store.notice =
          "Inbox activation reset and paused. Preview and reactivate explicitly; prior processed submissions remain protected from replay.";
      }),
    markSource: (path: string, draft: boolean) =>
      host.run(async () => {
        await host.service().setSourceState(path, { draft, ready: !draft });
        store.preview = null;
        if (store.inboxPreviewed && store.bindingId)
          store.inboxPreview = await host
            .service()
            .previewInbox(store.bindingId);
        store.notice = draft
          ? "The note is Draft and will not dispatch."
          : "The note is Ready. Active intake will reconcile after its stability window.";
      }),
    newInbox: () => {
      store.editingBindingId = "";
      store.bindingId = "";
      store.inboxPath = "";
      store.inboxPreviewed = false;
      store.inboxPreview = [];
    },
    editInbox: (binding: IntakeBinding) => {
      store.editingBindingId = binding.id;
      store.inboxPath = binding.path;
      store.recursive = binding.recursive;
      store.readyOnly = binding.submit === "ready";
      store.team = binding.teamId;
      store.target = binding.target.id;
      store.inboxKind =
        binding.target.kind === "workflow"
          ? "workflow"
          : binding.target.kind === "team"
            ? "team"
            : "agent-council";
      store.inboxPreviewed = false;
    },
    saveInbox: () =>
      host.run(async () => {
        const action = host.service();
        const state = action.snapshot();
        const projectId = host.projectId();
        const target =
          store.inboxKind === "workflow"
            ? {
                kind: "workflow" as const,
                id: `workflow-${projectId}`,
                teamId: store.team,
              }
            : store.inboxKind === "team"
              ? { kind: "team" as const, id: store.team, teamId: store.team }
              : host.target();
        const binding: IntakeBinding = {
          id: store.editingBindingId || `inbox-${crypto.randomUUID()}`,
          path: store.inboxPath,
          projectId,
          teamId: target.teamId,
          target: { kind: target.kind, id: target.id },
          enabled:
            state.preferences.bindings.find(
              (item) => item.id === store.editingBindingId,
            )?.enabled ?? true,
          recursive: store.recursive,
          submit: store.readyOnly ? "ready" : "after-stable",
          settleMs: 2000,
        };
        await action.saveBindings(
          [
            ...state.preferences.bindings.filter(
              (item) => item.id !== binding.id,
            ),
            binding,
          ],
          state.preferences.revision,
        );
        store.editingBindingId = binding.id;
        store.bindingId = binding.id;
        store.inboxPreviewed = false;
        store.notice = "Inbox saved. Preview existing notes before activation.";
      }),
    previewInbox: (id: string) =>
      host.run(async () => {
        store.bindingId = id;
        store.inboxPreview = await host.service().previewInbox(id);
        store.inboxSelection = [];
        store.inboxPreviewed = true;
      }),
    activateInbox: () =>
      host.run(async () => {
        await host
          .service()
          .activateInbox(store.bindingId, [...store.inboxSelection]);
        store.notice =
          "Inbox activated. Unselected existing notes form the skipped baseline.";
        store.inboxPreview = [];
        store.inboxPreviewed = false;
      }),
    toggleInbox: (binding: IntakeBinding) =>
      host.run(async () => {
        const action = host.service();
        const state = action.snapshot();
        await action.saveBindings(
          state.preferences.bindings.map((item) =>
            item.id === binding.id ? { ...item, enabled: !item.enabled } : item,
          ),
          state.preferences.revision,
        );
      }),
  };
}
