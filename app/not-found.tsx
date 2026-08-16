import type { Metadata } from "next";
import { scenes } from "./scenes";

export const metadata: Metadata = {
  title: "404 · stills.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="missing">
      <div className="wordmark">404.</div>
      <div className="missing-panel">
        <h1 className="detail-title">no scene at this address</h1>
        <header className="detail-head">
          <span>not found</span>
          <span className="detail-count">0 / {scenes.length}</span>
        </header>
        <dl className="detail-specs">
          <div>
            <dt>on the wall</dt>
            <dd>{scenes.length} photographs</dd>
          </div>
          <div>
            <dt>at this url</dt>
            <dd>nothing</dd>
          </div>
        </dl>
        <a className="missing-link" href="/">
          back to the wall
        </a>
      </div>
    </div>
  );
}
