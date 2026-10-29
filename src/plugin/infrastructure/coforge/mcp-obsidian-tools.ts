import { execFile } from 'node:child_process';
import { TFile, type Plugin } from 'obsidian';
import { isAbsolute } from 'node:path';
import { shape } from '../../features/coforge/domain/check';
import { vaultFoldersOverlap } from '../../features/coforge/domain/vault-folder-policy';
import { McpToolError } from './mcp-errors';
import { boundedVaultPath, sameVaultPath, vaultPathParts, vaultRoot } from './mcp-vault-boundary';
import { cliArguments, cliCommands, cliInput, noteInput, obsidianTools } from './mcp-obsidian-schema';
import { protectCouncilPrivatePaths } from './council-private-data';
import type { McpDispatcher } from './mcp-server';

export interface ObsidianCliIdentity { root: string; selector: string; name: string }
export interface ObsidianCliOptions {
  identity(): ObsidianCliIdentity;
  run?(args: string[], cwd: string, signal: AbortSignal): Promise<string>;
  authorize(): void;
  publicFolder(): string;
  blockedWriteFolders(): readonly string[];
}
export function executeObsidianCli(args: string[], cwd: string, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('obsidian', args, { cwd, shell: false, windowsHide: true, signal, timeout: 6000, maxBuffer: 200000, encoding: 'utf8' }, (error, stdout) => {
      if (error) reject(new McpToolError('HOST_UNAVAILABLE', 'Official Obsidian CLI failed, timed out or exceeded its output bound. Enable Command line interface in Obsidian, register it on PATH and restart the app. Raw process output was withheld.', 'coforge_obsidian_status'));
      else resolve(stdout);
    });
  });
}
/** Exact-vault CLI reads plus atomic native note authoring; never arbitrary command passthrough. */
export class McpObsidianTools implements McpDispatcher {
  private pending: Promise<unknown> = Promise.resolve();
  private controller = new AbortController();
  constructor(private readonly plugin: Plugin, private readonly options: ObsidianCliOptions) {}
  tools() { this.options.authorize(); return obsidianTools(); }
  revoke(): void { this.controller.abort(); this.controller = new AbortController(); }
  call(name: string, raw: unknown): Promise<unknown> {
    const signal = this.controller.signal;
    const next = this.pending.then(() => this.execute(name, raw, signal));
    this.pending = next.catch(() => undefined); return next;
  }
  private assert(signal: AbortSignal) { signal.throwIfAborted(); this.options.authorize(); }
  private async identity(signal: AbortSignal) {
    this.assert(signal);
    const identity = this.options.identity();
    if (!identity.selector || identity.selector.length > 200 || /[=\p{Cc}]/u.test(identity.selector) || identity.selector.startsWith('-'))
      throw new McpToolError('HOST_UNAVAILABLE', 'The current vault has no valid explicit CLI selector.');
    const root = await vaultRoot(identity.root);
    this.assert(signal);
    return { ...identity, root };
  }
  private async cli(identity: ObsidianCliIdentity, args: string[], signal: AbortSignal) {
    this.assert(signal);
    const run = this.options.run ?? executeObsidianCli;
    const reported = (await run([`vault=${identity.selector}`, 'vault', 'info=path'], identity.root, signal)).trim();
    this.assert(signal);
    if (!isAbsolute(reported) || !sameVaultPath(identity.root, reported))
      throw new McpToolError('PERMISSION_DENIED', 'Obsidian CLI targeted a different vault. No requested operation ran. Repair CLI vault registration before retrying.', 'coforge_obsidian_status');
    const current = await this.identity(signal);
    if (!sameVaultPath(identity.root, current.root) || identity.selector !== current.selector)
      throw new McpToolError('PERMISSION_DENIED', 'The current vault identity changed. Retry after inspecting Obsidian.');
    const output = await run([`vault=${identity.selector}`, ...args], identity.root, signal);
    this.assert(signal);
    if (Buffer.byteLength(output) > 200000) throw new McpToolError('INVALID_RESULT', 'CLI output exceeds 200000 bytes. Narrow the query or folder.');
    return output;
  }
  private async execute(name: string, raw: unknown, signal: AbortSignal): Promise<unknown> {
    this.assert(signal);
    if (name === 'coforge_obsidian_status') {
      shape({}, { strict: true })(raw);
      try {
        const identity = await this.identity(signal);
        const version = (await this.cli(identity, ['version'], signal)).trim();
        const match = /\b(\d+)\.(\d+)\.(\d+)\b/u.exec(version);
        if (!match || !(Number(match[1]) > 1 || Number(match[1]) === 1 && (Number(match[2]) > 12 || Number(match[2]) === 12 && Number(match[3]) >= 7))) throw new Error('Unsupported CLI');
        return { available: true, vault: identity.name, version, commands: [...cliCommands], noteAuthoring: 'coforge_obsidian_note', policy: 'Explicit current-vault routing; Markdown files only; ordinary-note edits use atomic host preconditions. No shell or arbitrary command execution.' };
      } catch {
        this.assert(signal);
        return { available: false, nextAction: 'Enable Command line interface in Obsidian 1.12.7 or newer, register the official obsidian command on PATH, then restart Obsidian. Duplicate vault names must be resolved if vault identity cannot be verified.' };
      }
    }
    if (name === 'coforge_obsidian_cli') {
      const input = cliInput(raw);
      const args = cliArguments(input);
      const assertReadable = (path: string) => {
        if (vaultFoldersOverlap(path, this.plugin.app.vault.configDir))
          throw new McpToolError('PERMISSION_DENIED', 'Obsidian configuration is excluded from vault tools.');
      };
      if (input.path) assertReadable(input.path);
      if (input.folder) assertReadable(input.folder);
      const identity = await this.identity(signal);
      if (input.path) await boundedVaultPath(identity.root, input.path);
      if (input.folder) await boundedVaultPath(identity.root, input.folder);
      if (!input.path && !['files', 'folders'].includes(input.command)) {
        // Aggregate CLI reads use Obsidian's index. Verify indexed source paths first so a
        // linked file cannot make content from another vault part of a vault-wide search.
        const prefix = input.folder?.toLowerCase();
        const files = this.plugin.app.vault.getMarkdownFiles().filter(file => !prefix || file.path.toLowerCase().startsWith(prefix + '/'));
        if (files.length > 2000) throw new McpToolError('INVALID_ARGUMENTS', 'Aggregate reads are limited to 2000 Markdown notes. Use a smaller search folder or an explicit note path.');
        for (let offset = 0; offset < files.length; offset += 16) {
          await Promise.all(files.slice(offset, offset + 16).map(file => {
            assertReadable(file.path);
            return boundedVaultPath(identity.root, file.path);
          }));
          this.assert(signal);
        }
      }
      const output = await this.cli(identity, args, signal);
      if (input.command === 'read' && input.path) {
        await boundedVaultPath(identity.root, input.path);
        const file = this.plugin.app.vault.getAbstractFileByPath(input.path);
        if (!(file instanceof TFile)) throw new McpToolError('CONFLICT', 'The requested note is no longer available.');
        const content = await this.plugin.app.vault.read(file);
        this.assert(signal);
        if (Buffer.byteLength(content) > 200000) throw new McpToolError('INVALID_RESULT', 'The note exceeds the 200000-byte read bound.');
        return { command: input.command, vault: identity.name, output, content };
      }
      return { command: input.command, vault: identity.name, output };
    }
    if (name !== 'coforge_obsidian_note') throw new McpToolError('INVALID_ARGUMENTS', 'Unknown Obsidian tool. Inspect tools/list.');
    const input = noteInput(raw);
    const parts = vaultPathParts(input.path);
    const folder = parts.slice(0, -1).join('/');
    if (!folder || !/\.md$/iu.test(input.path) || Buffer.byteLength(input.content) > 200000 || /<!--\s*coforge:v2:/iu.test(input.content))
      throw new McpToolError('INVALID_ARGUMENTS', 'Choose an ordinary Markdown note in a private parent folder without reserved CoForge output markers.');
    const assertDestination = () => {
      this.assert(signal);
      if ([...this.options.blockedWriteFolders(), this.options.publicFolder(), 'CoForge/Public', this.plugin.app.vault.configDir].some(blocked => vaultFoldersOverlap(input.path, blocked)))
        throw new McpToolError('PERMISSION_DENIED', 'Managed CoForge notes, watched sources and public exports require dedicated tools or the operator in Obsidian.');
    };
    assertDestination();
    const identity = await this.identity(signal);
    await boundedVaultPath(identity.root, input.path, true);
    assertDestination();
    const vault = this.plugin.app.vault;
    const existing = vault.getAbstractFileByPath(input.path);
    if (existing && !(existing instanceof TFile)) throw new McpToolError('CONFLICT', 'The note destination is a folder.');
    let changed = false;
    if (existing instanceof TFile) {
      const before = await vault.read(existing);
      if (before === input.content) return { path: input.path, changed: false, created: false };
      if (before !== input.expectedContent) throw new McpToolError('CONFLICT', 'The note changed. Read its current content before replacing it.', 'coforge_obsidian_cli');
      await protectCouncilPrivatePaths(this.plugin, [folder], this.options.publicFolder());
      await boundedVaultPath(identity.root, input.path);
      await vault.process(existing, current => {
        assertDestination();
        if (current === input.content) return current;
        if (current !== input.expectedContent) throw new McpToolError('CONFLICT', 'The note changed. Read its current content before replacing it.', 'coforge_obsidian_cli');
        changed = true; return input.content;
      });
    } else {
      if (input.expectedContent !== null) throw new McpToolError('CONFLICT', 'The note was removed. Nothing was recreated.');
      await protectCouncilPrivatePaths(this.plugin, [folder], this.options.publicFolder());
      await boundedVaultPath(identity.root, input.path, true);
      assertDestination();
      await vault.create(input.path, input.content);
      changed = true;
    }
    return { path: input.path, changed, created: !existing && changed };
  }
}
