import type { Metadata } from "next";
import Gallery from "../gallery";
import { sceneIndex, scenes } from "../scenes";

export const dynamicParams = false;

export function generateStaticParams() {
  return scenes.map((entry) => ({ name: entry.name }));
}

export async function generateMetadata({ params }: PageProps<"/[name]">): Promise<Metadata> {
  const { name } = await params;
  return { title: `${scenes[sceneIndex(name)].title} · stills.` };
}

export default async function ScenePage({ params }: PageProps<"/[name]">) {
  const { name } = await params;
  return <Gallery initialScene={name} />;
}
