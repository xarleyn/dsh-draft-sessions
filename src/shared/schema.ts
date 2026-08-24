import type { TypertSchema } from "@deepseek-ai/dsh-typert-protocol";
import { DRAFT_FILE_VERSION, DRAFT_SESSION_VERSION } from "./constants.js";
import type {
  CreateDraftRequest,
  DeleteDraftRequest,
  DeleteDraftResult,
  DraftFile,
  DraftSession,
  DraftSessionState,
  ListDraftsRequest,
  RebindDraftRequest,
  UpdateDraftRequest,
} from "./types.js";

type Parser<T> = (value: unknown, path: string) => T;

export class DraftSchemaError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "DraftSchemaError";
  }
}

function schema<T>(parser: Parser<T>): TypertSchema<T> {
  return { parse: (value) => parser(value, "value") };
}

function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DraftSchemaError(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown !== undefined) {
    throw new DraftSchemaError(`${path}.${unknown} is unknown`);
  }
}

function required<T>(
  value: Record<string, unknown>,
  key: string,
  parser: Parser<T>,
  path: string,
): T {
  if (!Object.hasOwn(value, key)) {
    throw new DraftSchemaError(`${path}.${key} is required`);
  }
  return parser(value[key], `${path}.${key}`);
}

function optional<T>(
  value: Record<string, unknown>,
  key: string,
  parser: Parser<T>,
  path: string,
): void {
  if (!Object.hasOwn(value, key) || value[key] === undefined) return;
  parser(value[key], `${path}.${key}`);
}

function stringValue(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new DraftSchemaError(`${path} must be a string`);
  }
  return value;
}

function nonBlankString(value: unknown, path: string): string {
  const parsed = stringValue(value, path);
  if (parsed.length === 0) {
    throw new DraftSchemaError(`${path} must be a non-empty string`);
  }
  return parsed;
}

function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new DraftSchemaError(`${path} must be a boolean`);
  }
  return value;
}

function integerValue(value: unknown, minimum: number, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new DraftSchemaError(
      `${path} must be a safe integer greater than or equal to ${minimum}`,
    );
  }
  return value as number;
}

function nullable<T>(parser: Parser<T>): Parser<T | null> {
  return (value, path) => (value === null ? null : parser(value, path));
}

function literal<T extends string | number>(expected: T): Parser<T> {
  return (value, path) => {
    if (value !== expected) {
      throw new DraftSchemaError(
        `${path} must equal ${JSON.stringify(expected)}`,
      );
    }
    return expected;
  };
}

const DRAFT_STATES = new Set<DraftSessionState>([
  "draft",
  "materializing",
  "ready",
  "converting",
  "error",
]);

function draftState(value: unknown, path: string): DraftSessionState {
  if (
    typeof value !== "string" ||
    !DRAFT_STATES.has(value as DraftSessionState)
  ) {
    throw new DraftSchemaError(`${path} must be a supported draft state`);
  }
  return value as DraftSessionState;
}

function arrayValue<T>(value: unknown, parser: Parser<T>, path: string): T[] {
  if (!Array.isArray(value)) {
    throw new DraftSchemaError(`${path} must be an array`);
  }
  return value.map((item, index) => parser(item, `${path}[${index}]`));
}

const DRAFT_SESSION_KEYS = [
  "version",
  "id",
  "sessionId",
  "workspaceId",
  "workspacePath",
  "text",
  "title",
  "createdAt",
  "updatedAt",
  "order",
  "pinned",
  "agentPresetId",
  "state",
  "lastError",
  "revision",
] as const;

function parseDraftSession(value: unknown, path: string): DraftSession {
  const draft = objectValue(value, path);
  exactKeys(draft, DRAFT_SESSION_KEYS, path);
  required(draft, "version", literal(DRAFT_SESSION_VERSION), path);
  required(draft, "id", nonBlankString, path);
  required(draft, "sessionId", nullable(nonBlankString), path);
  required(draft, "workspaceId", nonBlankString, path);
  optional(draft, "workspacePath", nonBlankString, path);
  required(draft, "text", stringValue, path);
  optional(draft, "title", nonBlankString, path);
  required(
    draft,
    "createdAt",
    (item, itemPath) => integerValue(item, 0, itemPath),
    path,
  );
  required(
    draft,
    "updatedAt",
    (item, itemPath) => integerValue(item, 0, itemPath),
    path,
  );
  required(
    draft,
    "order",
    (item, itemPath) => integerValue(item, 0, itemPath),
    path,
  );
  optional(draft, "pinned", booleanValue, path);
  optional(draft, "agentPresetId", nonBlankString, path);
  required(draft, "state", draftState, path);
  optional(draft, "lastError", nonBlankString, path);
  required(
    draft,
    "revision",
    (item, itemPath) => integerValue(item, 1, itemPath),
    path,
  );
  return value as DraftSession;
}

function parseDraftFile(value: unknown, path: string): DraftFile {
  const file = objectValue(value, path);
  exactKeys(file, ["version", "drafts"], path);
  required(file, "version", literal(DRAFT_FILE_VERSION), path);
  required(
    file,
    "drafts",
    (item, itemPath) => arrayValue(item, parseDraftSession, itemPath),
    path,
  );
  return value as DraftFile;
}

function parseListDraftsRequest(
  value: unknown,
  path: string,
): ListDraftsRequest {
  const request = objectValue(value, path);
  exactKeys(request, ["workspaceId"], path);
  optional(request, "workspaceId", nonBlankString, path);
  return value as ListDraftsRequest;
}

function parseCreateDraftRequest(
  value: unknown,
  path: string,
): CreateDraftRequest {
  const request = objectValue(value, path);
  exactKeys(
    request,
    [
      "workspaceId",
      "sessionId",
      "workspacePath",
      "text",
      "title",
      "order",
      "pinned",
      "agentPresetId",
    ],
    path,
  );
  required(request, "workspaceId", nonBlankString, path);
  optional(request, "sessionId", nullable(nonBlankString), path);
  optional(request, "workspacePath", nonBlankString, path);
  optional(request, "text", stringValue, path);
  optional(request, "title", nonBlankString, path);
  optional(
    request,
    "order",
    (item, itemPath) => integerValue(item, 0, itemPath),
    path,
  );
  optional(request, "pinned", booleanValue, path);
  optional(request, "agentPresetId", nonBlankString, path);
  return value as CreateDraftRequest;
}

function parseUpdateDraftRequest(
  value: unknown,
  path: string,
): UpdateDraftRequest {
  const request = objectValue(value, path);
  exactKeys(
    request,
    [
      "id",
      "expectedRevision",
      "text",
      "title",
      "order",
      "pinned",
      "agentPresetId",
      "state",
      "lastError",
    ],
    path,
  );
  required(request, "id", nonBlankString, path);
  required(
    request,
    "expectedRevision",
    (item, itemPath) => integerValue(item, 1, itemPath),
    path,
  );
  optional(request, "text", stringValue, path);
  optional(request, "title", nullable(nonBlankString), path);
  optional(
    request,
    "order",
    (item, itemPath) => integerValue(item, 0, itemPath),
    path,
  );
  optional(request, "pinned", booleanValue, path);
  optional(request, "agentPresetId", nullable(nonBlankString), path);
  optional(request, "state", draftState, path);
  optional(request, "lastError", nullable(nonBlankString), path);
  return value as UpdateDraftRequest;
}

function parseDeleteDraftRequest(
  value: unknown,
  path: string,
): DeleteDraftRequest {
  const request = objectValue(value, path);
  exactKeys(request, ["id", "expectedRevision"], path);
  required(request, "id", nonBlankString, path);
  optional(
    request,
    "expectedRevision",
    (item, itemPath) => integerValue(item, 1, itemPath),
    path,
  );
  return value as DeleteDraftRequest;
}

function parseDeleteDraftResult(
  value: unknown,
  path: string,
): DeleteDraftResult {
  const result = objectValue(value, path);
  exactKeys(result, ["deleted"], path);
  required(result, "deleted", booleanValue, path);
  return value as DeleteDraftResult;
}

function parseRebindDraftRequest(
  value: unknown,
  path: string,
): RebindDraftRequest {
  const request = objectValue(value, path);
  exactKeys(request, ["id", "expectedRevision", "sessionId"], path);
  required(request, "id", nonBlankString, path);
  required(
    request,
    "expectedRevision",
    (item, itemPath) => integerValue(item, 1, itemPath),
    path,
  );
  required(request, "sessionId", nullable(nonBlankString), path);
  return value as RebindDraftRequest;
}

export const draftStateSchema = schema(draftState);
export const draftSessionSchema = schema(parseDraftSession);
export const draftSessionsSchema = schema((value, path) =>
  arrayValue(value, parseDraftSession, path),
);
export const draftFileSchema = schema(parseDraftFile);
export const listDraftsRequestSchema = schema(parseListDraftsRequest);
export const createDraftRequestSchema = schema(parseCreateDraftRequest);
export const updateDraftRequestSchema = schema(parseUpdateDraftRequest);
export const deleteDraftRequestSchema = schema(parseDeleteDraftRequest);
export const deleteDraftResultSchema = schema(parseDeleteDraftResult);
export const rebindDraftRequestSchema = schema(parseRebindDraftRequest);
