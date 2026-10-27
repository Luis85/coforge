/** Narrow vault file seam. Backup recovery preserves the last complete JSON after an interrupted replacement. */
export interface JsonFiles {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  list(path: string): Promise<{ files: string[]; folders: string[] }>;
}
export async function readJson<T>(files: JsonFiles, path: string, check: (input: unknown) => T): Promise<T | null> {
  for (const candidate of [path, path + ".bak"]) {
    if (!(await files.exists(candidate))) continue;
    try {
      const raw = await files.read(candidate);
      if (raw.length > 50_000_000) throw new Error("JSON history exceeds the supported size.");
      return check(JSON.parse(raw));
    } catch {
      if (candidate.endsWith(".bak") || !(await files.exists(path + ".bak")))
        throw new Error("A saved JSON history is invalid. Restore the backup before recording again.");
    }
  }
  return null;
}
export async function writeJson(
  files: JsonFiles,
  path: string,
  value: unknown,
  check?: (input: unknown) => unknown,
): Promise<void> {
  const data = JSON.stringify(value, null, 2);
  if (data.length > 50_000_000) throw new Error("JSON history exceeds the supported size.");
  const temporary = path + ".tmp";
  const backup = path + ".bak";
  // Recover a replacement interrupted after the original was moved away.
  if (!(await files.exists(path)) && (await files.exists(backup))) await files.rename(backup, path);
  await files.write(temporary, data);
  const hadOriginal = await files.exists(path);
  if (hadOriginal) {
    // Invalid external edits are never promoted over a good backup or silently replaced.
    const original: unknown = JSON.parse(await files.read(path));
    if (check) check(original);
    if (await files.exists(backup)) await files.remove(backup);
    await files.rename(path, backup);
  }
  try {
    await files.rename(temporary, path);
  } catch {
    if (hadOriginal && (await files.exists(backup)) && !(await files.exists(path))) await files.rename(backup, path);
    throw new Error("The JSON history could not be replaced. The previous snapshot is retained.");
  }
  // Keep the previous complete generation as a recovery copy.
}
