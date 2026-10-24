

import type { Services } from "../../bootstrap/services.ts";
import type { Sources, SourcePorts } from '../application/sources.ts';
import { validateSourceOverrides } from '../application/source-overrides.ts';
export function createSources(shell: Services, overrides: Partial<SourcePorts> = {}): Sources {
 validateSourceOverrides(overrides,{});
 
 return {}; }
