/**
 * Proposals API – types and requests matching backend /api/v1/proposals and /api/v1/public.
 * Backend uses camelCase in JSON; status draft | in_progress | completed.
 */

import { getApiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { authStorage } from "@/lib/auth";

const PROPOSALS = "/api/v1/proposals";
const PUBLIC = "/api/v1/public";

/** Query string for caller identity so server can enforce role-based access (e.g. collaborator canView/canEdit). */
function callerQuery(): string {
  const auth = authStorage.getAuth();
  const q = new URLSearchParams();
  if (auth.user?.id != null) q.set("userId", String(auth.user.id));
  if (auth.currentRole) q.set("userRole", auth.currentRole);
  const s = q.toString();
  return s ? `?${s}` : "";
}

// --- Types (camelCase as returned by backend) ---

export type ProposalStatus = "draft" | "in_progress" | "completed";

export interface Proposal {
  id: number;
  title: string;
  description: string | null;
  industry: string | null;
  budgetRange: string | null;
  timeline: string | null;
  dueDate?: string | null; // ISO date "YYYY-MM-DD"
  status: ProposalStatus;
  content: Record<string, unknown> | null;
  ownerId: number | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalCreateInput {
  title: string;
  description?: string | null;
  industry?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  dueDate?: string | null; // ISO "YYYY-MM-DD"
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
}

export interface ProposalUpdateInput {
  title?: string | null;
  description?: string | null;
  industry?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  dueDate?: string | null;
  status?: ProposalStatus | null;
  content?: Record<string, unknown> | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
}

export interface Question {
  id: number;
  proposalId: number;
  question: string;
  order: number;
  source: string;
  createdAt: string;
}

export interface QuestionCreateInput {
  question: string;
  source?: string;
  order?: number;
}

export interface Answer {
  id: number;
  questionId: number;
  answer: string;
  respondentToken?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShareToken {
  id: number;
  proposalId: number;
  token: string;
  createdAt: string;
}

export interface PublicProposalByTokenResponse {
  proposal: Proposal;
  questions: Question[];
}

export interface AnswerSet {
  questionId: number;
  answer: string;
}

export interface PublicAnswerSubmitInput {
  token: string;
  answers: AnswerSet[];
}

/** Draft response: proposal + questions + answers for form rehydration (backend source of truth). */
export interface DraftResponse {
  proposal: Proposal;
  questions: Question[];
  answers: Answer[];
  status: string;
}

// --- API functions ---

export async function fetchProposals(): Promise<Proposal[]> {
  const res = await apiRequest("GET", PROPOSALS);
  return res.json();
}

export async function fetchProposal(proposalId: number): Promise<Proposal> {
  const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}${callerQuery()}`);
  return res.json();
}

export async function createProposal(body: ProposalCreateInput): Promise<Proposal> {
  const res = await apiRequest("POST", PROPOSALS, body);
  return res.json();
}

export async function updateProposal(proposalId: number, body: ProposalUpdateInput): Promise<Proposal> {
  const res = await apiRequest("PATCH", `${PROPOSALS}/${proposalId}${callerQuery()}`, body);
  return res.json();
}

export async function deleteProposal(proposalId: number): Promise<void> {
  await apiRequest("DELETE", `${PROPOSALS}/${proposalId}`);
}

/** Response from backend when parsing an uploaded RFP file (PDF/Word). */
export interface ParseRfpUploadResponse {
  title?: string;
  questions: { question: string; order: number }[];
}

/**
 * Upload a file for RFP question extraction. Backend may return 404/501 if parser is not implemented;
 * caller should then create a proposal with placeholder questions.
 */
export async function parseRfpUpload(file: File): Promise<ParseRfpUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(getApiUrl(`${PROPOSALS}/parse-upload`), {
    method: "POST",
    headers,
    body: formData,
    credentials: "include",
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text() || res.statusText}`);
  return res.json();
}

/** Activity entry for proposal activity log (and collaborator "my changes"). */
export interface ProposalActivityEntry {
  id: string;
  action: string;
  userId?: number;
  userName?: string;
  timestamp: string;
  details?: string;
}

export interface ProposalActivityResponse {
  entries: ProposalActivityEntry[];
}

export async function fetchProposalActivity(proposalId: number): Promise<ProposalActivityResponse> {
  try {
    const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}/activity${callerQuery()}`);
    const data = await res.json();
    return Array.isArray((data as { entries?: unknown }).entries)
      ? (data as ProposalActivityResponse)
      : { entries: [] };
  } catch {
    return { entries: [] };
  }
}

export async function fetchQuestions(proposalId: number): Promise<Question[]> {
  const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}/questions`);
  return res.json();
}

export async function createQuestion(
  proposalId: number,
  body: QuestionCreateInput
): Promise<Question> {
  const res = await apiRequest("POST", `${PROPOSALS}/${proposalId}/questions`, {
    question: body.question,
    source: body.source ?? "user",
    order: body.order ?? 0,
  });
  return res.json();
}

export async function updateQuestion(
  proposalId: number,
  questionId: number,
  body: { question?: string; order?: number }
): Promise<Question> {
  const res = await apiRequest(
    "PATCH",
    `${PROPOSALS}/${proposalId}/questions/${questionId}`,
    body
  );
  return res.json();
}

export async function deleteQuestion(proposalId: number, questionId: number): Promise<void> {
  await apiRequest("DELETE", `${PROPOSALS}/${proposalId}/questions/${questionId}`);
}

export async function fetchAnswers(proposalId: number): Promise<Answer[]> {
  const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}/answers`);
  return res.json();
}

/** Fetch saved draft (proposal + questions + answers) for form rehydration. Use on mount / when navigating back. */
export async function getDraft(proposalId: number): Promise<DraftResponse> {
  const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}/draft`);
  return res.json();
}

/** UPSERT all answers in one call. Use on Save draft. */
export async function saveAnswersBulk(
  proposalId: number,
  answers: { questionId: number; answer: string }[]
): Promise<Answer[]> {
  const res = await apiRequest("POST", `${PROPOSALS}/${proposalId}/answers/bulk`, { answers });
  return res.json();
}

export async function setAnswer(proposalId: number, questionId: number, answer: string): Promise<Answer> {
  const res = await apiRequest("POST", `${PROPOSALS}/${proposalId}/answers`, {
    questionId,
    answer,
  });
  return res.json();
}

export async function getOrCreateShareToken(proposalId: number): Promise<ShareToken> {
  const res = await apiRequest("POST", `${PROPOSALS}/${proposalId}/share-token`);
  return res.json();
}

// Public (no auth)
export async function fetchProposalByToken(token: string): Promise<PublicProposalByTokenResponse> {
  const url = `${getApiUrl(PUBLIC + "/proposal-by-token")}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export async function submitPublicAnswers(body: PublicAnswerSubmitInput): Promise<{ ok: boolean }> {
  const res = await fetch(getApiUrl(PUBLIC + "/answer-by-token"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

// AI generate (optional body)
export async function generateProposalContent(
  proposalId: number,
  body?: {
    requirements?: string[];
    aiContext?: string | null;
    clientName?: string | null;
    clientContact?: string | null;
    clientEmail?: string | null;
  }
): Promise<Record<string, unknown>> {
  const res = await apiRequest("POST", `/api/v1/ai/proposals/${proposalId}/generate`, body ?? {});
  return res.json();
}

// AI generate questions (Ollama/OpenAI) and create them on the proposal
export async function generateProposalQuestions(proposalId: number): Promise<Question[]> {
  const res = await apiRequest("POST", `/api/v1/ai/proposals/${proposalId}/generate-questions`, {});
  return res.json();
}

// --- Collaborations (camelCase from backend) ---

export interface CollaboratorUserInfo {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Collaboration {
  id: number;
  proposalId: number;
  userId: number;
  role: string;
  enabled: boolean;
  canView: boolean;
  canEdit: boolean;
  canComment: boolean;
  canReview: boolean;
  canGenerateAi: boolean;
  createdAt: string;
  user?: CollaboratorUserInfo;
}

export interface CollaborationCreateInput {
  userId: number;
  role?: string;
  canView?: boolean;
  canEdit?: boolean;
  canComment?: boolean;
  canReview?: boolean;
  canGenerateAi?: boolean;
}

export interface CollaborationUpdateInput {
  role?: string;
  enabled?: boolean;
  canView?: boolean;
  canEdit?: boolean;
  canComment?: boolean;
  canReview?: boolean;
  canGenerateAi?: boolean;
}

export interface MyCollaborationItem {
  proposal: Proposal;
  collaboration: Collaboration;
}

export async function fetchCollaborations(proposalId: number): Promise<Collaboration[]> {
  try {
    const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}/collaborations${callerQuery()}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("403") || msg.startsWith("404")) return [];
    throw e;
  }
}

export async function fetchMyCollaborations(userId: number | null | undefined): Promise<MyCollaborationItem[]> {
  if (userId == null || !Number.isFinite(userId)) return [];
  try {
    const res = await apiRequest("GET", `${PROPOSALS}/my-collaborations?userId=${userId}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    const items = (data as { items?: MyCollaborationItem[]; data?: MyCollaborationItem[] }).items
      ?? (data as { items?: MyCollaborationItem[]; data?: MyCollaborationItem[] }).data;
    return Array.isArray(items) ? items : [];
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("403") || msg.startsWith("404")) return [];
    throw e;
  }
}

export async function fetchMyCollaboration(proposalId: number): Promise<Collaboration | null> {
  try {
    const res = await apiRequest("GET", `${PROPOSALS}/${proposalId}/my-collaboration${callerQuery()}`);
    const data = await res.json();
    return data as Collaboration;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("403") || msg.startsWith("404")) return null;
    throw e;
  }
}

/** Build collaboration body for backend: always send explicit booleans so backend gets clear values. */
function collaborationCreateBody(body: CollaborationCreateInput): Record<string, unknown> {
  return {
    userId: body.userId,
    role: body.role ?? "viewer",
    canView: body.canView ?? true,
    canEdit: body.canEdit ?? false,
    canComment: body.canComment ?? false,
    canReview: body.canReview ?? false,
    canGenerateAi: body.canGenerateAi ?? false,
  };
}

export async function addCollaboration(
  proposalId: number,
  body: CollaborationCreateInput
): Promise<Collaboration> {
  const res = await apiRequest(
    "POST",
    `${PROPOSALS}/${proposalId}/collaborations${callerQuery()}`,
    collaborationCreateBody(body)
  );
  return res.json();
}

export async function updateCollaboration(
  proposalId: number,
  collaborationId: number,
  body: CollaborationUpdateInput
): Promise<Collaboration> {
  const res = await apiRequest(
    "PATCH",
    `${PROPOSALS}/${proposalId}/collaborations/${collaborationId}${callerQuery()}`,
    body
  );
  return res.json();
}

export async function deleteCollaboration(
  proposalId: number,
  collaborationId: number
): Promise<void> {
  await apiRequest("DELETE", `${PROPOSALS}/${proposalId}/collaborations/${collaborationId}${callerQuery()}`);
}

/** Chat messages for a proposal (enforces canView on server when caller params sent). */
export async function fetchChatMessages(proposalId: number): Promise<unknown[]> {
  const res = await apiRequest("GET", `/api/chat/${proposalId}${callerQuery()}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
