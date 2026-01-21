import { join, resolve, dirname } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";

export interface Config {
  dataDir: string;
  apiPort: number;
  apiHost: string;
  isTestnet: boolean;
  hyperliquid: {
    privateKey: string;
    walletAddress: string;
  };
  logging: {
    level: string;
    fileLogging: boolean;
    maxFileSize: number;
  };
  dashboardRefreshMs: number;
}

function getProjectRoot(): string {
  // Get directory of current file, then go up to project root
  const currentFile = fileURLToPath(import.meta.url);
  const srcDir = dirname(currentFile);
  return dirname(srcDir); // Go from src/ to project root
}

function generateDefaultConfigFile(): string {
  return `export default {
  dataDir: "./data",
  apiPort: 3847,
  apiHost: "127.0.0.1",
  isTestnet: true,
  hyperliquid: {
    privateKey: process.env.HL_PRIVATE_KEY || "",
    walletAddress: process.env.HL_WALLET_ADDRESS || "",
  },
  logging: {
    level: "info",
    fileLogging: true,
    maxFileSize: 10 * 1024 * 1024,
  },
  dashboardRefreshMs: 1000,
};
`;
}

export async function loadConfig(): Promise<Config> {
  const projectRoot = getProjectRoot();
  const configPath = join(projectRoot, "kumbh.config.ts");

  if (!existsSync(configPath)) {
    const defaultConfig = generateDefaultConfigFile();
    writeFileSync(configPath, defaultConfig);
    console.log(`Created default config at ${configPath}`);
  }

  const configModule = await import(configPath);
  const config: Config = configModule.default;

  // Resolve relative data directory to project root
  if (!config.dataDir.startsWith("/")) {
    config.dataDir = join(projectRoot, config.dataDir);
  }

  // Create data directories
  const strategiesDbDir = join(config.dataDir, "strategies");

  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }

  if (!existsSync(strategiesDbDir)) {
    mkdirSync(strategiesDbDir, { recursive: true });
  }

  validateConfig(config);
  return config;
}

function validateConfig(config: Config): void {
  if (!config.hyperliquid.privateKey) {
    throw new Error(
      "Missing Hyperliquid private key. Set HL_PRIVATE_KEY environment variable or edit kumbh.config.ts"
    );
  }

  if (!config.hyperliquid.walletAddress) {
    throw new Error(
      "Missing Hyperliquid wallet address. Set HL_WALLET_ADDRESS environment variable or edit kumbh.config.ts"
    );
  }
}

export function getApiUrl(config: Config): string {
  return `http://${config.apiHost}:${config.apiPort}`;
}

export function getWsUrl(config: Config): string {
  return `ws://${config.apiHost}:${config.apiPort}/ws`;
}
