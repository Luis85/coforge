import type { Increment } from '../domain/types';

/** Native SDK observations are distinct from legacy isolated command records and final-source acceptance. */
export function nativeCodingIncrement(increment: Increment): Increment {
  const captured = { ...increment, tests: [...increment.tests.filter(note => !note.startsWith('Not run: shell tools are disabled.')),
    'Native coding profile: inspect recorded native SDK observations and agent-reported checks. These do not establish final-source coverage or every acceptance criterion. This profile did not run isolated host verification.'] };
  delete captured.verification; delete captured.verificationSourceHash;
  return captured;
}
