import { resolve } from "path";
import { existsSync, copyFileSync, mkdirSync } from "fs";
import type { Strategy } from "./base.ts";

/**
 * Load a strategy class from a TypeScript file.
 */
export async function loadStrategyFromFile(filePath: string): Promise<typeof Strategy> {
  const absolutePath = resolve(filePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Strategy file not found: ${absolutePath}`);
  }

  const module = await import(absolutePath);
  const StrategyClass = module.default;

  if (!StrategyClass) {
    throw new Error(`Strategy file must have a default export: ${filePath}`);
  }

  if (typeof StrategyClass !== "function") {
    throw new Error(`Default export must be a class: ${filePath}`);
  }

  return StrategyClass;
}

/**
 * Copy a strategy file to the strategies directory.
 */
export function copyStrategyToDir(
  sourcePath: string,
  strategiesDir: string
): string {
  const absoluteSource = resolve(sourcePath);
  const fileName = absoluteSource.split("/").pop()!;
  const destPath = resolve(strategiesDir, fileName);

  if (!existsSync(strategiesDir)) {
    mkdirSync(strategiesDir, { recursive: true });
  }

  copyFileSync(absoluteSource, destPath);
  return destPath;
}
