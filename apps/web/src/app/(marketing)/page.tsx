"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { playClick } from "../../lib/sound";

const NAV_ITEMS = ["Dashboard", "Body", "Mind", "Money", "General"] as const;
const SCORE_BARS = [
  { label: "Body", value: 48 },
  { label: "Mind", value: 55 },
  { label: "Money", value: 18 },
  { label: "General", value: 32 },
] as const;

export default function MarketingBootPage() {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  const [readyToEnter, setReadyToEnter] = React.useState(false);
  const [canEnter, setCanEnter] = React.useState(false);
  const [needsTapToPlay, setNeedsTapToPlay] = React.useState(false);

  React.useEffect(() => {
    if (readyToEnter) return;

    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const tryPlay = async () => {
      try {
        await video.play();
        if (!cancelled) setNeedsTapToPlay(false);
      } catch {
        if (!cancelled) setNeedsTapToPlay(true);
      }
    };

    const onTimeUpdate = () => {
      if (video.currentTime >= 4) {
        setCanEnter(true);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    void tryPlay();

    return () => {
      cancelled = true;
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [readyToEnter]);

  const handleTapToPlay = React.useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
      setNeedsTapToPlay(false);
    } catch {
      setNeedsTapToPlay(true);
    }
  }, []);

  const handleSkip = React.useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    setReadyToEnter(true);
    setCanEnter(true);
  }, []);

  const handleEnter = React.useCallback(() => {
    const video = videoRef.current;
    if (video) video.pause();
    setReadyToEnter(true);
    playClick();
    router.push("/os");
  }, [router]);

  React.useEffect(() => {
    if (!readyToEnter) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        handleEnter();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [readyToEnter, handleEnter]);

  return (
    <main className="tpBootRoot">
      <video
        ref={videoRef}
        className="tpBgVideo"
        autoPlay
        muted
        playsInline
        preload="auto"
        controls={false}
        onEnded={() => {
          setReadyToEnter(true);
          setCanEnter(true);
          setNeedsTapToPlay(false);
        }}
        onError={() => setNeedsTapToPlay(true)}
      >
        <source src="/boot.mp4" type="video/mp4" />
      </video>

      <div className="tpOverlay">
        <div className="tpTopBar chrome-panel">
          <div className="tpTopLeft">
            <span className="badge-chrome tpIcon">◈</span>
            <p className="chrome-title">TITAN PROTOCOL</p>
          </div>
          <div className="tpTopRight">
            <span className="badge-chrome">BOOT SEQUENCE</span>
            <button type="button" className="chrome-btn tpSkip" onClick={handleSkip}>
              SKIP
            </button>
          </div>
        </div>

        <aside className="tpSideLeft chrome-panel">
          <p className="tpPanelHeading">NAVIGATION</p>
          <div className="tpNavList">
            {NAV_ITEMS.map((item, index) => (
              <p key={item} className={`tpNavItem chrome-outline ${index === 0 ? "tpNavItemActive" : ""}`}>
                <span>{index === 0 ? "◉" : "◌"}</span>
                <span>{item}</span>
              </p>
            ))}
          </div>
        </aside>

        <aside className="tpSideRight chrome-panel">
          <p className="tpPanelHeading">TITAN SCORE</p>
          <p className="tpScore">25.0%</p>
          <div className="tpScores">
            {SCORE_BARS.map((bar) => (
              <div key={bar.label} className="tpScoreRow">
                <div className="tpScoreMeta">
                  <span>{bar.label}</span>
                  <span>{bar.value}%</span>
                </div>
                <div className="chrome-outline tpTrack">
                  <div className="tpFill" style={{ width: `${bar.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="tpCenterContent">
          {readyToEnter || canEnter ? (
            <div className="tpCtaWrap">
              <button type="button" className="tpArcButton" onClick={handleEnter}>
                <span className="tpArcReactor" aria-hidden="true">
                  <span className="tpArcRing tpArcRing1" />
                  <span className="tpArcRing tpArcRing2" />
                  <span className="tpArcRing tpArcRing3" />
                  <span className="tpArcCore" />
                </span>
                <span className="tpArcLabel">
                  ENTER
                  <span className="tpArcSub">TITAN PROTOCOL</span>
                </span>
              </button>
            </div>
          ) : (
            <p className="tpInitText">Initializing...</p>
          )}
        </div>

        <div className={`tpTapOverlay ${needsTapToPlay ? "is-visible" : ""}`}>
          <button type="button" className="chrome-btn tpTap" onClick={() => void handleTapToPlay()}>
            Tap to play
          </button>
        </div>
      </div>
    </main>
  );
}
