/**
 * All supported candle timeframes.
 * These match Hyperliquid's supported intervals.
 */
export type Interval =
  | "1s"
  | "1m"   // 1 minute
  | "3m"   // 3 minutes
  | "5m"   // 5 minutes
  | "15m"  // 15 minutes
  | "30m"  // 30 minutes
  | "1h"   // 1 hour
  | "2h"   // 2 hours
  | "4h"   // 4 hours
  | "8h"   // 8 hours
  | "12h"  // 12 hours
  | "1d"   // 1 day
  | "3d"   // 3 days
  | "1w"   // 1 week
  | "1M";  // 1 month

/**
 * All intervals as an array (for iteration)
 */
export const ALL_INTERVALS: Interval[] = [
  "1s", "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "8h", "12h",
  "1d", "3d", "1w", "1M"
];

/**
 * Convert interval to milliseconds
 */
export function intervalToMs(interval: Interval): number {
  const map: Record<Interval, number> = {
    "1s": 1000,
    "1m": 60 * 1000,
    "3m": 3 * 60 * 1000,
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "30m": 30 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "2h": 2 * 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "8h": 8 * 60 * 60 * 1000,
    "12h": 12 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
    "3d": 3 * 24 * 60 * 60 * 1000,
    "1w": 7 * 24 * 60 * 60 * 1000,
    "1M": 30 * 24 * 60 * 60 * 1000, // Approximate
  };
  return map[interval];
}
