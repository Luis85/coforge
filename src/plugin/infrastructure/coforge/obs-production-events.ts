const changed = new Set([
  'SceneCreated', 'SceneRemoved', 'SceneNameChanged', 'SceneListChanged',
  'CurrentProgramSceneChanged', 'CurrentPreviewSceneChanged', 'CurrentSceneCollectionChanging', 'CurrentSceneCollectionChanged',
  'InputCreated', 'InputRemoved', 'InputNameChanged', 'InputSettingsChanged',
  'SceneItemCreated', 'SceneItemRemoved', 'SceneItemListReindexed', 'SceneItemEnableStateChanged', 'SceneItemLockStateChanged', 'SceneItemTransformChanged',
  'InputMuteStateChanged', 'InputVolumeChanged', 'InputAudioSyncOffsetChanged', 'InputAudioTracksChanged', 'InputAudioMonitorTypeChanged',
  'StudioModeStateChanged', 'CurrentSceneTransitionChanged', 'CurrentSceneTransitionDurationChanged',
  'SourceFilterCreated', 'SourceFilterRemoved', 'SourceFilterNameChanged', 'SourceFilterSettingsChanged', 'SourceFilterEnableStateChanged', 'SourceFilterListReindexed',
  'StreamStateChanged', 'RecordStateChanged', 'ReplayBufferStateChanged', 'VirtualcamStateChanged', 'CurrentProfileChanging', 'CurrentProfileChanged',
]);
export const changesProductionContext = (type: string): boolean => changed.has(type);
/** Ordinary v5 control events plus transform invalidation, without unsolicited audio meter traffic. */
export const OBS_PRODUCTION_EVENTS = 2047 | (1 << 19);
