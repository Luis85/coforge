import type { StudioStore } from "./studio-store";
import { addEvent } from "./studio-state";
import { ideaFingerprint, quarantine } from "../domain/integrity";
import { findProject, ideaProjectId } from "../domain/projects";
import {
  requestObjectIdentity,
  requestObjectValuesCheck,
} from "../domain/request-object";
import { requestObjectEditIdentity } from "../domain/request-object-integrity";
import { ownerScreeningExempt } from '../domain/owner-screening';

export async function updateRequestValues(
  store: StudioStore,
  ideaId: string,
  values: unknown,
  expectedRequestFingerprint: string,
): Promise<void> {
  const observed = store.snapshot().ideas.find((idea) => idea.id === ideaId);
  if (!observed) throw new Error("Request not found.");
  const expectedInputIdentity = requestObjectEditIdentity(observed);
  await store.transaction(
    (state) => {
      const idea = state.ideas.find((item) => item.id === ideaId);
      if (
        !idea ||
        !expectedRequestFingerprint ||
        ideaFingerprint(idea) !== expectedRequestFingerprint
      )
        throw new Error(
          "This request changed. Review its current values before saving; your draft was not written.",
        );
      if (findProject(state, ideaProjectId(idea)).unavailable)
        throw new Error(
          "Restore the project note before editing request fields.",
        );
      if (!idea.requestObject)
        throw new Error(
          "This existing request has no captured custom schema. Project request definitions apply only to new requests.",
        );
      if (["shipped", "rejected"].includes(idea.status))
        throw new Error(
          "This request is closed. Submit a new request for further work.",
        );
      const next = {
        ...idea.requestObject,
        values: requestObjectValuesCheck(idea.requestObject.fields, values),
      };
      if (
        JSON.stringify(requestObjectIdentity(next)) ===
        JSON.stringify(requestObjectIdentity(idea.requestObject))
      )
        return;
      idea.requestObject = next;
      const ownerScreening = ownerScreeningExempt(idea) ? idea.screening : undefined;
      quarantine(idea);
      if (ownerScreening) {
        idea.status = 'screened';
        idea.screening = { ...ownerScreening, checkedAt: idea.updatedAt };
        delete idea.lastError;
      } else idea.lastError = "Request fields changed. Screen the complete request again before further agent work.";
      addEvent(
        state,
        "idea",
        `${idea.id} request fields changed; ${ownerScreening ? 'owner screening exemption retained' : 'screening is required again'}.`,
        idea.id,
      );
    },
    { requestValuesEdit: { ideaId, expectedInputIdentity } },
  );
}
