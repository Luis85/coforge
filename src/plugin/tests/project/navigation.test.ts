import { it, expect } from 'vitest';
import { createPinia, disposePinia } from 'pinia';
import { useNavigation } from "../../generated/presentation/stores/navigation.ts";

it('refuses unknown screens without changing state', () => { const pinia = createPinia(); try { const nav = useNavigation(pinia); const before = nav.current; expect(() => nav.open('missing')).toThrow('SCREEN_NOT_NAVIGABLE'); expect(nav.current).toBe(before); } finally { disposePinia(pinia); } });
