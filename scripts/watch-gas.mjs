import { watch } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const gasDir = resolve(root, 'appsscript');

let debounce = null;

function push() {
  try {
    console.log('\x1b[36m[watch:gas]\x1b[0m Change detected — running clasp push…');
    execSync('clasp push', { cwd: root, stdio: 'inherit' });
    console.log('\x1b[32m[watch:gas]\x1b[0m Push complete ✓\n');
  } catch {
    console.error('\x1b[31m[watch:gas]\x1b[0m Push failed ✗\n');
  }
}

console.log(`\x1b[36m[watch:gas]\x1b[0m Watching ${gasDir} for changes…`);
console.log('\x1b[36m[watch:gas]\x1b[0m Running initial push…\n');
push();

watch(gasDir, { recursive: true }, (_event, filename) => {
  if (!filename) return;
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    console.log(`\x1b[36m[watch:gas]\x1b[0m File changed: ${filename}`);
    push();
  }, 500);
});
