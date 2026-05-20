import { existsSync } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext } from "@playwright/test";

import type { StorageStateInspection } from "../types.ts";

export async function saveStorageState(
  context: BrowserContext,
  storageStatePath: string,
): Promise<void> {
  await mkdir(path.dirname(storageStatePath), { recursive: true });
  await context.storageState({ path: storageStatePath });
}

export async function inspectStorageState(
  storageStatePath: string,
): Promise<StorageStateInspection> {
  if (!existsSync(storageStatePath)) {
    return { exists: false, path: storageStatePath };
  }

  const fileStat = await stat(storageStatePath);
  return {
    exists: true,
    path: storageStatePath,
    size: fileStat.size,
    updatedAt: fileStat.mtime.toISOString(),
  };
}
