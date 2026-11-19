# Strands: what drawing more lines costs (2026-11-19)

The globe drew one line per corridor, at most 32 on desktop. It now draws a corridor as one strand per
sender-and-receiver pair: up to 72 corridors and 160 lines on desktop, 32 and 56 on phones and tablets. This is what
that cost on the one machine it was measured on. It is a single desktop, so read the figures as "small", not as a
guarantee for other hardware.

## Method

- The page's own bench, `?debug=map` then `__atlasBench(300, {dpr: 2})` in the console: 300 frames driven
  synchronously, CPU time per frame from `performance.now()`, GPU time per frame from `EXT_disjoint_timer_query_webgl2`.
- Same machine, same browser pane, same viewport (1568 x 772 CSS px), the 7D window (107 corridors that hour), globe
  view, render scale 2. Each build was loaded fresh and warmed with 120 frames first.
- Before: `main` at `6072a3b`. After: this change.

## Result

| | Lines drawn | Draw calls | GPU per frame | Canvas |
|---|---|---|---|---|
| Before | 32 corridors, 32 lines | 11 | 1.33 and 1.64 ms (two runs) | 2232 x 828 |
| After | 72 corridors, 160 lines | 11 | 1.86 and 1.87 ms (two runs) | 2232 x 828 |
| After, larger canvas | 72 corridors, 160 lines | 11 | 1.93 to 2.03 ms (four runs) | 2604 x 966 to 2976 x 1104 |

CPU time per frame was about 1 ms in both builds and too noisy between runs to separate them (0.05 to 1.9 ms).

So five times the lines cost about 0.2 to 0.5 ms of GPU per frame at the same canvas size, against a 16.7 ms frame, with no extra draw call.

## Why it stays cheap

- Still three draw calls for every route however many strands there are: one ribbon geometry drawn twice (core and
  halo) and one particle system. The per-strand state moved from two uniform arrays to one small float texture, so the
  number of slots (192) is not tied to a GPU's uniform limit.
- A slot that draws nothing leaves the clip volume in the vertex shader, so empty slots, faded strands and hidden
  particles cost no rasterisation or blending. Before, every unused particle was still rasterised at zero alpha.
- Only a route's leading strand, and any wide one, takes part in the halo pass (2.8 times the width, additive), and
  only the leading strand carries the full particle count; the others carry two, or one after the frame-time governor
  demotes the tier.
- The per-strand texture is uploaded only on a frame that changed a value, and a strand's path is rewritten only while
  it is changing lane.

## Not measured

- A phone or an integrated GPU. The phone budget (32 corridors, 56 lines) was chosen to stay near the old 24 lines'
  fill, not measured on a device.
- The SVG compatibility renderer, which draws one line per corridor and now draws up to 72 of them on desktop.
