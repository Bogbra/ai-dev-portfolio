export { contactSchema, PROJECT_TYPES } from './contact.js';
export type { ContactPayload, ProjectType } from './contact.js';

export {
  parsedContactSchema,
  uploadResponseSchema,
  workflowRunRequestSchema,
  emailDraftSchema,
  workflowResultSchema,
} from './workflow.js';
export type {
  ParsedContact,
  UploadResponse,
  WorkflowRunRequest,
  EmailDraft,
  WorkflowResult,
  WorkflowRunResponse,
} from './workflow.js';

export { multiAgentPostRequestSchema, multiAgentPostResultSchema } from './multi-agent-post.js';
export type {
  MultiAgentPostRequest,
  MultiAgentPostResult,
  AgentStep,
  SourceResult,
  ResearchContext,
  CriticFeedback,
  GroundednessResult,
  FinalPostDraft,
} from './multi-agent-post.js';

export {
  ragUploadFileSchema,
  ragUploadRequestSchema,
  ragAskRequestSchema,
  retrievedChunkSchema,
  pipelineStepSchema,
  ragUploadResultSchema,
  ragAskResultSchema,
} from './rag.js';
export type {
  RagUploadRequest,
  RagAskRequest,
  RetrievedChunk,
  PipelineStep,
  RagUploadResult,
  RagAskResult,
} from './rag.js';

export { seoStrategyRequestSchema } from './seo.js';
export type {
  SeoStrategyRequest,
  SeoStrategyResult,
  BusinessContext,
  KeywordCandidate,
  IntentCluster,
  RankedOpportunity,
  ContentIdea,
  LeadAngle,
  RoadmapPhase,
  SeoRelevance,
  SeoIntentFit,
} from './seo.js';
