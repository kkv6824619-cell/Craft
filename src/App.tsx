/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { ExportHtmlModal } from './components/ExportHtmlModal';
import { TitleLockup } from './components/TitleLockup';
import { TurboTumbleEngine } from './game/TurboTumbleEngine';
import { HudSnapshot } from './game/types';
import { isYouTubePlayablesEnv } from './game/youtubePlayables';

const INITIAL_HUD: HudSnapshot = {
  phase: 'title',
  score: 0,
  bestScore: 0,
  distance: 0,
  speedKmh: 102,
  combo: 0,
  hearts: 3,
  maxHearts: 3,
  dashCharge: 1,
  chaos: {
    id: 'none',
    label: '',
    accent: '#f59e0b',
    remaining: 0,
    duration: 1,
  },
  bannerText: '',
  bannerAccent: '#f59e0b',
  smashedCount: 0,
  coresCollected: 0,
  gameOverReason: '',
  muted: false,
  activeSteerDir: 'none',
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TurboTumbleEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [exportOpen, setExportOpen] = useState(false);
  const inPlayables = isYouTubePlayablesEnv();

  // Mount Three.js canvas once inside an isolated ref container so React HUD state never resets the loop
  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    const engine = new TurboTumbleEngine(host, {
      onHudUpdate: (snapshot) => setHud(snapshot),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync Export modal state with engine hotkey guard & allow Escape to close modal
  useEffect(() => {
    engineRef.current?.setModalOpen(exportOpen);
    if (!exportOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setExportOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [exportOpen]);

  const handleStart = () => engineRef.current?.startGame();
  const handleTogglePause = () => engineRef.current?.togglePause();
  const handleReturnTitle = () => engineRef.current?.returnToTitle();
  const handleToggleMute = () => engineRef.current?.toggleMute();

  const chaosPct =
    hud.chaos.id !== 'none' && hud.chaos.duration > 0
      ? Math.max(0, Math.min(100, (hud.chaos.remaining / hud.chaos.duration) * 100))
      : 0;

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950 text-slate-50">
      {/* Isolated WebGL Viewport Container (also handles direct Left/Right screen touch steering) */}
      <div ref={mountRef} className="fixed inset-0 z-0" />

      {/* Playing / Paused Perimeter HUD — Zero backdrop-filter over WebGL, >85% unobstructed playfield */}
      {(hud.phase === 'playing' || hud.phase === 'paused') && (
        <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between safe-pad">
          {/* Top Perimeter Bar */}
          <div className="flex items-start justify-between gap-3">
            {/* Left: Score, Distance & Combo */}
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-slate-950/82 border border-white/15 px-3.5 py-2">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400">
                  Score
                </div>
                <div className="font-mono-num text-xl sm:text-2xl font-bold leading-tight text-white">
                  {hud.score.toLocaleString()}
                </div>
              </div>

              <div className="hidden sm:block rounded-xl bg-slate-950/82 border border-white/15 px-3.5 py-2">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400">
                  Distance
                </div>
                <div className="font-mono-num text-2xl font-bold leading-tight text-sky-300">
                  {hud.distance}m
                </div>
              </div>

              <div className="hidden md:block rounded-xl bg-slate-950/82 border border-white/15 px-3.5 py-2">
                <div className="text-[11px] font-semibold tracking-wider text-slate-400">
                  Speed
                </div>
                <div className="font-mono-num text-xl font-bold leading-tight text-amber-300">
                  {hud.speedKmh} <span className="text-xs font-semibold text-slate-400">km/h</span>
                </div>
              </div>

              {hud.combo > 1 && (
                <div className="rounded-xl bg-amber-500/95 border border-amber-300/60 px-3 py-2 text-slate-950">
                  <div className="text-[10px] font-extrabold tracking-wider">Combo</div>
                  <div className="font-mono-num text-lg sm:text-xl font-extrabold leading-tight">
                    x{hud.combo}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Shields, Dash Meter & Audio/Pause Controls */}
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-slate-950/82 border border-white/15 px-3 py-2 min-w-[126px] sm:min-w-[144px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-400">Shields</span>
                  <div className="flex items-center gap-1" aria-label={`${hud.hearts} shields remaining`}>
                    {Array.from({ length: hud.maxHearts }).map((_, idx) => (
                      <Shield
                        key={idx}
                        className={`h-4 w-4 ${
                          idx < hud.hearts
                            ? 'fill-rose-500 text-rose-400'
                            : 'fill-slate-800 text-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Dash-Smash Charge Meter */}
                <div className="mt-2 flex items-center gap-2">
                  <Zap
                    className={`h-3.5 w-3.5 shrink-0 ${
                      hud.dashCharge >= 1 ? 'text-sky-400 fill-sky-400' : 'text-slate-500'
                    }`}
                  />
                  <div className="h-2 flex-1 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-[width] duration-75"
                      style={{
                        width: `${Math.round(hud.dashCharge * 100)}%`,
                        backgroundColor: hud.dashCharge >= 1 ? '#38bdf8' : '#64748b',
                      }}
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleToggleMute}
                aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/82 border border-white/15 text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {hud.muted ? <VolumeX className="h-5 w-5 text-slate-400" /> : <Volume2 className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={handleTogglePause}
                aria-label={hud.phase === 'paused' ? 'Resume game' : 'Pause game'}
                className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-950/82 border border-white/15 text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {hud.phase === 'paused' ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Center-Top Event Telegraph & Active Chaos Bar */}
          <div className="flex flex-col items-center gap-2 self-center mt-2 mb-auto">
            {hud.bannerText && (
              <div
                className="rounded-xl bg-slate-950/90 px-4 sm:px-5 py-2 font-display text-sm sm:text-lg font-extrabold tracking-wide text-white shadow-lg text-center"
                style={{ border: `2px solid ${hud.bannerAccent}` }}
              >
                {hud.bannerText}
              </div>
            )}

            {hud.chaos.id !== 'none' && (
              <div className="rounded-xl bg-slate-950/86 border border-white/15 px-4 py-2 flex flex-col items-center gap-1.5 min-w-[200px]">
                <div className="flex items-center justify-between w-full text-xs font-extrabold tracking-wider">
                  <span style={{ color: hud.chaos.accent }}>{hud.chaos.label}</span>
                  <span className="font-mono-num text-slate-300">
                    {hud.chaos.remaining.toFixed(1)}s
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-[width] duration-75"
                    style={{
                      width: `${chaosPct}%`,
                      backgroundColor: hud.chaos.accent,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Perimeter Controls: Always-Accessible Left/Right Touch Steering + Jump/Dash */}
          <div className="flex items-end justify-between gap-3">
            {/* Left / Right Car Steering Touch Pads */}
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <button
                type="button"
                aria-label="Move car left"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engineRef.current?.setVirtualSteer('left', true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  engineRef.current?.setVirtualSteer('left', false);
                }}
                onPointerLeave={() => engineRef.current?.setVirtualSteer('left', false)}
                onPointerCancel={() => engineRef.current?.setVirtualSteer('left', false)}
                className={`flex h-14 w-16 sm:h-14 sm:w-16 items-center justify-center rounded-xl border transition-transform active:scale-95 cursor-pointer select-none ${
                  hud.activeSteerDir === 'left'
                    ? 'bg-orange-500 border-amber-200 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)]'
                    : 'bg-slate-950/80 border-white/20 text-white hover:bg-slate-800/90'
                }`}
              >
                <ChevronLeft className="h-7 w-7 stroke-[2.75]" />
              </button>

              <button
                type="button"
                aria-label="Move car right"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engineRef.current?.setVirtualSteer('right', true);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  engineRef.current?.setVirtualSteer('right', false);
                }}
                onPointerLeave={() => engineRef.current?.setVirtualSteer('right', false)}
                onPointerCancel={() => engineRef.current?.setVirtualSteer('right', false)}
                className={`flex h-14 w-16 sm:h-14 sm:w-16 items-center justify-center rounded-xl border transition-transform active:scale-95 cursor-pointer select-none ${
                  hud.activeSteerDir === 'right'
                    ? 'bg-orange-500 border-amber-200 text-white shadow-[0_0_20px_rgba(249,115,22,0.5)]'
                    : 'bg-slate-950/80 border-white/20 text-white hover:bg-slate-800/90'
                }`}
              >
                <ChevronRight className="h-7 w-7 stroke-[2.75]" />
              </button>
            </div>

            {/* Quiet Desktop Control Hint */}
            <div className="hidden lg:flex items-center gap-3 text-xs font-medium text-slate-200/90 bg-slate-950/70 rounded-lg px-3.5 py-2">
              <span>Touch Left/Right or A/D Steer</span>
              <span aria-hidden="true">·</span>
              <span>Space / Swipe Up Jump</span>
              <span aria-hidden="true">·</span>
              <span>Shift Dash-Smash</span>
            </div>

            {/* Dash & Jump Touch Action Pads */}
            <div className="flex items-center gap-2.5 pointer-events-auto">
              <button
                type="button"
                aria-label="Turbo Dash"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engineRef.current?.triggerDash();
                }}
                className={`h-14 px-4 sm:px-5 rounded-xl border text-sm font-extrabold tracking-wide transition-transform active:scale-95 cursor-pointer select-none whitespace-nowrap ${
                  hud.dashCharge >= 1
                    ? 'bg-sky-500/95 border-sky-200/70 text-slate-950 hover:bg-sky-400'
                    : 'bg-slate-950/75 border-white/15 text-slate-400'
                }`}
              >
                Dash
              </button>
              <button
                type="button"
                aria-label="Jump"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  engineRef.current?.triggerJump();
                }}
                className="h-14 px-5 sm:px-6 rounded-xl bg-orange-500/95 hover:bg-orange-600 border border-orange-300/60 text-sm font-extrabold tracking-wide text-white transition-transform active:scale-95 cursor-pointer select-none whitespace-nowrap"
              >
                Jump
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Title Screen — Live sunlit 3D skyway camera pan + bespoke SVG lockup + Start & Export */}
      {hud.phase === 'title' && (
        <div
          className="fixed inset-0 z-20 flex flex-col items-center justify-between safe-pad py-8 sm:py-12"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.48) 0%, rgba(15,23,42,0.06) 44%, rgba(15,23,42,0.74) 100%)',
          }}
        >
          {/* Top bar: Best Score & Mute */}
          <div className="w-full max-w-5xl flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-100/90">
              {hud.bestScore > 0 ? (
                <span>
                  Best Score <span className="font-mono-num text-amber-300">{hud.bestScore.toLocaleString()}</span>
                </span>
              ) : (
                <span>Skyway Gauntlet</span>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleMute}
              aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950/75 border border-white/15 text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {hud.muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Center-Top Title Lockup leaving generous open view of the 3D racer & skyway */}
          <div className="mt-2 mb-auto">
            <TitleLockup />
          </div>

          {/* Bottom Primary CTA + Secondary Export (auto-hidden inside YouTube Playables host) */}
          <div className="flex flex-col items-center gap-4 w-full max-w-xl">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleStart}
                className="flex items-center gap-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:translate-y-[1px] px-9 py-4 font-display text-lg font-extrabold tracking-wide text-white shadow-[0_12px_30px_rgba(249,115,22,0.42)] transition-all cursor-pointer whitespace-nowrap"
              >
                <Play className="h-5 w-5 fill-current" />
                Play Now
              </button>

              {!inPlayables && (
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="flex items-center gap-2 rounded-xl bg-slate-950/85 hover:bg-slate-800 border border-white/20 px-5 py-4 text-sm font-bold text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-4 w-4 text-sky-400" />
                  YouTube Playables &amp; HTML
                </button>
              )}
            </div>

            <p className="text-xs sm:text-sm font-medium text-slate-100/90 text-center">
              Tap Left/Right or A/D Steer &middot; Space / Swipe Up Jump &middot; Shift Dash-Smash &middot; Esc Pause
            </p>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {hud.phase === 'paused' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700/80 p-6 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-extrabold text-white">Paused</h2>
            <p className="mt-1.5 text-sm text-slate-400">
              Ready to jump back into the skyway chaos?
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleTogglePause}
                className="w-full rounded-xl bg-orange-500 hover:bg-orange-600 py-3 font-display text-base font-extrabold text-white transition-colors cursor-pointer"
              >
                Resume Run
              </button>
              <button
                type="button"
                onClick={handleStart}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 text-sm font-bold text-slate-100 transition-colors cursor-pointer"
              >
                Restart
              </button>
              {!inPlayables && (
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3 text-sm font-bold text-sky-300 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  YouTube Playables &amp; HTML
                </button>
              )}
              <button
                type="button"
                onClick={handleReturnTitle}
                className="w-full rounded-xl py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Return to Title
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {hud.phase === 'gameover' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700/80 p-7 text-center shadow-2xl">
            <h2 className="font-display text-3xl font-extrabold text-white">Run Complete</h2>
            <p className="mt-1 text-sm text-slate-300">{hud.gameOverReason}</p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-800/90 p-3">
                <div className="font-mono-num text-xl font-extrabold text-white">
                  {hud.score.toLocaleString()}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Score</div>
              </div>
              <div className="rounded-xl bg-slate-800/90 p-3">
                <div className="font-mono-num text-xl font-extrabold text-amber-300">
                  {hud.bestScore.toLocaleString()}
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Best</div>
              </div>
              <div className="rounded-xl bg-slate-800/90 p-3">
                <div className="font-mono-num text-xl font-extrabold text-sky-300">
                  {hud.distance}m
                </div>
                <div className="text-[11px] font-medium text-slate-400 mt-0.5">Distance</div>
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              {hud.coresCollected} Sky-Cores collected &middot; {hud.smashedCount} hazards smashed
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={handleStart}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 py-3.5 px-5 font-display text-base font-extrabold text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                Play Again
              </button>
              {!inPlayables && (
                <button
                  type="button"
                  onClick={() => setExportOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 py-3.5 px-4 text-sm font-bold text-sky-300 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleReturnTitle}
              className="mt-3 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              Back to Title Screen
            </button>
          </div>
        </div>
      )}

      {/* Export Modal for YouTube Playables & Single-File HTML */}
      {!inPlayables && (
        <ExportHtmlModal open={exportOpen} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}
