import type { StudioService } from './application/studio';
/** Consumer-facing application contract. Storage, worker internals and lifecycle belong to runtime composition. */
export type CoforgeApplication = Pick<StudioService,
  'getEconomy' | 'saveEconomyConfiguration' | 'fulfillEconomyPerk' |
  'previewExampleCleanup' | 'removeExampleContent' | 'exampleCleanupWarning' |
  'saveWorkflow' | 'startWorkflow' | 'runWorkflowStep' | 'completeWorkflowManual' | 'stopWorkflow' | 'acknowledgeWorkflowNudge' |
  'ready' | 'state' | 'subscribe' | 'onEvent' | 'integration' | 'sendChat' | 'ingest' | 'simulate' | 'openStreamStudio' | 'openTwitchBranding' | 'updateStreamSetup' |
  'blockPlayer' | 'updateCommunitySettings' | 'saveStreamMessage' | 'activateStreamMessage' | 'removeStreamMessage' |
  'createProject' | 'updateProject' | 'selectProject' | 'createIdea' | 'updateRequestValues' | 'vote' | 'act' | 'adjustRice' |
  'runNext' | 'cancel' | 'updateSettings' | 'updateIntegration' | 'refreshRuntime' | 'loadSample' | 'exportJson'>;
export type { StudioEvent, StudioEventListener, StudioEventSink } from './application/studio-events';
export type { ChatSenderPort, PlayerModerationPort, LivePresencePort, ModerationReceipt } from './application/integration-ports';
export type { CommunityEnvironment, NamedRank } from './domain/community-environment';
export type { Player, PopulationState, EconomyRules } from './domain/population';
export type { AppState, StudioProject } from './domain/types';
export type { ObsControlPort } from './application/obs-port';
export type { ObsActions, ObsSnapshot, ObsSettings, ObsPublicState } from './domain/obs';
