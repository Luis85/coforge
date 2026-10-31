import { main } from './runtime';
export { main } from './runtime';
if (process.argv[2] === '--coforge-worker') void main().catch(() => { process.exitCode = 1; });
