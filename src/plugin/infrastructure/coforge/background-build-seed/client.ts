import type { PolishingCodeApplyRequest, PolishingCodePort } from '../../../features/coforge/application/polishing-ports';
import type { PolishingCodeBinding } from '../../../features/coforge/domain/polishing';
import type { BackgroundBuildRetrySource } from '../../../features/coforge/domain/background-build-retry';
import { LocalWorkflowWorkspaces } from '../workflow-workspaces';
import { captureProjectProtection } from '../durable-worker/protection';
import { ReviewedResourceMaterializer } from './materialize';
import { polishingApplyRequestCheck } from './operator-record';
import { RetrySeedStore, retrySeedDirectory } from './store';
import { invalidSnapshot } from './tree';
import { inputHash } from '../durable-worker/protocol';
export interface PolishingNativeOptions {
  privateDirectory: string; vaultDirectory: string; protectedVaultFolders(): readonly string[]; workspaces: LocalWorkflowWorkspaces;
  validate(): void; assertSource(source: BackgroundBuildRetrySource): Promise<unknown>;
  background(request: PolishingCodeApplyRequest, protectedPaths: string[]): Promise<PolishingCodeBinding>;
}
export class NativePolishingResources implements PolishingCodePort {
  private readonly foreground: ReviewedResourceMaterializer;
  constructor(private readonly options: PolishingNativeOptions) { this.foreground = new ReviewedResourceMaterializer(options.privateDirectory, options.workspaces); }
  async materialize(value: PolishingCodeApplyRequest): Promise<PolishingCodeBinding> {
    this.options.validate(); const request = polishingApplyRequestCheck(value);
    const seeds = new RetrySeedStore(retrySeedDirectory(this.options.privateDirectory)); const snapshot = await seeds.read(request.reviewedSnapshot); const baseline = await seeds.read(request.baseline);
    if (inputHash(snapshot.manifest.source) !== inputHash(request.source)) throw invalidSnapshot();
    await this.options.assertSource(request.source); await this.options.assertSource(baseline.manifest.source);
    const protection = await captureProjectProtection(this.options.vaultDirectory, request.target.projectPath, this.options.protectedVaultFolders());
    return request.target.mode === 'background' ? this.options.background(request, protection.protectedProjectPaths)
      : this.foreground.materialize(request, protection.protectedProjectPaths);
  }
}
