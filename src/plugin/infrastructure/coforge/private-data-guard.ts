import type { Plugin } from "obsidian";
const START = "# CoForge managed private data";
const END = "# End CoForge managed private data";
/** Local ignore files protect new installed vaults too, without replacing a user's existing ignore rules. */
export async function protectPrivateData(plugin: Plugin): Promise<void> {
  const adapter = plugin.app.vault.adapter;
  const pluginFolder =
    plugin.manifest.dir ??
    `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
  const append = async (path: string, rules: string) => {
    const before = (await adapter.exists(path)) ? await adapter.read(path) : "";
    const block = `${START}\n${rules}\n${END}`;
    const start = before.indexOf(START);
    const end = before.indexOf(END, start);
    const next =
      start >= 0 && end >= start
        ? before.slice(0, start) + block + before.slice(end + END.length)
        : before +
          (before && !before.endsWith("\n") ? "\n" : "") +
          block +
          "\n";
    if (next !== before) await adapter.write(path, next);
  };
  try {
    if (!(await adapter.exists("CoForge"))) await adapter.mkdir("CoForge");
    if (!(await adapter.exists(pluginFolder)))
      await adapter.mkdir(pluginFolder);
    await append("CoForge/.gitignore", "*\n!Public/\n!Public/**\n!.gitignore");
    await append(
      `${pluginFolder}/.gitignore`,
      "coforge-*.json\ndata.json\n*.log",
    );
  } catch {
    throw new Error(
      "CoForge could not protect its private vault data from Git. Check folder permissions before continuing. Existing ignore rules were preserved.",
    );
  }
}
