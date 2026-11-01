import { App, Plugin } from 'obsidian';
import { createTestApp } from '@test/obsidian';
import { StudioStore } from '../../../features/coforge/application/studio-store';
import { WorkflowEngine } from '../../../features/coforge/application/engine';
import { VaultStudioStorage } from '../../../infrastructure/coforge/vault-storage';
import { retryFixture } from './background-build-retry-fixture';
import { nodeTimers } from './memory-storage';

export async function retryNoteFixture(options: { partial?: boolean; frozen?: boolean } = {}) {
  const original = await retryFixture(options.partial ?? true); await original.engine.stop();
  const app = new App(); const kit = createTestApp({ app, layoutReady: true });
  const plugin = new (class extends Plugin {})(app, { id: 'coforge', name: 'CoForge', version: '0.1.0', minAppVersion: '1.13.7', description: '', author: '' });
  const initial = original.store.internalSnapshot(); const storage = new VaultStudioStorage(plugin); await storage.load(); await storage.save(initial, null);
  const file = storage.file(original.ideaId); if (!file) throw new Error('Original request fixture note missing');
  const note = kit.read(file.path).replace('---\n', '---\ncustom-owner: "Keep  exact spacing"\n');
  await app.vault.modify(file, note + '\n## User appendix\n\nHandwritten {{keep}} text.\r\n');
  const reopenedStorage = new VaultStudioStorage(plugin); const store = new StudioStore(reopenedStorage); await store.init();
  await store.updateRuntime({ cliAvailable: true, durableBuild: { ready: true, message: 'Test snapshot worker ready.', reviewedSnapshots: true } });
  const engine = new WorkflowEngine(store, { backgroundBuildRetries: original.resources, durableBuilds: original.worker,
    runners: { demo: original.runner, claude: original.runner }, timers: nodeTimers() });
  if (options.frozen !== false) engine.preventDispatchUntilStart();
  await app.vault.process(file, bytes => bytes.replace(/^custom-owner:.*$/mu, 'custom-owner: "Keep  exact spacing"'));
  return { ...original, app, kit, plugin, file, store, engine, storage: reopenedStorage, current: () => store.snapshot().ideas.find(idea => idea.id === original.ideaId)! };
}
