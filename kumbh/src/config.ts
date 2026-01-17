import { homedir } from "os";
import { join, resolve } from "path";
import { existsSync, mkdirSync, writeFileSync } from "fs";

export interface Config {
  socketPath: string;
  strategiesDir: string;
  dataDir: string;
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

function expandPath(path: string): string {
  if (path.startsWith("~")) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

function generateDefaultConfigFile(): string {
  return `export default {
  socketPath: "/tmp/kumbh.sock",
  strategiesDir: "~/.kumbh/strategies",
  dataDir: "~/.kumbh/data",
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
  const configDir = join(homedir(), ".kumbh");
  const configPath = join(configDir, "config.ts");

  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  if (!existsSync(configPath)) {
    const defaultConfig = generateDefaultConfigFile();
    writeFileSync(configPath, defaultConfig);
    console.log(`Created default config at ${configPath}`);
  }

  const configModule = await import(configPath);
  const config: Config = configModule.default;

  config.strategiesDir = expandPath(config.strategiesDir);
  config.dataDir = expandPath(config.dataDir);

  if (!existsSync(config.strategiesDir)) {
    mkdirSync(config.strategiesDir, { recursive: true });
  }

  if (!existsSync(config.dataDir)) {
    mkdirSync(config.dataDir, { recursive: true });
  }

  validateConfig(config);
  return config;
}

function validateConfig(config: Config): void {
  if (!config.hyperliquid.privateKey) {
    throw new Error(
      "Missing Hyperliquid private key. Set HL_PRIVATE_KEY environment variable or edit ~/.kumbh/config.ts"
    );
  }

  if (!config.hyperliquid.walletAddress) {
    throw new Error(
      "Missing Hyperliquid wallet address. Set HL_WALLET_ADDRESS environment variable or edit ~/.kumbh/config.ts"
    );
  }
}
