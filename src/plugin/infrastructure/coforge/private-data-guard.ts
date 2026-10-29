import type { Plugin } from "obsidian";
import {
  validateFolderLayout,
  type VaultFolderLayout,
} from "../../features/coforge/domain/vault-folder-policy";
const START = "# CoForge managed private data";
const END = "# End CoForge managed private data";
function humanRules(before: string): string {
  const ranges: Array<[number, number]> = [];
  let offset = 0;
  let start: number | undefined;
  for (const line of before.match(/[^\r\n]*(?:\r\n|\n|\r|$)/gu) ?? []) {
    if (!line) continue;
    const text = line.replace(/[\r\n]+$/u, "");
    if (text === START) start = offset;
    else if (text === END && start !== undefined) {
      ranges.push([start, offset + line.length]);
      start = undefined;
    }
    offset += line.length;
  }
  let result = "";
  let copied = 0;
  for (const [start, end] of ranges) {
    result += before.slice(copied, start);
    copied = end;
  }
  return result + before.slice(copied);
}
/** Local ignore files protect new installed vaults too, without replacing a user's existing ignore rules. */
export async function protectPrivateData(
  plugin: Plugin,
  folders?: VaultFolderLayout,
): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  const pluginFolder =
    plugin.manifest.dir ??
    `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
  const layout = folders
    ? validateFolderLayout(folders, [plugin.app.vault.configDir])
    : undefined;
  const ensureFolder = async (path: string, vaultManaged = false) => {
    let current = "";
    for (const segment of path.split("/")) {
      current = current ? `${current}/${segment}` : segment;
      if (await adapter.exists(current)) continue;
      if (vaultManaged) await plugin.app.vault.createFolder(current);
      else await adapter.mkdir(current);
    }
  };
  const append = async (path: string, rules: string) => {
    const before = (await adapter.exists(path)) ? await adapter.read(path) : "";
    const block = `${START}\n${rules}\n${END}`;
    const human = humanRules(before);
    const next =
      human + (human && !/[\r\n]$/u.test(human) ? "\n" : "") + block + "\n";
    if (next !== before) await adapter.write(path, next);
  };
  try {
    await ensureFolder("CoForge", true);
    await ensureFolder(pluginFolder);
    await append("CoForge/.gitignore", "*\n!Public/\n!Public/**\n!.gitignore");
    await append(
      `${pluginFolder}/.gitignore`,
      "coforge-*.json\ncoforge-alerts*.json*\ncoforge-economy-reservations/\ndata.json\n*.log",
    );
    if (layout) {
      await ensureFolder(layout.ideasFolder, true);
      await append(`${layout.ideasFolder}/.gitignore`, "*\n!.gitignore");
    }
  } catch {
    throw new Error(
      "CoForge could not protect its private vault data from Git. Check folder permissions before continuing. Existing ignore rules were preserved.",
    );
  }
}
