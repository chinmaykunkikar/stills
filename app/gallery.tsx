"use client";

import { useEffect, useRef, useState } from "react";
import {
  activateScene,
  deactivateScene,
  pointScene,
  type SceneEntry,
} from "./splat-viewer";

const HOVER_DELAY_MS = 220;
const LOADING_INDICATOR_DELAY_MS = 180;

export default function Gallery() {
  const [scenes, setScenes] = useState<SceneEntry[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(-1);
  const [liveIndex, setLiveIndex] = useState(-1);
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hoverTimer = useRef(0);
  const indicatorTimer = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch("scenes.json", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: SceneEntry[]) => {
        if (!cancelled) setScenes(data);
      })
      .catch((error) => console.error("failed to load scenes:", error));
    return () => {
      cancelled = true;
    };
  }, []);

  function deactivate() {
    window.clearTimeout(indicatorTimer.current);
    setLoadingIndex(-1);
    setLiveIndex(-1);
    deactivateScene();
  }

  async function activate(index: number) {
    const frame = frameRefs.current[index];
    if (!frame) return;
    indicatorTimer.current = window.setTimeout(
      () => setLoadingIndex(index),
      LOADING_INDICATOR_DELAY_MS,
    );
    try {
      const becameLive = await activateScene(scenes[index], frame);
      if (becameLive) setLiveIndex(index);
    } catch (error) {
      console.error("scene activation failed:", error);
    } finally {
      window.clearTimeout(indicatorTimer.current);
      setLoadingIndex((current) => (current === index ? -1 : current));
    }
  }

  function handleEnter(index: number) {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      deactivate();
      void activate(index);
    }, HOVER_DELAY_MS);
  }

  function handleLeave() {
    window.clearTimeout(hoverTimer.current);
    deactivate();
  }

  function handleMove(index: number, event: React.PointerEvent<HTMLDivElement>) {
    if (index !== liveIndex) return;
    const frame = frameRefs.current[index];
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    pointScene(nx, ny);
  }

  const columns: { entry: SceneEntry; index: number }[][] = [[], []];
  scenes.forEach((entry, index) => columns[index % 2].push({ entry, index }));

  return (
    <div className="stream">
      {columns.map((column, columnIndex) => (
        <div className={columnIndex === 1 ? "col offset" : "col"} key={columnIndex}>
          {column.map(({ entry, index }) => (
            <div
              key={entry.name}
              className={[
                "item",
                liveIndex === index ? "live" : "",
                loadingIndex === index ? "loading" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onPointerEnter={() => handleEnter(index)}
              onPointerLeave={handleLeave}
              onPointerMove={(event) => handleMove(index, event)}
            >
              <div
                className="frame"
                ref={(el) => {
                  frameRefs.current[index] = el;
                }}
              >
                <img src={entry.thumb} alt={entry.name} />
                <span className="chip">3D</span>
              </div>
              <div className="caption">{entry.caption}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
