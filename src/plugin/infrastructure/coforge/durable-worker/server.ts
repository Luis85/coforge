import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { list, number, record, shape, text } from '../../../features/coforge/domain/check';
import { durableBuildResultCheck, durableBuildTerminal } from '../../../features/coforge/domain/durable-build';
import type { LocalWorkflowWorkspaces } from '../workflow-workspaces';
import { workerDescriptorCheck, workerRef, workerRequestCheck, type WorkerDescriptor } from './protocol';
import type { WorkerService } from './service';
import { DurableBuildCapacityError } from '../../../features/coforge/application/durable-build-ports';
import { WorkerRecovery } from './recovery';
import { ReviewedResourceMaterializer } from '../background-build-seed/materialize';
import { operatorWorkspaceRecord, polishingApplyRequestCheck } from '../background-build-seed/operator-record';
import { workflowWorkspaceRecordsCheck } from '../workflow-workspace-check';
import { protectedPrefix } from './protection';
import { PolishingCopyRetainedError } from '../../../features/coforge/application/polishing-ports';

const reply = (response: ServerResponse, status: number, value: unknown) => { response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(value)); };
async function body(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)); size += buffer.length; if (size > 16 * 1024 * 1024) throw new Error('The captured Build request exceeds its private transport limit.'); chunks.push(buffer); }
  return record(JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
export async function startWorkerServer(service: WorkerService, workspaces: LocalWorkflowWorkspaces, identity: Omit<WorkerDescriptor, 'endpoint' | 'pid' | 'startedAt'>) {
  const state: { descriptor?: WorkerDescriptor } = {};
  const recovery = new WorkerRecovery(service.store.files, { store: service.store, workspaces, active: ref => service.ownsActive(ref) });
  const materializer = new ReviewedResourceMaterializer(service.store.files.directory, workspaces, service.store.files);
  const authorize = (request: IncomingMessage) => {
    const provided = Buffer.from(request.headers.authorization ?? ''); const expected = Buffer.from('Bearer ' + identity.token);
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  };
  const server = createServer((request, response) => {
    void (async () => {
      if (!state.descriptor || request.method !== 'POST' || request.url !== '/v1' || !authorize(request) ||
        request.headers.host !== new URL(state.descriptor.endpoint).host || request.headers.origin) { reply(response, 403, { ok: false, error: 'Authenticated loopback worker access is required.' }); return; }
      const input = await body(request); const op = text({ min: 1, max: 40 })(input.op);
      let value: unknown;
      if (op === 'health') { shape({ op: text() }, { strict: true })(input); value = state.descriptor; }
      else if (op === 'workerStatus') { shape({ op: text() }, { strict: true })(input); value = service.status(); }
      else if (op === 'configureConcurrency') { const parsed = shape({ op: text(), builds: number({ integer: true, min: 1, max: 16 }) }, { strict: true })(input); await service.configureConcurrency(parsed.builds); }
      else if (op === 'cancelUnstarted') { const parsed = shape({ op: text(), jobId: text({ min: 1, max: 160 }) }, { strict: true })(input); await service.cancelUnstarted(parsed.jobId); }
      else if (op === 'prepare') { const parsed = shape({ op: text(), request: workerRequestCheck }, { strict: true })(input); value = await service.prepare(parsed.request); }
      else if (op === 'materializeReviewedResource') {
        const parsed = shape({ op: text(), request: polishingApplyRequestCheck, protectedPaths: list((value: unknown) => protectedPrefix(text()(value)), { max: 500 }) }, { strict: true })(input);
        if (parsed.request.target.mode !== 'background') throw new Error('This supervisor creates only its own background resources.');
        value = await service.exclusive(() => {
          if (service.store.all().some(record => {
            const job = service.store.get(record.snapshot.ref).request;
            return job.projectId === parsed.request.projectId && job.ideaId === parsed.request.ideaId && (!durableBuildTerminal(record.snapshot.phase) || record.terminationUnknown);
          })) throw new Error('The original request still has active or unknown worker ownership. Inspect it before copying reviewed code.');
          return materializer.materialize(parsed.request, parsed.protectedPaths);
        });
      }
      else if (op === 'inspectRetained' || op === 'recover') {
        const parsed = shape({ op: text(), ref: (raw: unknown) => workerRef(raw, identity.workerId, identity.epoch),
          inspected: (raw: unknown) => raw === undefined ? undefined : raw === true,
          minimumSequence: (raw: unknown) => raw === undefined ? undefined : number({ integer: true, min: 0, max: Number.MAX_SAFE_INTEGER - 1 })(raw),
          evidenceHash: (raw: unknown) => raw === undefined ? undefined : text({ pattern: /^[a-f0-9]{64}$/u })(raw),
        }, { strict: true })(input);
        value = await service.exclusive<unknown>(() => {
          if (op === 'inspectRetained') return recovery.inspect(parsed.ref);
          if (parsed.inspected !== true || parsed.minimumSequence === undefined || !parsed.evidenceHash) throw new Error('Explicit fresh inspection is required before verified recovery.');
          return recovery.recover(parsed.ref, true, parsed.minimumSequence, parsed.evidenceHash);
        });
      }
      else if (['start', 'inspect', 'cancel', 'acknowledge'].includes(op)) {
        const parsed = shape({ op: text(), ref: (raw: unknown) => workerRef(raw, identity.workerId, identity.epoch), sequence: (raw: unknown) => raw === undefined ? undefined : number({ integer: true, min: 0 })(raw) }, { strict: true })(input);
        if (op === 'start') value = await service.start(parsed.ref);
        else if (op === 'inspect') {
          const snapshot = service.inspect(parsed.ref);
          if (parsed.sequence === snapshot.sequence) { delete snapshot.conversation; if (!snapshot.workspaceCaptured) delete snapshot.increment; delete snapshot.result; }
          value = snapshot;
        }
        else if (op === 'cancel') value = await service.cancel(parsed.ref);
        else { if (parsed.sequence === undefined) throw new Error('The canonical result sequence is required.'); await service.acknowledge(parsed.ref, parsed.sequence); }
      } else if (op === 'workspaceReview' || op === 'workspaceAcknowledge') {
        const parsed = shape({ op: text(), workspaceId: text({ pattern: /^bg-[a-zA-Z0-9_-]+$/u }), attemptId: (raw: unknown) => raw === undefined ? undefined : text({ min: 1, max: 160 })(raw),
          increment: (raw: unknown) => raw === undefined ? undefined : durableBuildResultCheck({ increment: raw }).increment,
          reusable: (raw: unknown) => raw === undefined ? false : raw === true,
        }, { strict: true })(input);
        const matches = service.store.all().filter(item => item.snapshot.workspaceId === parsed.workspaceId);
        if (matches.some(item => !['completed', 'failed', 'cancelled'].includes(item.snapshot.phase) || item.terminationUnknown)) throw new Error('This workspace still has active or unverified worker ownership.');
        const job = parsed.attemptId ? matches.find(item => service.store.get(item.snapshot.ref).request.attemptId === parsed.attemptId)
          : matches.sort((a, b) => b.snapshot.createdAt.localeCompare(a.snapshot.createdAt))[0];
        if (!job) {
          const workspace = workflowWorkspaceRecordsCheck(await service.store.files.read('workspaces.json') ?? []).find(item => item.id === parsed.workspaceId);
          if (!workspace) throw new Error('The original operator workspace is unavailable.');
          await operatorWorkspaceRecord(service.store.files, workspace);
          if (op === 'workspaceReview') await workspaces.assertReviewable(parsed.workspaceId, parsed.increment);
          else { if (!parsed.attemptId || parsed.attemptId !== workspace.lastAttemptId) throw new Error('The operator resource identity changed.'); await workspaces.acknowledge(parsed.workspaceId, parsed.attemptId, parsed.reusable); }
          reply(response, 200, { ok: true, value: null }); return;
        }
        if (!['completed', 'failed', 'cancelled'].includes(job.snapshot.phase) || job.terminationUnknown) throw new Error('This workspace still has active or unverified worker ownership.');
        if (op === 'workspaceReview') await workspaces.assertReviewable(parsed.workspaceId, parsed.increment);
        else { if (parsed.attemptId !== service.store.get(job.snapshot.ref).request.attemptId) throw new Error('The workspace attempt identity changed.'); await workspaces.acknowledge(parsed.workspaceId, parsed.attemptId, parsed.reusable); }
      } else throw new Error('Unsupported background worker operation.');
      reply(response, 200, { ok: true, value: value ?? null });
    })().catch(error => {
      const message = error instanceof Error && !/[/\\]/u.test(error.message) ? error.message.slice(0, 3900) : 'The background worker operation could not commit. Inspect its original private evidence.';
      if (!response.headersSent) reply(response, 400, { ok: false, error: message, ...(error instanceof DurableBuildCapacityError ? { code: 'CAPACITY' } : error instanceof PolishingCopyRetainedError ? { code: 'POLISHING_COPY_RETAINED' } : {}) }); else response.end();
    });
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.maxConnections = 16;
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolve(); }); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('The worker loopback endpoint is unavailable.');
  state.descriptor = workerDescriptorCheck({ ...identity, endpoint: 'http://127.0.0.1:' + address.port + '/v1', pid: process.pid, startedAt: new Date().toISOString() });
  return { descriptor: state.descriptor, close: async () => { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); }); } };
}
