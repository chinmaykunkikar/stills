import Gallery from "./gallery";

export default function Home() {
  return (
    <>
      <div className="corner tl">splats.</div>
      <div className="corner tr">
        <a href="#">about</a>
        <a href="#">how it works</a>
      </div>
      <div className="corner bl">
        note: every scene is 1,179,648 gaussians predicted from a single
        photograph, rendered live.
      </div>
      <Gallery />
    </>
  );
}
