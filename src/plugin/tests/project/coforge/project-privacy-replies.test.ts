import { afterEach, expect, it, vi } from 'vitest';
import { StudioService } from '../../../features/coforge/application/studio';
import { BotDeliveryWorker } from '../../../features/coforge/application/bot-delivery';
import { MemoryStorage, nodeTimers } from './memory-storage';
const services: StudioService[] = [];
afterEach(async () => { await Promise.all(services.splice(0).map(service => service.stop())); vi.useRealTimers(); });
async function setup() {
  const timers = nodeTimers(); const storage = new MemoryStorage();
  const studio = new StudioService(storage, { timers, runners: { demo: async () => ({}), claude: async () => ({}) }, probeRuntime: async () => ({ cliAvailable: false, projectPath: null, allowImplementation: false }) });
  services.push(studio); await studio.start();
  const project = await studio.createProject({ projectName: 'Secret after revocation', projectBrief: 'A previously public project that will become private.', projectPath: '/synthetic/project' });
  await studio.updateIntegration({ twitchEnabled: true, twitchBroadcasterId: '123', twitchBotReplies: true });
  return { studio, storage, project, timers };
}
it('cancels queued derived replies before transport after revocation while retaining authored raw chat text', async () => {
  vi.useFakeTimers(); const { studio, project, timers } = await setup();
  await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: '!register', messageId: 'registration', channelId: '123' });
  await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: '!projects', messageId: 'discovery', channelId: '123' });
  await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: 'Viewer-authored Secret after revocation is unchanged.', messageId: 'authored', channelId: '123' });
  expect(studio.state().botReplies?.find(reply => reply.id === 'twitch:discovery')?.publicProjectIds).toEqual([project.id]);
  await studio.updateProject({ visibility: 'private' }, project.id);
  expect(studio.state().botReplies?.find(reply => reply.id === 'twitch:discovery')?.status).toBe('cancelled');
  const send = vi.fn(async () => 'sent');
  const worker = new BotDeliveryWorker(studio, { send }, () => true, () => ({ id: '123', login: 'streamer', scopes: [] }), () => {}, timers);
  try {
    worker.wake(); await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledOnce();
    expect(JSON.stringify(send.mock.calls)).not.toContain(project.settings.projectName);
    expect(studio.state().chat.some(message => message.text === 'Viewer-authored Secret after revocation is unchanged.')).toBe(true);
  } finally { await worker.stop(); }
});
it('withholds private or unknown request-derived progression and never exposes a hidden intake ID on replay', async () => {
  const { studio, project } = await setup();
  await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: '!register' });
  const request = await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: `!request ${project.id} A genuine request before privacy changes`, messageId: 'request-once', channelId: '123' });
  await studio.store.transaction(state => { const player = state.population.players.find(player => player.id === 'twitch:81')!; player.rewardClaims.push(`accepted:${request.ideaId}`); player.xp = 9999; player.reputation = 777; });
  await studio.updateProject({ visibility: 'private' }, project.id);
  const me = await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: '!me' });
  expect(me.message).toContain('Progression details are unavailable in public chat');
  expect(me.message).not.toContain('9999'); expect(me.message).not.toContain('777');
  const replay = await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: `!request ${project.id} A genuine request before privacy changes`, messageId: 'request-once', channelId: '123' });
  expect(replay).toEqual({ ok: false, message: 'This project or request is unavailable.' });
  expect(studio.state().ideas).toHaveLength(1);
});

it('binds queued shop affordability to public project visibility and cancels it before transport', async () => {
  const { studio, project } = await setup();
  await studio.ingest({ source: 'twitch', userId: '81', username: 'Viewer', text: '!shop', messageId: 'shop-once', channelId: '123' });
  expect(studio.state().botReplies?.find(reply => reply.id === 'twitch:shop-once')?.publicProjectIds).toEqual([project.id]);
  await studio.updateProject({ visibility: 'private' }, project.id);
  expect(studio.state().botReplies?.find(reply => reply.id === 'twitch:shop-once')?.status).toBe('cancelled');
});
