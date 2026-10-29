import { boolean, list, number, oneOf, optional, record, shape, text, timestamp, type Check } from './check';
import { obsInputSettingsCheck, obsVideoSettingsCheck } from './obs-production-check';
import { OBS_SETUP_ROLES, type ObsSetupInput, type ObsSetupState } from './obs-setup';

const name = text({ trim: true, min: 1, max: 100 });
export const obsSetupInputCheck: Check<ObsSetupInput> = shape({
  prefix: text({ trim: true, max: 50 }), video: optional(obsVideoSettingsCheck), recordDirectory: optional(text({ min: 1, max: 1000 })),
  outputPreset: optional(shape({ preset: oneOf(['balanced', 'quality']), replayEnabled: boolean, replaySeconds: number({ integer: true, min: 5, max: 300 }) }, { strict: true })),
  sources: list(shape({ name, inputKind: text({ min: 1, max: 100 }), settings: obsInputSettingsCheck,
    roles: list(oneOf(OBS_SETUP_ROLES), { min: 1, max: 6 }), enabled: boolean }, { strict: true }), { max: 30 }),
  service: optional(shape({ service: oneOf(['Twitch', 'Custom']), server: text({ min: 1, max: 1000 }),
    keySecret: text({ pattern: /^coforge-obs-output-[a-zA-Z0-9_-]{1,80}$/ }) }, { strict: true })),
}, { strict: true });
const scenes: Check<Record<string, string>> = value => Object.fromEntries(Object.entries(record(value)).map(([key, id]) => {
  oneOf(OBS_SETUP_ROLES)(key);
  return [key, text({ min: 1, max: 300 })(id)];
}));
export const obsSetupStateCheck: Check<ObsSetupState> = shape({
  id: text({ min: 1, max: 100 }), startedAt: timestamp, status: oneOf(['running', 'confirmed', 'failed', 'uncertain', 'acknowledged']),
  completed: list(text({ min: 1, max: 200 }), { max: 250 }), pendingStep: optional(text({ min: 1, max: 200 })),
  total: number({ integer: true, min: 1, max: 250 }), scenes, lastError: optional(text({ max: 1000 })),
});
