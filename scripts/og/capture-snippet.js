/**
 * Captures the link-preview image (public/og.jpg): the globe's cartography only. Paste this whole file into the
 * browser console on the dev server with the renderer debug flag on, once the land has drawn:
 *
 *   pnpm dev:live
 *   open http://localhost:5173/?debug=map in a window about 1200 x 900 CSS px, wait for the globe
 *   paste this file into the console
 *
 * It hides every data layer (anchors, routes, particles, halos, beams), zeroes the per-country activity table that
 * brightens land dots, draws one frame, crops the canvas to 1200 x 630 around the globe and POSTs the JPEG to the
 * dev server's capture sink (vite.live.config.ts, dev only), which writes public/og.jpg. The image then carries no
 * route, no figure and no activity: only land, outlines, the graticule and the real day-night line at capture time.
 * Re-capture after a design change to the globe; registry changes never affect it.
 */
(async () => {
  const group = window.__atlasScene?.children[0];
  if (!group || typeof window.__atlasBench !== 'function') throw new Error('open the page with ?debug=map and wait for the globe');
  const byUniform = (names) => group.children.filter((o) => o.material?.uniforms && names.every((n) => n in o.material.uniforms));
  const land = byUniform(['uCountryTex', 'uReveal'])[0];
  const keep = new Set([...byUniform(['uBody']), ...byUniform(['uAtmo']), land, ...group.children.filter((o) => o.type === 'LineSegments')]);
  for (const o of group.children) o.visible = keep.has(o);
  // One RGBA texel per country: red is the activity that brightens its dots, blue and alpha are the base lookup.
  const table = land.material.uniforms.uCountryTex.value, texels = table.image.data;
  for (let i = 0; i < texels.length; i += 4) { texels[i] = 0; texels[i + 1] = 0; }
  table.needsUpdate = true;
  await window.__atlasBench(1, { force: true });
  const canvas = document.querySelector('.world-map canvas');
  const out = document.createElement('canvas');
  out.width = 1200;
  out.height = 630;
  // Cover-fit a 1200 x 630 band on the globe's centre (the map area's centre), in device pixels. A viewport about
  // 1200 x 900 CSS px gives a globe that fills roughly three quarters of the band.
  const area = document.querySelector('.map-area').getBoundingClientRect(), box = canvas.getBoundingClientRect();
  const scale = canvas.height / box.height, cy = (area.top + area.height / 2 - box.top) * scale, cx = canvas.width / 2;
  let sw = canvas.width, sh = Math.round((sw * 630) / 1200);
  if (sh > canvas.height) { sh = canvas.height; sw = Math.round((sh * 1200) / 630); }
  const sx = Math.round(Math.min(Math.max(0, cx - sw / 2), canvas.width - sw)), sy = Math.round(Math.min(Math.max(0, cy - sh / 2), canvas.height - sh));
  // The globe is rendered dark by design (land brightens only with activity, which is zeroed here), so the capture
  // is exposed up, the way a photograph of the same scene would be. Nothing in the picture carries data.
  const ctx = out.getContext('2d');
  ctx.filter = 'brightness(2.1) contrast(1.15)';
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, 1200, 630);
  const blob = await new Promise((r) => out.toBlob(r, 'image/jpeg', 0.9));
  const res = await fetch('/__capture?name=og.jpg', { method: 'POST', body: blob });
  console.log(`og.jpg: ${blob.size} bytes, server said ${res.status} ${await res.text()}`);
})();
