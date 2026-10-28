export interface McpStatus {
  active: boolean;
  message: string;
  recovery?: Array<{ projectId: string; taskId: string; ideaId: string; step: string }>;
}
export interface McpActions {
  status(): McpStatus;
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  recover?(taskId: string): Promise<void>;
}
