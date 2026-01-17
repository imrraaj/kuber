export function validateStrategyName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error("Strategy name cannot be empty");
  }
  
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error("Strategy name can only contain letters, numbers, hyphens, and underscores");
  }
}

export function validateFilePath(path: string): void {
  if (!path || path.trim().length === 0) {
    throw new Error("File path cannot be empty");
  }
  
  if (!path.endsWith(".ts")) {
    throw new Error("Strategy file must be a TypeScript file (.ts)");
  }
}
