import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  AgentConfig,
  AgentMode,
  CliOptionValue,
  LlmAuthProvider,
  LlmProvider,
  ParsedCli,
} from "./types.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";
const DEFAULT_STORAGE_STATE = ".agent/state/mycard.json";
const DEFAULT_LOG_DIR = ".agent/logs";

export function parseCli(argv: string[]): ParsedCli {
  const positional: string[] = [];
  const options: Record<string, CliOptionValue> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const raw = arg.slice(2);
    const equalsIndex = raw.indexOf("=");

    if (equalsIndex !== -1) {
      options[raw.slice(0, equalsIndex)] = raw.slice(equalsIndex + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options[raw] = next;
      index += 1;
    } else {
      options[raw] = true;
    }
  }

  return {
    command: positional[0] ?? "help",
    positional: positional.slice(1),
    options,
  };
}

export async function loadAgentConfig(
  argv = process.argv.slice(2),
): Promise<AgentConfig> {
  const cli = parseCli(argv);
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(currentDir, "../..");
  const modeInput = stringOption(
    cli.options.mode,
    process.env.NEOS_AGENT_MODE,
    "headed",
  );

  if (!isAgentMode(modeInput)) {
    throw new Error(`Unsupported mode: ${modeInput}`);
  }
  const mode = modeInput;

  const storageState = resolveProjectPath(
    rootDir,
    stringOption(
      cli.options.storage,
      process.env.NEOS_AGENT_STORAGE_STATE,
      DEFAULT_STORAGE_STATE,
    ),
  );
  const logDir = resolveProjectPath(
    rootDir,
    stringOption(
      cli.options["log-dir"],
      process.env.NEOS_AGENT_LOG_DIR,
      DEFAULT_LOG_DIR,
    ),
  );
  const llmProvider = parseLlmProvider(
    stringOption(
      cli.options["llm-provider"],
      process.env.NEOS_AGENT_LLM_PROVIDER,
      "stub",
    ),
  );

  const config = {
    rootDir,
    command: cli.command,
    positional: cli.positional,
    baseURL: normalizeBaseUrl(
      stringOption(
        cli.options["base-url"],
        process.env.NEOS_AGENT_BASE_URL,
        DEFAULT_BASE_URL,
      ),
    ),
    startPath: stringOption(
      cli.options.path,
      process.env.NEOS_AGENT_START_PATH,
      "/match/",
    ),
    duelUrl: stringOption(
      cli.options["duel-url"],
      process.env.NEOS_AGENT_DUEL_URL,
      "",
    ),
    mode,
    slowMo: numberOption(
      cli.options["slow-mo"],
      process.env.NEOS_AGENT_SLOW_MO,
      mode === "headed" ? 120 : 0,
    ),
    maxSteps: numberOption(
      cli.options["max-steps"],
      process.env.NEOS_AGENT_MAX_STEPS,
      1,
    ),
    stepDelayMs: numberOption(
      cli.options["step-delay-ms"],
      process.env.NEOS_AGENT_STEP_DELAY_MS,
      500,
    ),
    actionTimeoutMs: numberOption(
      cli.options["action-timeout-ms"],
      process.env.NEOS_AGENT_ACTION_TIMEOUT_MS,
      10_000,
    ),
    dryRun: booleanOption(
      cli.options["dry-run"],
      process.env.NEOS_AGENT_DRY_RUN,
      false,
    ),
    storageState,
    storageStateExists: existsSync(storageState),
    logDir,
    runId: stringOption(
      cli.options["run-id"],
      process.env.NEOS_AGENT_RUN_ID,
      createRunId(),
    ),
    llm: {
      provider: llmProvider,
      authProvider: parseLlmAuthProvider(
        stringOption(
          cli.options["llm-auth"],
          process.env.NEOS_AGENT_LLM_AUTH,
          defaultLlmAuthProvider(llmProvider),
        ),
      ),
      model: stringOption(
        cli.options.model,
        process.env.NEOS_AGENT_LLM_MODEL,
        defaultLlmModel(llmProvider),
      ),
      baseURL: normalizeBaseUrl(
        stringOption(
          cli.options["llm-base-url"],
          process.env.NEOS_AGENT_LLM_BASE_URL,
          "https://api.openai.com/v1",
        ),
      ),
      codexHarnessUrl: normalizeOptionalUrl(
        stringOption(
          cli.options["codex-harness-url"],
          process.env.NEOS_AGENT_CODEX_HARNESS_URL,
          "",
        ),
      ),
      codexHome: resolveHomePath(
        stringOption(
          cli.options["codex-home"],
          process.env.CODEX_HOME,
          "~/.codex",
        ),
      ),
      codexAuthFile: cli.options["codex-auth-file"]
        ? resolveHomePath(String(cli.options["codex-auth-file"]))
        : undefined,
    },
    // Harness settings are kept beside LLM settings because the Codex provider
    // delegates real Codex/OAuth usage to this local HTTP process.
    harness: {
      host: stringOption(
        cli.options["harness-host"],
        process.env.NEOS_AGENT_HARNESS_HOST,
        "127.0.0.1",
      ),
      port: numberOption(
        cli.options["harness-port"],
        process.env.NEOS_AGENT_HARNESS_PORT,
        8787,
      ),
      path: normalizeHarnessPath(
        stringOption(
          cli.options["harness-path"],
          process.env.NEOS_AGENT_HARNESS_PATH,
          "/decision",
        ),
      ),
      codexCommand: stringOption(
        cli.options["codex-command"],
        process.env.NEOS_AGENT_CODEX_COMMAND,
        "codex",
      ),
      codexTimeoutMs: numberOption(
        cli.options["codex-timeout-ms"],
        process.env.NEOS_AGENT_CODEX_TIMEOUT_MS,
        120_000,
      ),
    },
  };

  await mkdir(config.logDir, { recursive: true });
  await mkdir(path.dirname(config.storageState), { recursive: true });

  return config;
}

export function commandUsage(): string {
  return `Usage:
  npm run agent -- help
  npm run agent -- auth-status
  npm run agent -- codex-auth-check
  npm run agent -- codex-harness
  npm run agent -- llm-check --llm-provider stub
  npm run agent -- llm-check --llm-provider codex --codex-harness-url http://127.0.0.1:8787/decision
  npm run agent -- auth --mode headed --storage .agent/state/mycard.json
  npm run agent -- observe --mode headed --storage .agent/state/mycard.json
  npm run agent -- play --mode headed --storage .agent/state/mycard.json --max-steps 1

Options:
  --base-url <url>          Neos dev server URL. Default: ${DEFAULT_BASE_URL}
  --mode <headed|headless>  Browser mode. Default: headed
  --storage <path>          Playwright storageState path. Default: ${DEFAULT_STORAGE_STATE}
  --llm-provider <name>     stub, openai, or codex. Default: stub
  --llm-auth <name>         none, env, or codex-cli. Default depends on provider
  --model <model>           Model override. Defaults to gpt-5.1 for OpenAI and Codex CLI default for Codex
  --codex-harness-url <url> Codex harness endpoint when --llm-provider codex
  --harness-port <number>   Local Codex harness port. Default: 8787
  --max-steps <number>      Duel loop steps. Default: 1`;
}

function stringOption(
  value: CliOptionValue | undefined,
  envValue: string | undefined,
  defaultValue: string,
): string {
  if (value !== undefined && value !== true) return String(value);
  if (envValue !== undefined && envValue !== "") return envValue;
  return defaultValue;
}

function numberOption(
  value: CliOptionValue | undefined,
  envValue: string | undefined,
  defaultValue: number,
): number {
  const raw = value !== undefined && value !== true ? value : envValue;
  if (raw === undefined || raw === "") return defaultValue;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected number, received: ${raw}`);
  }

  return parsed;
}

function booleanOption(
  value: CliOptionValue | undefined,
  envValue: string | undefined,
  defaultValue: boolean,
): boolean {
  const raw = value !== undefined ? value : envValue;
  if (raw === undefined || raw === "") return defaultValue;
  if (raw === true) return true;
  if (["1", "true", "yes", "on"].includes(String(raw).toLowerCase()))
    return true;
  if (["0", "false", "no", "off"].includes(String(raw).toLowerCase()))
    return false;
  return defaultValue;
}

function resolveProjectPath(rootDir: string, maybePath: string): string {
  const expanded = resolveHomePath(maybePath);
  return path.isAbsolute(expanded) ? expanded : path.resolve(rootDir, expanded);
}

function resolveHomePath(maybePath: string): string {
  if (maybePath === "~") return os.homedir();
  if (maybePath.startsWith("~/"))
    return path.join(os.homedir(), maybePath.slice(2));
  return maybePath;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeOptionalUrl(value: string): string {
  if (!value) return "";
  return normalizeBaseUrl(value);
}

/** Normalizes route-style config such as `decision/` into `/decision`. */
function normalizeHarnessPath(value: string): string {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith("/")) {
    return withLeadingSlash.slice(0, -1);
  }
  return withLeadingSlash;
}

function createRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function isAgentMode(value: string): value is AgentMode {
  return value === "headed" || value === "headless";
}

function parseLlmProvider(value: string): LlmProvider {
  if (value === "stub" || value === "openai" || value === "codex") {
    return value;
  }

  throw new Error(`Unsupported LLM provider: ${value}`);
}

function parseLlmAuthProvider(value: string): LlmAuthProvider {
  if (value === "env" || value === "none" || value === "codex-cli") {
    return value;
  }

  if (value === "codex") {
    return "codex-cli";
  }

  throw new Error(`Unsupported LLM auth provider: ${value}`);
}

function defaultLlmAuthProvider(provider: LlmProvider): LlmAuthProvider {
  if (provider === "openai") return "env";
  if (provider === "codex") return "codex-cli";
  return "none";
}

/** Leaves Codex model empty so `codex exec` can use the login/account default. */
function defaultLlmModel(provider: LlmProvider): string {
  if (provider === "codex") return "";
  return "gpt-5.1";
}
