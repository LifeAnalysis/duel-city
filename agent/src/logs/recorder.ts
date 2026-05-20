import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AgentConfig } from "../types.ts";

interface RunEvent {
  time: string;
  runId: string;
  type: string;
  payload: unknown;
}

export class RunRecorder {
  config: AgentConfig;
  events: RunEvent[];
  path: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.events = [];
    this.path = path.join(config.logDir, `${config.runId}.jsonl`);
  }

  async record(type: string, payload: unknown = {}): Promise<void> {
    const event = {
      time: new Date().toISOString(),
      runId: this.config.runId,
      type,
      payload,
    };

    this.events.push(event);
    await mkdir(path.dirname(this.path), { recursive: true });
    await writeFile(
      this.path,
      `${this.events.map((item) => JSON.stringify(item)).join("\n")}\n`,
    );
  }
}

export function redactSecret(value: string | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
