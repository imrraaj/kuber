import { connect, type Socket } from "net";
import type { IPCRequest, IPCResponse } from "../types/index.ts";

export class SocketClient {
  private socketPath: string;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async sendRequest(request: IPCRequest): Promise<IPCResponse> {
    return new Promise((resolve, reject) => {
      const socket: Socket = connect(this.socketPath);
      let buffer = "";

      socket.on("connect", () => {
        socket.write(JSON.stringify(request) + "\n");
      });

      socket.on("data", (data) => {
        buffer += data.toString();
        
        if (buffer.includes("\n")) {
          const lines = buffer.split("\n");
          const responseLine = lines[0];
          
          try {
            const response: IPCResponse = JSON.parse(responseLine);
            socket.end();
            resolve(response);
          } catch (error) {
            socket.end();
            reject(new Error(`Failed to parse response: ${error}`));
          }
        }
      });

      socket.on("error", (error) => {
        reject(new Error(`Socket error: ${error.message}`));
      });

      socket.on("timeout", () => {
        socket.end();
        reject(new Error("Request timeout"));
      });

      socket.setTimeout(5000);
    });
  }
}
