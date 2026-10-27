import type {
  HerdrAgent,
  HerdrObservation,
  HerdrPane,
  HerdrRecord,
  HerdrReview,
  HerdrSettings,
  HerdrState,
} from "../domain/herdr";
export interface HerdrSaved {
  settings: HerdrSettings;
  records: HerdrRecord[];
}
export interface HerdrStorage {
  load(): Promise<HerdrSaved>;
  save(value: HerdrSaved): Promise<void>;
}
export interface HerdrGateway {
  read(settings: HerdrSettings): Promise<HerdrObservation>;
  sameDirectory(left: string, right: string): Promise<boolean>;
  createWorkspace(
    settings: HerdrSettings,
    path: string,
    name: string,
  ): Promise<void>;
  startAgent(
    settings: HerdrSettings,
    pane: HerdrPane,
    provider: string,
  ): Promise<void>;
  focus(settings: HerdrSettings, target: HerdrAgent): Promise<void>;
  interrupt(settings: HerdrSettings, target: HerdrAgent): Promise<void>;
  send(
    settings: HerdrSettings,
    target: HerdrAgent,
    prompt: string,
  ): Promise<void>;
  dispose(): void;
}
export interface HerdrActions {
  snapshot(): HerdrState;
  subscribe(listener: (state: HerdrState) => void): () => void;
  configure(settings: HerdrSettings): Promise<void>;
  refresh(): Promise<void>;
  review(ideaId: string, paneId: string): HerdrReview;
  send(review: HerdrReview): Promise<void>;
  createWorkspace(projectId: string): Promise<void>;
  startAgent(
    projectId: string,
    paneId: string,
    provider: string,
  ): Promise<void>;
  focus(paneId: string): Promise<void>;
  interrupt(target: HerdrAgent): Promise<void>;
  acknowledge(id: string): Promise<void>;
}
