import type { Plugin } from "obsidian";
import {
  list,
  number,
  optional,
  shape,
  oneOf,
  text,
  boolean,
} from "../../features/coforge/domain/check";
import { intakeBindingCheck } from "../../features/coforge/domain/intake-bindings";
import type { CouncilPreferences } from "../../features/coforge/application/council-ports";
import type { IntakeState } from "../../features/coforge/application/intake-service";
import { councilDefinitionFoldersCheck, DEFAULT_COUNCIL_FOLDERS } from "../../features/coforge/domain/council-definition-folders";

const preferencesCheck = shape(
  {
    format: oneOf(["coforge-council-settings/v1"] as const),
    revision: number({ min: 0, integer: true }),
    executorId: text({ max: 200 }),
    bindings: list(intakeBindingCheck, { max: 100 }),
    definitionFolders: optional((value) =>
      councilDefinitionFoldersCheck(value),
    ),
    pausedProjectIds: optional(list(text({ min: 1, max: 200 }), { max: 100 })),
  },
  { strict: true },
);
const id = text({ min: 1, max: 1000 });
const intakeCheck = shape(
  {
    activations: list(
      shape(
        {
          bindingId: id,
          activatedAt: number({ min: 0 }),
          baselineSourceIds: list(id, { max: 10000 }),
          baselineSubmissions: optional(
            list(
              shape(
                { sourceId: id, generation: number({ min: 0, integer: true }) },
                { strict: true },
              ),
              { max: 10000 },
            ),
          ),
        },
        { strict: true },
      ),
      { max: 100 },
    ),
    observations: list(
      shape(
        {
          key: id,
          sourceId: id,
          generation: number({ min: 0, integer: true }),
          bindingId: id,
          revision: id,
          stableSince: number({ min: 0 }),
          admitted: boolean,
        },
        { strict: true },
      ),
      { max: 10000 },
    ),
  },
  { strict: true },
);
export class CouncilStateStorage {
  readonly directory: string;
  constructor(private readonly plugin: Plugin,
    private readonly assertNoteFoldersAvailable: (folders: readonly string[]) => void = () => undefined) {
    this.directory =
      plugin.manifest.dir ??
      `${plugin.app.vault.configDir}/plugins/${plugin.manifest.id}`;
  }
  private async read(name: string): Promise<unknown | undefined> {
    const path = `${this.directory}/coforge-council-${name}.json`;
    if (!(await this.plugin.app.vault.adapter.exists(path))) return undefined;
    const raw = await this.plugin.app.vault.adapter.read(path);
    if (raw.length > 8 * 1024 * 1024)
      throw new Error(
        "Council state exceeds its retained evidence limit. Preserve its file before recovery.",
      );
    return JSON.parse(raw);
  }
  async preferences(): Promise<CouncilPreferences> {
    const preferences = preferencesCheck(
      (await this.read("settings")) ?? {
        format: "coforge-council-settings/v1",
        revision: 0,
        executorId: "",
        bindings: [],
      },
    );
    this.assertNoteFoldersAvailable(Object.values(preferences.definitionFolders ?? DEFAULT_COUNCIL_FOLDERS));
    return preferences;
  }
  async savePreferences(
    value: CouncilPreferences,
    revision: number,
  ): Promise<void> {
    const next = preferencesCheck(value);
    if (
      (await this.preferences()).revision !== revision ||
      next.revision !== revision + 1
    )
      throw new Error(
        "Council settings changed. Refresh before saving; the draft is preserved.",
      );
    await this.plugin.app.vault.adapter.write(
      `${this.directory}/coforge-council-settings.json`,
      JSON.stringify(next),
    );
  }
  async intake(): Promise<IntakeState> {
    return intakeCheck(
      (await this.read("intake")) ?? { activations: [], observations: [] },
    );
  }
  async saveIntake(value: IntakeState): Promise<void> {
    await this.plugin.app.vault.adapter.write(
      `${this.directory}/coforge-council-intake.json`,
      JSON.stringify(intakeCheck(value)),
    );
  }
}
