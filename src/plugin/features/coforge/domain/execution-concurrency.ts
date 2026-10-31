import { number, shape } from './check';
import type { IntegrationSettings } from './types';

export interface ExecutionConcurrency { builds: number; shortTasks: number }
const slots = number({ integer: true, min: 1, max: 16 });
export const executionConcurrencyCheck = shape({ builds: slots, shortTasks: slots }, { strict: true });
export function executionConcurrency(integration: Pick<IntegrationSettings, 'executionConcurrency'>): ExecutionConcurrency {
  return integration.executionConcurrency ? executionConcurrencyCheck(integration.executionConcurrency) : { builds: 1, shortTasks: 1 };
}
