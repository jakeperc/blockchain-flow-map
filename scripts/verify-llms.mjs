/**
 * The gate for llms.txt, methodology.md and the page's plain-text surfaces: the same render the build does
 * (scripts/llms/render.mjs), over the lib/atlas modules verify-all.mjs has already compiled into argv[2], so a
 * reworded page, a renamed label, a new chain or a hand-typed number fails here, before Vite runs.
 *
 * The output files themselves only exist after the build; the plugin in vite.live.config.ts checks them on disk
 * (verifyBuilt) once they are written. `node scripts/llms/render.mjs --dist` repeats that check by hand.
 *
 *   node scripts/verify-llms.mjs <compiled-modules-dir>
 */
import {renderAll, loadCompiled, selfTest, METHOD_EXT} from './llms/render.mjs';

const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/verify-llms.mjs <compiled-modules-dir>');
  process.exit(2);
}
try {
  selfTest();
  const r = renderAll({atlas: loadCompiled(out), strict: true});
  for (const w of r.warnings) console.warn('WARN', w);
  if (!r.facts) throw new Error('the "Current state" block could not be stamped from the code, so the gate cannot vouch for the file');
  const llms = r.files['llms.txt'];
  const method = r.files[`methodology${METHOD_EXT}`];
  console.log(
    `PASS: llms.txt (${Buffer.byteLength(llms)} of 10240 bytes, ASCII, ${r.trace.length} quoted sentences found in the page's source, `
    + `${r.facts.chains.length} chains and ${r.facts.registry.addresses} registry addresses stamped as of ${r.facts.asOf}), `
    + `methodology${METHOD_EXT} (${Buffer.byteLength(method)} bytes, no internal references), head tags and <noscript> block`,
  );
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
