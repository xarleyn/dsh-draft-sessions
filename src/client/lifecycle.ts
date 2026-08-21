import { Service, type Context } from "@deepseek-ai/cordis";
import type {
  IApiClient,
  RpcError,
  WorkspaceId,
} from "@deepseek-ai/dsh-client-connection/client";
import type {
  RemoteFailure,
  RemoteResult,
  TypertRemoteNamespace,
} from "@deepseek-ai/dsh-typert-protocol";
import type {
  CreateDraftRequest,
  DraftSession,
  UpdateDraftRequest,
} from "../shared/types.js";

type DraftSessionsRemote = TypertRemoteNamespace<"draftSessions">;
type SessionsApi = Pick<IApiClient["sessions"], "create" | "list">;

export type CreateManagedDraftRequest = Omit<CreateDraftRequest, "sessionId">;

export type DraftLifecycleStage =
  | "draft-create"
  | "draft-list"
  | "draft-update"
  | "session-list"
  | "session-create"
  | "draft-rebind";

/** A lifecycle failure never implies that the durable DraftRecord was removed. */
export class DraftLifecycleError extends Error {
  readonly stage: DraftLifecycleStage;
  readonly code: string;
  readonly draft: DraftSession | undefined;
  readonly sessionId: string | undefined;

  constructor(
    stage: DraftLifecycleStage,
    failure: Pick<RemoteFailure, "code" | "message">,
    options: {
      readonly draft?: DraftSession;
      readonly sessionId?: string;
      readonly cause?: unknown;
    } = {},
  ) {
    super(`${stage}: ${failure.message}`, {
      ...(options.cause === undefined ? {} : { cause: options.cause }),
    });
    this.name = "DraftLifecycleError";
    this.stage = stage;
    this.code = failure.code;
    this.draft = options.draft;
    this.sessionId = options.sessionId;
  }
}

export interface DraftSessionLifecycleOptions {
  readonly drafts: DraftSessionsRemote;
  readonly sessions: SessionsApi;
}

/**
 * Client-side bridge between durable DraftRecords and real blank DSH Sessions.
 *
 * The DraftRecord is created first with no Session id. A Session id enters the
 * durable record only after `sessions.create` has returned a successful result.
 */
export class DraftSessionLifecycle extends Service {
  private readonly drafts: DraftSessionsRemote;
  private readonly sessions: SessionsApi;

  constructor(ctx: Context, options?: DraftSessionLifecycleOptions) {
    super(ctx, "draftSessionLifecycle");
    this.drafts = options?.drafts ?? ctx.remote.draftSessions;
    this.sessions = options?.sessions ?? ctx.connection.api.sessions;
  }

  /** Create a durable draft and give it a distinct blank Session shell. */
  async create(request: CreateManagedDraftRequest): Promise<DraftSession> {
    const created = this.remoteValue(
      await this.drafts.create({
        workspaceId: request.workspaceId,
        ...(request.workspacePath === undefined
          ? {}
          : { workspacePath: request.workspacePath }),
        ...(request.text === undefined ? {} : { text: request.text }),
        ...(request.title === undefined ? {} : { title: request.title }),
        ...(request.order === undefined ? {} : { order: request.order }),
        ...(request.pinned === undefined ? {} : { pinned: request.pinned }),
        ...(request.agentPresetId === undefined
          ? {}
          : { agentPresetId: request.agentPresetId }),
      }),
      "draft-create",
    );
    return this.materialize(created);
  }

  /** Return the draft unchanged when its Session exists, otherwise rebind it. */
  async ensureShell(draft: DraftSession): Promise<DraftSession> {
    const response = await this.sessions.list({});
    if (!response.result.ok) {
      throw this.apiError("session-list", response.result.error, { draft });
    }
    if (
      draft.sessionId !== null &&
      response.result.value.items.some(
        (session: { readonly sessionId: unknown }) =>
          session.sessionId === draft.sessionId,
      )
    ) {
      return draft;
    }
    return this.materialize(draft);
  }

  /** Recover every missing Session shell in one Workspace from one list cut. */
  async reconcileWorkspace(workspaceId: string): Promise<DraftSession[]> {
    const drafts = this.remoteValue(
      await this.drafts.list({ workspaceId }),
      "draft-list",
    );
    const response = await this.sessions.list({});
    if (!response.result.ok) {
      throw this.apiError("session-list", response.result.error);
    }
    const existing = new Set(
      response.result.value.items.map(
        (session: { readonly sessionId: unknown }) => String(session.sessionId),
      ),
    );
    const reconciled: DraftSession[] = [];
    for (const draft of drafts) {
      reconciled.push(
        draft.sessionId !== null && existing.has(draft.sessionId)
          ? draft
          : await this.materialize(draft),
      );
    }
    return reconciled;
  }

  private async materialize(draft: DraftSession): Promise<DraftSession> {
    const materializing = this.remoteValue(
      await this.drafts.update({
        id: draft.id,
        expectedRevision: draft.revision,
        state: "materializing",
        lastError: null,
      }),
      "draft-update",
      { draft },
    );

    let response: Awaited<ReturnType<SessionsApi["create"]>>;
    try {
      response = await this.sessions.create({
        workspaceId: materializing.workspaceId as WorkspaceId,
        ...(materializing.agentPresetId === undefined
          ? {}
          : { agentPreset: materializing.agentPresetId }),
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      const failed = await this.markFailed(materializing, message);
      throw new DraftLifecycleError(
        "session-create",
        { code: "transport", message },
        { draft: failed, cause },
      );
    }

    if (!response.result.ok) {
      const failed = await this.markFailed(
        materializing,
        response.result.error.message,
      );
      throw this.apiError("session-create", response.result.error, {
        draft: failed,
      });
    }

    const sessionId = String(response.result.value.sessionId);
    return this.remoteValue(
      await this.drafts.rebind({
        id: materializing.id,
        expectedRevision: materializing.revision,
        sessionId,
      }),
      "draft-rebind",
      { draft: materializing, sessionId },
    );
  }

  private async markFailed(
    draft: DraftSession,
    message: string,
  ): Promise<DraftSession> {
    const request: UpdateDraftRequest = {
      id: draft.id,
      expectedRevision: draft.revision,
      state: "error",
      lastError: message.trim() === "" ? "Session creation failed" : message,
    };
    const result = await this.drafts.update(request);
    return result.ok ? result.value : draft;
  }

  private remoteValue<T>(
    result: RemoteResult<T>,
    stage: DraftLifecycleStage,
    options: {
      readonly draft?: DraftSession;
      readonly sessionId?: string;
    } = {},
  ): T {
    if (result.ok) return result.value;
    throw new DraftLifecycleError(stage, result.error, options);
  }

  private apiError(
    stage: DraftLifecycleStage,
    error: RpcError,
    options: {
      readonly draft?: DraftSession;
      readonly sessionId?: string;
    } = {},
  ): DraftLifecycleError {
    return new DraftLifecycleError(stage, error, options);
  }
}
