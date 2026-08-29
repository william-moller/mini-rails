/**
 * BGA component libraries, fetched from BGA's own CDN at runtime.
 *
 * Loaded here and only here. importEsmLib() is a top-level await, so keeping the calls in one module
 * means one load per lib no matter how many files use it, and the awaits do not spread through the
 * rest of the source.
 *
 * ⚠️ components.ts must never import this file. It has to stay loadable by scripts/preview/ in a
 * plain browser with no BGA globals, and importEsmLib is a BGA global.
 *
 * Typings are the bga-*.d.ts stubs at the repo root, published by BGA. They are dev-only and not in
 * the deploy allowlist, so they never reach the server.
 *
 * bga-zoom: zoom controls (a magnifying glass with + and -) plus autoscale.
 *   https://en.doc.boardgamearena.com/Zoom
 */

import type { BgaZoom as BgaZoomType } from "../../bga-zoom";

const BgaZoom: typeof BgaZoomType = await importEsmLib('bga-zoom', '1.x');

export { BgaZoom };
