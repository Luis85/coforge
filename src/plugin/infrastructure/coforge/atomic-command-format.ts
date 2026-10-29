import {
  list,
  nullable,
  optional,
  oneOf,
  shape,
  text,
} from "../../features/coforge/domain/check";
import { parsePersistedStudio } from "../../features/coforge/domain/persisted";
import { validateFolderLayout } from "../../features/coforge/domain/vault-folder-policy";

const bytes = text({ max: 50000000 });
const noteCheck = shape(
  {
    id: text({ pattern: /^CF-\d+$/u, max: 200 }),
    path: text({ min: 1, max: 1000 }),
    before: nullable(bytes),
    after: bytes,
    rollbackPath: optional(text({ min: 1, max: 1000 })),
  },
  { strict: true },
);
const check = shape(
  {
    format: oneOf(["coforge-command-commit/v1"]),
    recoveryId: text({ pattern: /^[a-f0-9-]{36}$/u }),
    folder: text({ min: 1, max: 200 }),
    beforeData: bytes,
    afterData: bytes,
    notes: list(noteCheck, { max: 10000 }),
  },
  { strict: true },
);
export type AtomicCommandJournal = ReturnType<typeof check>;
export type AtomicCommandNote = AtomicCommandJournal["notes"][number];
export const commandRecoveryFailure = () =>
  new Error(
    "A command commit needs recovery. Preserve coforge-command-commit.json and the current notes; restore the reviewed bytes or inspect the private journal before retrying. No further commands were written.",
  );
/** Journals are untrusted input. Restrict recovery to exact Idea files in its captured private layout. */
export function parseAtomicCommand(
  content: string,
  configDir: string,
  readId: (content: string) => string | undefined,
): AtomicCommandJournal {
  if (content.length > 100000000) throw commandRecoveryFailure();
  const journal = check(JSON.parse(content));
  const before = parsePersistedStudio(JSON.parse(journal.beforeData));
  const after = parsePersistedStudio(JSON.parse(journal.afterData));
  const layout = validateFolderLayout(after.integration, [configDir]);
  const old = validateFolderLayout(before.integration, [configDir]);
  if (
    layout.ideasFolder !== journal.folder ||
    old.ideasFolder !== journal.folder ||
    layout.publicFolder !== old.publicFolder
  )
    throw commandRecoveryFailure();
  const paths = new Set<string>();
  const ids = new Set<string>();
  for (const [index, note] of journal.notes.entries()) {
    if (
      !/^[^/:\\]+(?:\/[^/:\\]+)*\.md$/iu.test(note.path) ||
      note.path
        .split("/")
        .some(
          (segment) =>
            segment === "." ||
            segment === ".." ||
            /[\p{Cc}*?"<>|]/u.test(segment),
        ) ||
      !note.path.toLowerCase().startsWith(journal.folder.toLowerCase() + "/") ||
      note.path.toLowerCase().startsWith(configDir.toLowerCase() + "/") ||
      note.path.toLowerCase().startsWith(".git/") ||
      readId(note.after) !== note.id ||
      (note.before !== null && readId(note.before) !== note.id) ||
      (note.before === null
        ? note.rollbackPath !==
          `CoForge/Recovery/Commands/${journal.recoveryId}/${index}.coforge-archive`
        : note.rollbackPath !== undefined) ||
      paths.has(note.path.toLowerCase()) ||
      ids.has(note.id)
    )
      throw commandRecoveryFailure();
    paths.add(note.path.toLowerCase());
    ids.add(note.id);
  }
  return journal;
}
