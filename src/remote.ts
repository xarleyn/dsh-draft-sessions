import type {
  InvocationDescriptor,
  RemoteResult,
  TypertRemoteContribution,
  TypertRemoteNamespace,
  TypertSchema,
} from "@deepseek-ai/dsh-typert-protocol";
import {
  createDraftRequestSchema,
  deleteDraftRequestSchema,
  deleteDraftResultSchema,
  draftSessionsSchema,
  draftSessionSchema,
  listDraftsRequestSchema,
  rebindDraftRequestSchema,
  updateDraftRequestSchema,
} from "./shared/schema.js";
import type {
  CreateDraftRequest,
  DeleteDraftRequest,
  DeleteDraftResult,
  DraftSession,
  ListDraftsRequest,
  RebindDraftRequest,
  UpdateDraftRequest,
} from "./shared/types.js";

function descriptor(
  method: string,
  requestType: string,
  requestSchema: TypertSchema,
  resultType: string,
  resultSchema: TypertSchema,
): InvocationDescriptor {
  return {
    id: `dsh-draft-sessions#draftSessions/${method}`,
    service: "draftSessions",
    namespace: "draftSessions",
    method,
    invocation: { kind: "direct" },
    parameters: [
      {
        name: "request",
        wire: "request",
        source: "json",
        codec: {
          mode: "strict",
          typeSymbol: requestType,
          schema: requestSchema,
        },
      },
    ],
    result: { mode: "strict", typeSymbol: resultType, schema: resultSchema },
  };
}

declare module "@deepseek-ai/dsh-typert-protocol" {
  interface TypertRemoteMap {
    "draftSessions/list": (
      request: ListDraftsRequest,
    ) => Promise<RemoteResult<DraftSession[]>>;
    "draftSessions/create": (
      request: CreateDraftRequest,
    ) => Promise<RemoteResult<DraftSession>>;
    "draftSessions/update": (
      request: UpdateDraftRequest,
    ) => Promise<RemoteResult<DraftSession>>;
    "draftSessions/delete": (
      request: DeleteDraftRequest,
    ) => Promise<RemoteResult<DeleteDraftResult>>;
    "draftSessions/rebind": (
      request: RebindDraftRequest,
    ) => Promise<RemoteResult<DraftSession>>;
  }

  interface TypertRemoteNamespaceMap {
    draftSessions: TypertRemoteNamespace<"draftSessions">;
  }
}

const draftSessionsRemote = {
  package: "dsh-draft-sessions",
  descriptors: [
    descriptor(
      "list",
      "dsh-draft-sessions/types#ListDraftsRequest",
      listDraftsRequestSchema,
      "dsh-draft-sessions/types#DraftSession[]",
      draftSessionsSchema,
    ),
    descriptor(
      "create",
      "dsh-draft-sessions/types#CreateDraftRequest",
      createDraftRequestSchema,
      "dsh-draft-sessions/types#DraftSession",
      draftSessionSchema,
    ),
    descriptor(
      "update",
      "dsh-draft-sessions/types#UpdateDraftRequest",
      updateDraftRequestSchema,
      "dsh-draft-sessions/types#DraftSession",
      draftSessionSchema,
    ),
    descriptor(
      "delete",
      "dsh-draft-sessions/types#DeleteDraftRequest",
      deleteDraftRequestSchema,
      "dsh-draft-sessions/types#DeleteDraftResult",
      deleteDraftResultSchema,
    ),
    descriptor(
      "rebind",
      "dsh-draft-sessions/types#RebindDraftRequest",
      rebindDraftRequestSchema,
      "dsh-draft-sessions/types#DraftSession",
      draftSessionSchema,
    ),
  ],
} satisfies TypertRemoteContribution;

export default draftSessionsRemote;
