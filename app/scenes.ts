import manifest from "../public/scenes.json";

export type SceneMeta = {
  camera: string;
  lens: string;
  exposure: string;
  dimensions: string;
  date: string;
};

export type SceneEntry = {
  name: string;
  sog: string;
  thumb: string;
  aspect: number;
  focus: number;
  fov: number;
  maxParallax: number;
  caption: string;
  meta: SceneMeta;
};

export const scenes: SceneEntry[] = (manifest as SceneEntry[]).map((entry) => ({
  ...entry,
  sog: `/${entry.sog}`,
  thumb: `/${entry.thumb}`,
}));

export function sceneIndex(name: string): number {
  return scenes.findIndex((entry) => entry.name === name);
}
