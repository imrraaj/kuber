import { resolve } from "path";
import { existsSync, statSync } from "fs";
import type { Strategy } from "./base.ts";

/**
 * Cache entry for loaded strategy modules.
 */
interface CacheEntry {
  module: typeof Strategy;
  mtime: number;
}

/**
 * Cache of loaded strategy modules.
 * Key: absolute file path
 * Value: module and last modified time
 */
const strategyCache = new Map<string, CacheEntry>();

/**
 * Load a strategy class from a TypeScript file.
 *
 * Features:
 * - Caches loaded modules for efficiency
 * - Supports force reload via cache-busting query parameter
 * - Validates the module exports a class
 *
 * @param filePath - Path to the strategy TypeScript file
 * @param forceReload - If true, bypasses cache and reloads from disk
 * @returns The strategy class constructor
 */
export async function loadStrategyFromFile(
  filePath: string,
  forceReload = false
): Promise<typeof Strategy> {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Strategy file not found: ${absolutePath}`);
  }

  // Get file modification time
  const stats = statSync(absolutePath);
  const currentMtime = stats.mtimeMs;

  // Check cache
  const cached = strategyCache.get(absolutePath);
  if (cached && !forceReload && cached.mtime === currentMtime) {
    return cached.module;
  }

  // Use cache-busting query parameter for Bun's import cache
  // This forces Bun to re-read the file from disk
  const importPath = forceReload || (cached && cached.mtime !== currentMtime)
    ? `${absolutePath}?t=${Date.now()}`
    : absolutePath;

  const module = await import(importPath);
  const StrategyClass = module.default;

  if (!StrategyClass) {
    throw new Error(`Strategy file must have a default export: ${filePath}`);
  }

  if (typeof StrategyClass !== "function") {
    throw new Error(`Default export must be a class: ${filePath}`);
  }

  // Update cache
  strategyCache.set(absolutePath, {
    module: StrategyClass,
    mtime: currentMtime,
  });

  return StrategyClass;
}

/**
 * Clear a specific strategy from the cache.
 * Useful when you know a file has changed and want to force reload next time.
 */
export function clearStrategyCache(filePath: string): void {
  const absolutePath = resolve(filePath);
  strategyCache.delete(absolutePath);
}

/**
 * Clear all cached strategies.
 */
export function clearAllStrategyCache(): void {
  strategyCache.clear();
}

/**
 * Check if a strategy file has been modified since it was cached.
 */
export function isStrategyCacheStale(filePath: string): boolean {
  const absolutePath = resolve(filePath);
  const cached = strategyCache.get(absolutePath);

  if (!cached) {
    return true; // Not in cache, needs to be loaded
  }

  if (!existsSync(absolutePath)) {
    return true; // File deleted
  }

  const stats = statSync(absolutePath);
  return stats.mtimeMs !== cached.mtime;
}
