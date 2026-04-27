import { components } from "./_generated/api";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { readOptionalEnv } from "./env";

export type StorageProvider = "convex" | "r2";

export type ManagedStorageReference = {
  storageId: string;
  storageProvider: StorageProvider;
};

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  jurisdiction?: string;
};

type RunMutationContext = {
  runMutation: ActionCtx["runMutation"] | MutationCtx["runMutation"];
};

const STORAGE_PROVIDER_VALUES = new Set<StorageProvider>(["convex", "r2"]);
const R2_JURISDICTION_VALUES = new Set(["eu", "fedramp"]);
const DOWNLOAD_GRANT_TTL_MS = 5 * 60 * 1000;

export const getConfiguredStorageProvider = (): StorageProvider => {
  const configuredValue = readOptionalEnv("FILE_STORAGE_PROVIDER")?.toLowerCase();
  if (!configuredValue) return "r2";

  if (!STORAGE_PROVIDER_VALUES.has(configuredValue as StorageProvider)) {
    throw new Error("FILE_STORAGE_PROVIDER muss entweder 'convex' oder 'r2' sein.");
  }

  return configuredValue as StorageProvider;
};

export const getR2ConfigOrThrow = (): R2Config => {
  const accountId = readOptionalEnv("R2_ACCOUNT_ID");
  const accessKeyId = readOptionalEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = readOptionalEnv("R2_SECRET_ACCESS_KEY");
  const bucketName = readOptionalEnv("R2_BUCKET_NAME");
  const jurisdiction = readOptionalEnv("R2_JURISDICTION")?.toLowerCase();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "R2 ist aktiviert, aber R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY oder R2_BUCKET_NAME fehlen.",
    );
  }

  if (jurisdiction && !R2_JURISDICTION_VALUES.has(jurisdiction)) {
    throw new Error("R2_JURISDICTION muss 'eu' oder 'fedramp' sein.");
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    ...(jurisdiction ? { jurisdiction } : {}),
  };
};

const maybeGetR2Config = (provider: StorageProvider) =>
  provider === "r2" ? getR2ConfigOrThrow() : undefined;

export const createManagedReadUrl = async (
  ctx: RunMutationContext,
  reference: ManagedStorageReference,
  accessKey: string,
) => {
  const r2Config = maybeGetR2Config(reference.storageProvider);
  const downloadGrant = await ctx.runMutation(
    components.convexFilesControl.download.createDownloadGrant,
    {
      storageId: reference.storageId,
      maxUses: 1,
      expiresAt: Date.now() + DOWNLOAD_GRANT_TTL_MS,
    },
  );

  const consumeResult = await ctx.runMutation(
    components.convexFilesControl.download.consumeDownloadGrantForUrl,
    {
      downloadToken: downloadGrant.downloadToken,
      accessKey,
      ...(r2Config ? { r2Config } : {}),
    },
  );

  if (consumeResult.status !== "ok" || !consumeResult.downloadUrl) {
    throw new Error("Datei konnte nicht für die KI-Verarbeitung gelesen werden.");
  }

  return consumeResult.downloadUrl;
};

export const deleteManagedFile = async (
  ctx: RunMutationContext,
  reference: ManagedStorageReference,
) => {
  const r2Config = maybeGetR2Config(reference.storageProvider);
  const deleted = await ctx.runMutation(
    components.convexFilesControl.cleanUp.deleteFile,
    {
      storageId: reference.storageId,
      ...(r2Config ? { r2Config } : {}),
    },
  );

  return { deleted: deleted.deleted };
};
