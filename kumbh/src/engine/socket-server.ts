import { createServer, type Server as NetServer, type Socket } from "net";
import { existsSync, unlinkSync } from "fs";
import type { IPCRequest, IPCResponse } from "../types/index.ts";

export class SocketServer {
  private server: NetServer | null = null;
  private socketPath: string;
  private requestHandler: ((request: IPCRequest) => Promise<IPCResponse>) | null = null;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  onRequest(handler: (request: IPCRequest) => Promise<IPCResponse>): void {
    this.requestHandler = handler;
  }

  async listen(): Promise<void> {
    if (existsSync(this.socketPath)) {
      unlinkSync(this.socketPath);
    }

    this.server = createServer((socket: Socket) => {
      this.handleConnection(socket);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(this.socketPath, () => {
        console.log(`Socket server listening on ${this.socketPath}`);
        resolve();
      });

      this.server!.on("error", (error) => {
        reject(error);
      });
    });
  }

  private handleConnection(socket: Socket): void {
    let buffer = "";

    socket.on("data", async (data) => {
      buffer += data.toString();
      
      if (buffer.includes("\n")) {
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const request: IPCRequest = JSON.parse(line);
              const response = this.requestHandler
                ? await this.requestHandler(request)
                : { type: "error" as const, error: "No handler registered" };
              
              socket.write(JSON.stringify(response) + "\n");
            } catch (error) {
              const response: IPCResponse = {
                type: "error",
                error: error instanceof Error ? error.message : String(error),
              };
              socket.write(JSON.stringify(response) + "\n");
            }
          }
        }
      }
    });

    socket.on("error", (error) => {
      console.error("Socket error:", error);
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          if (existsSync(this.socketPath)) {
            unlinkSync(this.socketPath);
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
