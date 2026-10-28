import { computed, reactive } from "vue";
import type { Idea } from "../../../features/coforge/domain/types";
import { ideaProjectId } from "../../../features/coforge/domain/projects";
import {
  councilIdeaAssessmentIssue,
  councilIdeaRevision,
} from "../../../features/coforge/application/council-linked-idea";
import { useCouncilStore } from "../../stores/coforge-council";
import { useStudioStore } from "../../stores/coforge-studio";
import { useStudioActions } from "./use-studio-actions";

/** The card action authors a local draft; saving, preflight and admission remain explicit. */
export function useCouncilIdeaDraft() {
  const council = useCouncilStore();
  const studio = useStudioStore();
  const actions = useStudioActions();
  const applying = computed(() => council.taskAssessmentApplying);
  const occupied = () =>
    Boolean(
      council.taskTitle || council.taskQuestion || council.taskLinkedIdea,
    );
  async function replace() {
    const pending = council.pendingIdeaAssessment;
    if (!pending || applying.value || council.busy) return;
    council.taskAssessmentApplying = true;
    try {
      const idea = studio.state?.ideas.find(
        (item) => item.id === pending.linkedIdea.ideaId,
      );
      if (
        !idea ||
        ideaProjectId(idea) !== pending.projectId ||
        councilIdeaRevision(idea) !== pending.linkedIdea.revision
      )
        throw new Error(
          "This request changed. Reopen its action menu to capture the current version; your draft is kept.",
        );
      const issue = councilIdeaAssessmentIssue(idea);
      if (issue) throw new Error(issue);
      if (
        studio.state?.activeProjectId !== pending.projectId &&
        !(await actions.selectProject(pending.projectId))
      )
        return;
      if (council.pendingIdeaAssessment !== pending) return;
      if (!studio.navigate("council")) return;
      council.tab = "ask";
      council.taskConfirmedSavedDraftKey = "";
      council.taskReviewDraftKey = "";
      council.taskTitle = `Assess ${idea.id}: ${idea.title}`.slice(0, 160);
      council.taskQuestion =
        "Assess this request. What are the next steps, open gaps, risks and questions we should resolve? Give advice and an opinion; do not change its plan or implementation.";
      council.taskTeam = "";
      council.taskCouncil = "";
      council.taskProjectId = pending.projectId;
      council.taskDraftKey = crypto.randomUUID();
      council.taskLinkedIdea = { ...pending.linkedIdea };
      council.taskSource = "";
      council.source = "";
      council.preview = null;
      council.pendingIdeaAssessment = null;
      council.notice = `Assessment draft for ${idea.id}. Choose its project team and Council, then save and review.`;
    } catch (error) {
      studio.notify(
        error instanceof Error
          ? error.message
          : "The assessment draft could not be opened.",
        true,
      );
    } finally {
      council.taskAssessmentApplying = false;
    }
  }
  return reactive({
    applying,
    replace,
    keep: () => {
      council.pendingIdeaAssessment = null;
    },
    request: async (idea: Idea) => {
      if (council.taskAssessmentApplying || council.busy) return;
      const issue = councilIdeaAssessmentIssue(idea);
      if (issue) {
        studio.notify(issue, true);
        return;
      }
      const projectId = ideaProjectId(idea);
      if (
        !studio.state?.projects?.some(
          (project) => project.id === projectId && !project.unavailable,
        )
      ) {
        studio.notify(
          "Restore this request's project before asking the Council.",
          true,
        );
        return;
      }
      if (!studio.navigate("council")) return;
      studio.select(null);
      council.tab = "ask";
      council.pendingIdeaAssessment = {
        linkedIdea: { ideaId: idea.id, revision: councilIdeaRevision(idea) },
        title: idea.title,
        projectId,
      };
      if (!occupied()) await replace();
    },
  });
}
