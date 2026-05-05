/**
 * GitHub project Pages are served under https://user.github.io/REPO/.
 * Expo often emits root-absolute URLs (/ _expo/, /favicon.ico) which hit the wrong origin path.
 * Inject <base href="/REPO/"> and rewrite those URLs so every HTML route loads assets correctly.
 *
 * Set EXPO_BASE_URL=/repo-name (no trailing slash). Skip when "/" or unset.
 */
const fs = require('fs');
const path = require('path');

const raw = (process.env.EXPO_BASE_URL || '').trim();
const base = raw.replace(/\/$/, '');
if (!base || base === '/') {
  console.log('patch-web-base-path: skip (no subpath base)');
  process.exit(0);
}

const baseHref = `${base}/`;

function patchHtml(content) {
  const needs =
    content.includes('src="/_expo/') ||
    content.includes('href="/_expo/') ||
    content.includes('href="/favicon');
  if (!needs) return content;

  let s = content;
  if (!/<base\s/i.test(s) && /<head[^>]*>/i.test(s)) {
    s = s.replace(/<head([^>]*)>/i, `<head$1>\n    <base href="${baseHref}" />`);
  }
  s = s.replace(/src="\/_expo\//g, 'src="_expo/');
  s = s.replace(/href="\/_expo\//g, 'href="_expo/');
  s = s.replace(/href="\/favicon\.ico"/g, 'href="favicon.ico"');
  return s;
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      walk(p);
    } else if (ent.name.endsWith('.html')) {
      const before = fs.readFileSync(p, 'utf8');
      const after = patchHtml(before);
      if (after !== before) {
        fs.writeFileSync(p, after);
        console.log('patched', path.relative(path.join(__dirname, '..'), p));
      }
    }
  }
}

const dist = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(dist)) {
  console.error('patch-web-base-path: dist/ missing — run expo export first');
  process.exit(1);
}
walk(dist);
console.log('patch-web-base-path: done');
