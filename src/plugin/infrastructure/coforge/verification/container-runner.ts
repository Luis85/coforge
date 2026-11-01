/** Trusted, read-only PID-1 companion. Test code runs as a different, unprivileged UID. */
export const VERIFICATION_CONTAINER_RUNNER = String.raw`'use strict';
const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const input = JSON.parse(fs.readFileSync('/coforge/command.json', 'utf8'));
const deadline = setTimeout(() => process.exit(124), input.timeoutSeconds * 1000);
function writable(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes:true })) {
    const target = path.join(directory, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) writable(target);
    fs.chmodSync(target, (fs.statSync(target).mode & 0o777) | (item.isDirectory() ? 0o700 : 0o600));
  }
}
// Copy without executing project code, as the same UID that will own test outputs.
process.setegid(65534);
process.seteuid(65534);
fs.cpSync('/source', '/work', { recursive:true, dereference:false });
writable('/work');
if (fs.existsSync('/opt/coforge/node_modules')) fs.symlinkSync('/opt/coforge/node_modules', '/work/node_modules', 'dir');
fs.mkdirSync('/tmp/home', { recursive:true, mode:0o700 });
// The controller retains a distinct UID, so test code cannot stop its deadline.
process.seteuid(0);
process.setegid(0);
const child = cp.spawn(input.executable, input.args, {
  cwd:'/work', uid:65534, gid:65534, shell:false, stdio:['ignore','inherit','inherit'],
  env:{ PATH:'/work/node_modules/.bin:/usr/local/bin:/usr/bin:/bin', HOME:'/tmp/home', TMPDIR:'/tmp',
    CI:'true', npm_config_cache:'/tmp/npm-cache', npm_config_update_notifier:'false', npm_config_audit:'false',
    npm_config_fund:'false', npm_config_offline:'true' }
});
child.once('error', () => { clearTimeout(deadline); process.exit(127); });
child.once('exit', (code) => { clearTimeout(deadline); process.exit(Number.isInteger(code) ? code : 125); });
`;
