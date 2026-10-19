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
