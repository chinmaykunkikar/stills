"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { sceneIndex, scenes } from "./scenes";
import {
  activateScene,
  deactivateScene,
  holdScenePointer,
  pointScene,
  setSceneDrift,
} from "./splat-viewer";

const HOVER_DELAY_MS = 220;
const LOADING_INDICATOR_DELAY_MS = 180;

type GalleryProps = {
  initialScene?: string;
};

type DetailState = "idle" | "loading" | "live";

function framePointer(frame: HTMLElement, event: React.PointerEvent) {
  const rect = frame.getBoundingClientRect();
  const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
  return { nx, ny };
}

export default function Gallery({ initialScene }: GalleryProps) {
  const [activeScene, setActiveScene] = useState<string | null>(initialScene ?? null);
  const [loadingIndex, setLoadingIndex] = useState(-1);
  const [liveIndex, setLiveIndex] = useState(-1);
  const [detailState, setDetailState] = useState<DetailState>("idle");
  const frameRefs = useRef<(HTMLDivElement | null)[]>([]);
  const detailFrameRef = useRef<HTMLDivElement | null>(null);
  const hoverTimer = useRef(0);
  const indicatorTimer = useRef(0);
  const gridScroll = useRef(0);

  const transitionTo = useCallback((next: string | null) => {
    const apply = () => {
      setActiveScene(next);
      setLoadingIndex(-1);
      setLiveIndex(-1);
    };
    const restoreScroll = () => {
      if (!next) window.scrollTo(0, gridScroll.current);
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || reducedMotion) {
      apply();
      restoreScroll();
      return;
    }
    document.documentElement.dataset.vt = next ? "forward" : "back";
    const transition = document.startViewTransition(() => {
      flushSync(apply);
      restoreScroll();
    });
    transition.finished.finally(() => {
      delete document.documentElement.dataset.vt;
    });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const name = window.location.pathname.replaceAll("/", "");
      transitionTo(sceneIndex(name) >= 0 ? name : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [transitionTo]);

  const closeScene = useCallback(() => {
    window.history.pushState(null, "", "/");
    transitionTo(null);
  }, [transitionTo]);

  useEffect(() => {
    if (!activeScene) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeScene();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeScene, closeScene]);

  useEffect(() => {
    if (!activeScene) return;
    const index = sceneIndex(activeScene);
    const frame = detailFrameRef.current;
    if (index < 0 || !frame) return;
    let disposed = false;
    setSceneDrift(true);
    const indicator = window.setTimeout(
      () => setDetailState("loading"),
      LOADING_INDICATOR_DELAY_MS,
    );
    activateScene(scenes[index], frame)
      .then((becameLive) => {
        if (!disposed && becameLive) setDetailState("live");
      })
      .catch((error) => console.error("scene activation failed:", error))
      .finally(() => {
        window.clearTimeout(indicator);
        if (!disposed) {
          setDetailState((current) => (current === "loading" ? "idle" : current));
        }
      });
    return () => {
      disposed = true;
      window.clearTimeout(indicator);
      setSceneDrift(false);
      holdScenePointer(false);
      setDetailState("idle");
      deactivateScene();
    };
  }, [activeScene]);

  function openScene(name: string) {
    window.clearTimeout(hoverTimer.current);
    window.clearTimeout(indicatorTimer.current);
    deactivateScene();
    gridScroll.current = window.scrollY;
    window.history.pushState(null, "", `/${name}/`);
    transitionTo(name);
  }

  function deactivateGrid() {
    window.clearTimeout(indicatorTimer.current);
    setLoadingIndex(-1);
    setLiveIndex(-1);
    deactivateScene();
  }

  async function activateGrid(index: number) {
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
      deactivateGrid();
      void activateGrid(index);
    }, HOVER_DELAY_MS);
  }

  function handleLeave() {
    window.clearTimeout(hoverTimer.current);
    deactivateGrid();
  }

  function handleMove(index: number, event: React.PointerEvent<HTMLAnchorElement>) {
    if (index !== liveIndex) return;
    const frame = frameRefs.current[index];
    if (!frame) return;
    const { nx, ny } = framePointer(frame, event);
    pointScene(nx, ny);
  }

  const detailIndex = activeScene ? sceneIndex(activeScene) : -1;
  const detailEntry = detailIndex >= 0 ? scenes[detailIndex] : null;

  if (detailEntry) {
    return (
      <div className="detail">
        <div className="detail-inner">
          <aside
            className="detail-panel"
            aria-label="Photo details"
            style={{ viewTransitionName: `photo-details-${detailEntry.name}` }}
          >
            <header className="detail-head">
              <span>{detailEntry.meta.date}</span>
              <span className="detail-count">
                {detailIndex + 1} / {scenes.length}
              </span>
            </header>
            <dl className="detail-specs">
              <div>
                <dt>camera</dt>
                <dd>{detailEntry.meta.camera}</dd>
              </div>
              <div>
                <dt>lens</dt>
                <dd>{detailEntry.meta.lens}</dd>
              </div>
              <div>
                <dt>exposure</dt>
                <dd>{detailEntry.meta.exposure}</dd>
              </div>
              <div>
                <dt>dimensions</dt>
                <dd>{detailEntry.meta.dimensions}</dd>
              </div>
            </dl>
          </aside>
          <a
            className={["detail-photo", detailState === "live" ? "live" : "", detailState === "loading" ? "loading" : ""]
              .filter(Boolean)
              .join(" ")}
            href="/"
            aria-label="Back to gallery"
            onClick={(event) => {
              event.preventDefault();
              closeScene();
            }}
          >
            <div
              className="frame"
              ref={detailFrameRef}
              style={{
                viewTransitionName: `photo-${detailEntry.name}`,
                aspectRatio: detailEntry.aspect,
              }}
              onPointerEnter={() => holdScenePointer(true)}
              onPointerLeave={() => holdScenePointer(false)}
              onPointerMove={(event) => {
                const frame = detailFrameRef.current;
                if (!frame) return;
                const { nx, ny } = framePointer(frame, event);
                pointScene(nx, ny);
              }}
            >
              <img src={detailEntry.thumb} alt={detailEntry.name} />
              <span className="chip">3D</span>
            </div>
          </a>
        </div>
      </div>
    );
  }

  const columns: { entry: (typeof scenes)[number]; index: number }[][] = [[], []];
  scenes.forEach((entry, index) => columns[index % 2].push({ entry, index }));

  return (
    <div className="stream" style={{ viewTransitionName: "gallery-shell" }}>
      {columns.map((column, columnIndex) => (
        <div className={columnIndex === 1 ? "col offset" : "col"} key={columnIndex}>
          {column.map(({ entry, index }) => (
            <a
              key={entry.name}
              href={`/${entry.name}/`}
              className={[
                "item",
                liveIndex === index ? "live" : "",
                loadingIndex === index ? "loading" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={(event) => {
                event.preventDefault();
                openScene(entry.name);
              }}
              onPointerEnter={() => handleEnter(index)}
              onPointerLeave={handleLeave}
              onPointerMove={(event) => handleMove(index, event)}
            >
              <div
                className="frame"
                style={{ viewTransitionName: `photo-${entry.name}` }}
                ref={(el) => {
                  frameRefs.current[index] = el;
                }}
              >
                <img src={entry.thumb} alt={entry.name} />
                <span className="chip">3D</span>
              </div>
              <div
                className="caption"
                style={{ viewTransitionName: `photo-details-${entry.name}` }}
              >
                {entry.caption}
              </div>
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}
