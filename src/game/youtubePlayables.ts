/**
 * Official YouTube Playables SDK (https://www.youtube.com/game_api/v1) adapter.
 * Gracefully falls back to standard browser storage/events when running outside YouTube Playables.
 */

interface YTGameAPI {
  SDK_VERSION?: string;
  IN_PLAYABLES_ENV?: boolean;
  game?: {
    firstFrameReady: () => void;
    gameReady: () => void;
    saveData: (data: string) => Promise<void>;
    loadData: () => Promise<string>;
  };
  engagement?: {
    sendScore: (score: { value: number }) => Promise<void>;
  };
  system?: {
    isAudioEnabled: () => boolean;
    onAudioEnabledChange: (cb: (isAudioEnabled: boolean) => void) => () => void;
    onPause: (cb: () => void) => () => void;
    onResume: (cb: () => void) => () => void;
  };
}

declare global {
  interface Window {
    ytgame?: YTGameAPI;
  }
}

const LOCAL_BEST_KEY = 'turbo_tumble_3d_best_v1';

function getYtGame(): YTGameAPI | undefined {
  return typeof window !== 'undefined' ? window.ytgame : undefined;
}

export function isYouTubePlayablesEnv(): boolean {
  const yt = getYtGame();
  return Boolean(yt && yt.IN_PLAYABLES_ENV);
}

export function hasYouTubeSdkLoaded(): boolean {
  return Boolean(getYtGame()?.game);
}

let firstFrameSent = false;
let gameReadySent = false;

export function signalFirstFrameReady(): void {
  if (firstFrameSent) return;
  firstFrameSent = true;
  try {
    getYtGame()?.game?.firstFrameReady();
  } catch {
    // Ignore outside Playables host
  }
}

export function signalGameReady(): void {
  if (gameReadySent) return;
  gameReadySent = true;
  try {
    getYtGame()?.game?.gameReady();
  } catch {
    // Ignore outside Playables host
  }
}

export function getInitialAudioEnabled(): boolean {
  try {
    const yt = getYtGame();
    if (yt?.system && typeof yt.system.isAudioEnabled === 'function') {
      return yt.system.isAudioEnabled();
    }
  } catch {
    // fallback enabled
  }
  return true;
}

export interface PlayablesLifecycleHandlers {
  onPause: () => void;
  onResume: () => void;
  onAudioChange: (enabled: boolean) => void;
}

export function subscribePlayablesLifecycle(handlers: PlayablesLifecycleHandlers): () => void {
  const unsubs: Array<() => void> = [];
  const yt = getYtGame();

  try {
    if (yt?.system?.onPause) {
      const u = yt.system.onPause(handlers.onPause);
      if (typeof u === 'function') unsubs.push(u);
    }
    if (yt?.system?.onResume) {
      const u = yt.system.onResume(handlers.onResume);
      if (typeof u === 'function') unsubs.push(u);
    }
    if (yt?.system?.onAudioEnabledChange) {
      const u = yt.system.onAudioEnabledChange(handlers.onAudioChange);
      if (typeof u === 'function') unsubs.push(u);
    }
  } catch {
    // Ignore if SDK stubs reject callbacks
  }

  const onVisibility = () => {
    if (document.hidden) handlers.onPause();
  };
  document.addEventListener('visibilitychange', onVisibility);
  unsubs.push(() => document.removeEventListener('visibilitychange', onVisibility));

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {
        // ignore cleanup errors
      }
    });
  };
}

export async function loadPlayablesBestScore(): Promise<number> {
  let localBest = 0;
  try {
    const raw = window.localStorage.getItem(LOCAL_BEST_KEY);
    localBest = raw ? Math.max(0, parseInt(raw, 10) || 0) : 0;
  } catch {
    localBest = 0;
  }

  try {
    const yt = getYtGame();
    if (yt?.game?.loadData) {
      const saved = await yt.game.loadData();
      if (saved && saved.trim().length > 0) {
        const parsed = JSON.parse(saved) as { bestScore?: number };
        if (typeof parsed?.bestScore === 'number' && Number.isFinite(parsed.bestScore)) {
          return Math.max(localBest, Math.floor(parsed.bestScore));
        }
      }
    }
  } catch {
    // fallback to local best
  }

  return localBest;
}

export async function savePlayablesBestScore(bestScore: number): Promise<void> {
  const clean = Math.max(0, Math.floor(bestScore));
  try {
    window.localStorage.setItem(LOCAL_BEST_KEY, String(clean));
  } catch {
    // ignore storage errors
  }

  try {
    const yt = getYtGame();
    if (yt?.game?.saveData) {
      await yt.game.saveData(JSON.stringify({ bestScore: clean }));
    }
  } catch {
    // ignore SDK save errors outside YouTube host
  }
}

export async function reportPlayablesScore(score: number): Promise<void> {
  const clean = Math.max(0, Math.floor(score));
  if (clean <= 0) return;
  try {
    const yt = getYtGame();
    if (yt?.engagement?.sendScore) {
      await yt.engagement.sendScore({ value: clean });
    }
  } catch {
    // ignore outside YouTube host
  }
}
