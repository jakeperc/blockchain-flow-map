/**
 * The project's own addresses, in one place. The page (components/atlas.tsx), the Landmarks renderer
 * (scripts/landmarks/html.mjs) and the llms build (scripts/llms/render.mjs, which reads this file as text) all take
 * them from here, so a moved repository or a changed profile is one edit. Every external link the published
 * llms.txt carries must be one the page itself links, and the build checks that against this file too.
 */
export const AUTHOR='Jake Percy';
export const HUB_URL='https://jakepercy.com/';
export const REPO_URL='https://github.com/jakeperc/blockchain-flow-map';
/** Empty until supplied; the pages render the link only when it is set. */
export const LINKEDIN_URL='';
/**
 * The shared history recorder's address (decision D8, worker/), ending in a slash. While it is empty the page never
 * contacts it and behaves exactly as before: 24H and 7D come from this browser's own recorded history alone. Set on
 * 2026-10-27, after the recorder's spans were compared with a browser's own for the same quarter hours
 * (docs/measurements/2026-10-27/).
 */
export const RECORDER_URL='https://bfm-recorder.jakepercy.workers.dev/';
