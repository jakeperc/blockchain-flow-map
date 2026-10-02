/**
 * The Landmarks page's static fragments for the Vite plugin in vite.live.config.ts (dev and build): the model is built
 * and checked, then rendered. Any problem throws, so a page that breaks a rule is never served or built.
 */
import {ROOT, loadInputs, buildModel} from './build.mjs';
import {renderFragments, icon} from './html.mjs';

export function pageFragments(root = ROOT) {
  const {model, errors} = buildModel(loadInputs(root));
  if (errors.length) throw new Error(`landmarks: ${errors.length} problem(s)\n  - ${errors.join('\n  - ')}`);
  return {...renderFragments(model), globe: icon('globe', 26, 1.25)};
}
