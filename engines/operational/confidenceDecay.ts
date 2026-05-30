export interface DecayedConfidence {
  score: number;
  originalScore: number;
  ageMs: number;
  expired: boolean;
}

export class ConfidenceDecay {
  private createdAt: number;
  private originalScore: number;
  private halfLifeMs: number;

  constructor(score: number, halfLifeMs = 120_000) {
    this.originalScore = score;
    this.createdAt = Date.now();
    this.halfLifeMs = halfLifeMs;
  }

  getCurrent(): DecayedConfidence {
    const ageMs = Date.now() - this.createdAt;
    const decay = Math.pow(0.5, ageMs / this.halfLifeMs);
    const score = Math.round(this.originalScore * decay);
    return {
      score,
      originalScore: this.originalScore,
      ageMs,
      expired: score < 40,
    };
  }

  static fromTimestamp(score: number, timestamp: number, halfLifeMs = 120_000): DecayedConfidence {
    const ageMs = Date.now() - timestamp;
    const decay = Math.pow(0.5, ageMs / halfLifeMs);
    const s = Math.round(score * decay);
    return { score: s, originalScore: score, ageMs, expired: s < 40 };
  }
}
