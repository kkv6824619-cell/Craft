export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type ChaosModeId = 'none' | 'lowg' | 'overdrive' | 'magnet' | 'bouncy';

export interface ChaosModeInfo {
  id: ChaosModeId;
  label: string;
  accent: string;
  remaining: number;
  duration: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  bestScore: number;
  distance: number;
  speedKmh: number;
  combo: number;
  hearts: number;
  maxHearts: number;
  dashCharge: number; // 0..1
  chaos: ChaosModeInfo;
  bannerText: string;
  bannerAccent: string;
  smashedCount: number;
  coresCollected: number;
  gameOverReason: string;
  muted: boolean;
  activeSteerDir: 'left' | 'right' | 'none';
}

export interface GameCallbacks {
  onHudUpdate: (snapshot: HudSnapshot) => void;
}
