import { expect as browserExpect } from '@playwright/test';
import { describe, expect } from 'vitest';
import { test } from './support/obsidian-fixture.ts';
import { ObsProductionSocketServer } from './support/obs-production-socket';

describe('OBS studio production in the contained host', () => {
  test('creates a blank studio, operates audio/recording/replay and persists a cue without starting a stream', async ({ obsidian }) => {
    const server = new ObsProductionSocketServer();
    await server.start();
    try {
      const type = `${obsidian.pluginId}-view-project-workbench`;
      let view = await obsidian.openView(type);
      let pages = view.getByRole('navigation', { name: 'Stream studio pages', exact: true });
      await pages.getByRole('button', { name: 'Setup', exact: true }).click();
      await view.getByRole('button', { name: 'Skip setup for now', exact: true }).click();
      await browserExpect(view.getByRole('button', { name: 'Skip setup for now', exact: true })).toHaveCount(0);
      await view.getByLabel('OBS WebSocket URL', { exact: true }).fill(server.endpoint);
      await view.getByLabel('Connect OBS when CoForge opens', { exact: true }).check();
      await view.getByRole('button', { name: 'Save OBS setup', exact: true }).click();
      await browserExpect(view.getByText('OBS connection and scenes saved.', { exact: true })).toBeVisible();
      await pages.getByRole('button', { name: 'Broadcast', exact: true }).click();
      await view.getByRole('button', { name: 'Connect OBS', exact: true }).click();
      await browserExpect(view.getByText('OBS connected. Review readiness before going live.', { exact: true })).toBeVisible();
      await pages.getByRole('button', { name: 'Setup', exact: true }).click();
      const setup = view.getByRole('region', { name: 'Create my studio', exact: true });
      await setup.getByRole('button', { name: 'Read OBS capabilities', exact: true }).click();
      await setup.getByLabel(/^Studio scene prefix/).fill('Contained');
      await setup.getByLabel('New studio source name', { exact: true }).fill('Contained microphone');
      await setup.getByLabel(/^Available source type/).selectOption('wasapi_input_capture');
      await setup.getByRole('button', { name: 'Add source to studio draft', exact: true }).click();
      await setup.getByRole('button', { name: 'Preview studio creation', exact: true }).click();
      await setup.getByLabel('Create the reviewed scenes and sources in this OBS installation', { exact: true }).check();
      await setup.getByRole('button', { name: 'Create reviewed studio', exact: true }).click();
      await browserExpect(setup.getByRole('heading', { name: 'Studio creation · confirmed', exact: true })).toBeVisible({ timeout: 30000 });
      expect(server.state.scenes.map(scene => scene.name)).toContain('Contained · Development');
      expect(server.state.inputs.map(input => input.inputName)).toEqual(['Contained microphone', 'Contained · Starting soon title', 'Contained · BRB title', 'Contained · Ending title']);
      expect(server.state.inputs.filter(input => input.inputKind === 'text_gdiplus_v3')).toHaveLength(3);

      await pages.getByRole('button', { name: 'Broadcast', exact: true }).click();
      const desk = view.getByRole('region', { name: 'Live production desk', exact: true });
      await desk.getByRole('button', { name: 'Mute Contained microphone', exact: true }).click();
      await browserExpect(desk.getByRole('button', { name: 'Unmute Contained microphone', exact: true })).toBeVisible();
      expect(server.state.muted).toBe(true);
      const outputs = desk.getByRole('region', { name: 'Recording and replay controls', exact: true });
      await outputs.getByRole('button', { name: 'Start recording', exact: true }).click();
      await browserExpect(outputs).toContainText('Recording ·');
      await outputs.getByRole('button', { name: 'Pause recording', exact: true }).click();
      await browserExpect(outputs.getByRole('button', { name: 'Resume recording', exact: true })).toBeVisible();
      await outputs.getByRole('button', { name: 'Resume recording', exact: true }).click();
      await outputs.getByRole('button', { name: 'Stop recording', exact: true }).click();
      await outputs.getByRole('button', { name: 'Start replay buffer', exact: true }).click();
      await outputs.getByRole('button', { name: 'Save replay', exact: true }).click();
      await expect.poll(() => server.state.lastReplay).toBe('C:/Recordings/replay.mkv');
      await outputs.getByRole('button', { name: 'Stop replay buffer', exact: true }).click();

      await pages.getByRole('button', { name: 'Show plan', exact: true }).click();
      const show = view.getByRole('region', { name: 'Show plans and cues', exact: true });
      await show.getByRole('button', { name: 'Create show plan', exact: true }).click();
      await show.getByLabel('Show plan name', { exact: true }).fill('Contained production');
      await show.getByLabel(/^Action to add/).selectOption('mute');
      await show.getByLabel(/^Target input/).selectOption({ label: 'Contained microphone' });
      await show.getByLabel('Mute this input', { exact: true }).uncheck();
      await show.getByRole('button', { name: 'Add action to cue', exact: true }).click();
      await show.getByRole('button', { name: 'Save show plan', exact: true }).click();
      await show.getByRole('button', { name: 'Run selected cue', exact: true }).click();
      await expect.poll(() => server.state.muted).toBe(false);
      await show.getByRole('button', { name: 'Resume event cues', exact: true }).click();
      await browserExpect(show.getByRole('button', { name: 'Pause event cues', exact: true })).toBeVisible();
      await obsidian.screenshot('obs-production-show');

      const before = server.state.requests.filter(request => !request.type.startsWith('Get')).length;
      await obsidian.reloadPlugin();
      view = await obsidian.openView(type);
      pages = view.getByRole('navigation', { name: 'Stream studio pages', exact: true });
      await pages.getByRole('button', { name: 'Show plan', exact: true }).click();
      await browserExpect(view.getByLabel(/^Saved show plan/)).toContainText('Contained production');
      await view.getByLabel(/^Saved show plan/).selectOption({ label: 'Contained production' });
      await view.getByRole('button', { name: 'Load show plan', exact: true }).click();
      await browserExpect(view.getByRole('region', { name: 'Show plans and cues', exact: true })).toContainText('Event cues are paused.');
      expect(server.state.requests.filter(request => !request.type.startsWith('Get')).length).toBe(before);
      expect(server.state.requests.some(request => request.type === 'StartStream' || request.type === 'GetStreamServiceSettings')).toBe(false);
      expect(obsidian.errors()).toEqual([]);
    } finally { await server.close(); }
  });
});
