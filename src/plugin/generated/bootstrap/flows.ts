
import type { Pinia } from 'pinia';
import type { Sources } from '../application/sources.ts';
import type { Flow } from '../presentation/context/project.ts';
export const bindFlows: (sources: Sources, pinia: Pinia) => Flow[] = () => [];
