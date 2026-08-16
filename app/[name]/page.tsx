import type { Metadata } from "next";
import Gallery from "../gallery";
import { sceneIndex, scenes } from "../scenes";

export const dynamicParams = false;

export function generateStaticParams() {
  return scenes.map((entry) => ({ name: entry.name }));
}

export async function generateMetadata({ params }: PageProps<"/[name]">): Promise<Metadata> {
  const { name } = await params;
  const entry = scenes[sceneIndex(name)];
  const title = `${entry.title} · stills.`;
  const description = `one photograph rebuilt as a 3D scene you can look around inside. shot on ${entry.meta.camera}, ${entry.meta.date.toLowerCase()}.`;
  const image = entry.thumb;
  return {
    title,
    description,
    alternates: { canonical: `/${entry.name}/` },
    openGraph: {
      type: "article",
      siteName: "stills.",
      title,
      description,
      url: `/${entry.name}/`,
      images: [{ url: image, alt: entry.title }],
    },
    twitter: { card: "summary", title, description, images: [image] },
  };
}

export default async function ScenePage({ params }: PageProps<"/[name]">) {
  const { name } = await params;
  return <Gallery initialScene={name} />;
}
