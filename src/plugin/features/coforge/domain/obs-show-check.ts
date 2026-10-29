import { boolean, list, number, oneOf, optional, record, shape, text, timestamp, type Check } from './check';
import { OBS_SHOW_EVENTS, type ObsShowPlan, type ObsShowState, type ObsShowStep } from './obs-show';
import { obsOverlayDefinitionCheck } from './obs-overlay';

const id = text({ min: 1, max: 300 });
const definitionId = text({ min: 1, max: 100, pattern: /^[a-zA-Z0-9_-]+$/ });
const title = text({ trim: true, min: 1, max: 150 });
export const obsShowStepCheck: Check<ObsShowStep> = value => {
  const kind = record(value).kind;
  switch (kind) {
    case 'scene': return shape({ kind: oneOf(['scene']), sceneId: id }, { strict: true })(value);
    case 'mute': return shape({ kind: oneOf(['mute']), inputId: id, muted: boolean }, { strict: true })(value);
    case 'volume': return shape({ kind: oneOf(['volume']), inputId: id, volumeDb: number({ min: -100, max: 26 }) }, { strict: true })(value);
    case 'record': return shape({ kind: oneOf(['record']), action: oneOf(['start', 'stop', 'pause', 'resume']) }, { strict: true })(value);
    case 'replay-save': return shape({ kind: oneOf(['replay-save']) }, { strict: true })(value);
    case 'media': return shape({ kind: oneOf(['media']), inputId: id, action: oneOf(['play', 'pause', 'stop', 'restart', 'next', 'previous']) }, { strict: true })(value);
    case 'source-visible': return shape({ kind: oneOf(['source-visible']), sceneId: id, itemId: number({ integer: true, min: 0 }), enabled: boolean }, { strict: true })(value);
    case 'transition': return shape({ kind: oneOf(['transition']), sceneId: id, name: title, duration: number({ integer: true, min: 50, max: 20000 }) }, { strict: true })(value);
    case 'marker': return shape({ kind: oneOf(['marker']), label: title }, { strict: true })(value);
    case 'overlay': return shape({ kind: oneOf(['overlay']), overlayId: definitionId }, { strict: true })(value);
    default: throw new Error('Choose a supported production cue action.');
  }
};
const segment = shape({ id: definitionId, name: title, note: text({ max: 4000 }), durationSeconds: number({ integer: true, min: 0, max: 14400 }), steps: list(obsShowStepCheck, { max: 30 }) }, { strict: true });
const binding = shape({ id: definitionId, event: oneOf(OBS_SHOW_EVENTS), cueId: definitionId, enabled: boolean }, { strict: true });
const plan = shape({ id: definitionId, name: title, segments: list(segment, { min: 1, max: 50 }), bindings: list(binding, { max: 30 }) }, { strict: true });
function unique(values: readonly string[]): boolean { return new Set(values).size === values.length; }
export const obsShowPlanCheck: Check<ObsShowPlan> = value => {
  const result = plan(value);
  if (!unique(result.segments.map(item => item.id)) || !unique(result.bindings.map(item => item.id))) throw new Error('Cue and event binding identifiers must be unique.');
  if (result.bindings.some(item => !result.segments.some(cue => cue.id === item.cueId))) throw new Error('Every event binding must name a cue in this plan.');
  return result;
};
const run = shape({
  id, planId: definitionId, cueId: definitionId, name: title, durationSeconds: number({ integer: true, min: 0, max: 14400 }), startedAt: timestamp, finishedAt: optional(timestamp),
  status: oneOf(['running', 'confirmed', 'failed', 'uncertain', 'acknowledged']),
  steps: list(shape({ action: obsShowStepCheck, status: oneOf(['pending', 'confirmed', 'failed', 'uncertain', 'skipped']) }), { max: 30 }),
  error: optional(text({ max: 1000 })), eventSequence: optional(number({ integer: true, min: 1 })),
});
export const obsShowStateCheck: Check<ObsShowState> = shape({
  plans: list(obsShowPlanCheck, { max: 100 }), history: list(run, { max: 100 }), run: optional(run), automationEnabled: boolean,
  lastEventSequence: number({ integer: true, min: 0 }), markers: list(shape({ id, label: title, at: timestamp, runId: optional(id) }), { max: 200 }),
  lastTrigger: optional(shape({ event: oneOf(OBS_SHOW_EVENTS), sequence: number({ integer: true, min: 1 }), reason: oneOf(['paused', 'offline', 'busy', 'no-binding', 'partial', 'completed', 'failed']) })),
  outputFiles: optional(list(shape({ id, at: timestamp, kind: oneOf(['recording', 'replay']), path: text({ min: 1, max: 4096 }), sceneId: optional(id), obsEpoch: number({ integer: true, min: 0 }), timecode: text({ max: 100 }), broadcastActive: boolean }), { max: 200 })),
  outputRestartRequired: optional(boolean),
  overlays: optional(list(obsOverlayDefinitionCheck, { max: 100 })),
});
