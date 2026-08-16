# stills.

Photographs rebuilt as walk-around 3D scenes.

Live at [stills-1hk.pages.dev](https://stills-1hk.pages.dev)

Every photo on the wall is a single still image turned into 1,179,648 gaussians by [Apple SHARP](https://github.com/apple/ml-sharp), then rendered live in WebGL. Hover a photo and it gains depth under your cursor. Click it and it expands into a detail view that drifts on its own, with the camera easing along a Lissajous curve until you take over.

## How a photo becomes a scene

The generation pipeline runs offline; this repo holds the site and the finished assets.

1. `prepare_photos.py` center-crops originals to 3:4 and converts them to sRGB
2. `sharp predict` turns each photo into a gaussian splat (~27s per photo on Apple Silicon)
3. [`@playcanvas/splat-transform`](https://github.com/playcanvas/splat-transform) compresses each `.ply` to a `.sog`
4. `build_scenes.py` writes `scenes.json` with per-scene focus depth, exact FOV from the ply camera intrinsics, and EXIF metadata

The viewer (`app/splat-viewer.ts`) keeps one scene in GPU memory at a time, gates each reveal on actual rendered pixels so a wrong frame can never flash, and idles the render loop when nothing moves.

## Stack

- Next.js 16, static export
- [three.js](https://threejs.org) 0.180 + [Spark](https://sparkjs.dev) 2.1 for splat rendering
- CSS View Transitions for the wall-to-detail morph
- Plain CSS, no UI libraries

## Develop

```sh
pnpm install
pnpm dev
```

## Deploy

Hosted on Cloudflare Pages as a direct-upload project, so deploys are explicit:

```sh
pnpm build && npx wrangler pages deploy
```

## Credits

Photos are mine. Scene prediction by [apple/ml-sharp](https://github.com/apple/ml-sharp), released for research use; this demo is non-commercial.
