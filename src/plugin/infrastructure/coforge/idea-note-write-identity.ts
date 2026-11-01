import type { NoteIdea } from '../../features/coforge/application/ports';
import { ideaFingerprint } from '../../features/coforge/domain/integrity';
import { polishingMetadataFingerprint, workflowMetadataFingerprint } from '../../features/coforge/application/workflow-note-integrity';

/** Check the actual process input, so delayed metadata cannot let a save overwrite outside changes. */
export function assertIdeaWriteIdentity(actual: NoteIdea | null, expected: NoteIdea | undefined): void {
  if (!actual || !expected || actual.id !== expected.id || actual.authorId !== expected.authorId ||
      ideaFingerprint(actual) !== ideaFingerprint(expected) || workflowMetadataFingerprint(actual) !== workflowMetadataFingerprint(expected) ||
      polishingMetadataFingerprint(actual) !== polishingMetadataFingerprint(expected))
    throw new Error('The canonical request changed outside this save. Refresh and review its current note; no managed values were overwritten.');
}
