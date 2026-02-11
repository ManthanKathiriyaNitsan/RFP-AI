import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProposals,
  fetchProposal,
  createProposal as apiCreateProposal,
  updateProposal as apiUpdateProposal,
  deleteProposal as apiDeleteProposal,
  fetchQuestions,
  createQuestion as apiCreateQuestion,
  updateQuestion as apiUpdateQuestion,
  deleteQuestion as apiDeleteQuestion,
  fetchAnswers,
  setAnswer as apiSetAnswer,
  getDraft as apiGetDraft,
  saveAnswersBulk as apiSaveAnswersBulk,
  getOrCreateShareToken as apiGetOrCreateShareToken,
  fetchProposalByToken,
  submitPublicAnswers as apiSubmitPublicAnswers,
  generateProposalContent as apiGenerateProposalContent,
  generateProposalQuestions as apiGenerateProposalQuestions,
  generateAnswers as apiGenerateAnswers,
  type GenerateAnswersRequest,
  fetchCollaborations,
  fetchMyCollaborations,
  fetchMyCollaboration,
  addCollaboration as apiAddCollaboration,
  updateCollaboration as apiUpdateCollaboration,
  deleteCollaboration as apiDeleteCollaboration,
  fetchAnswerComments as apiFetchAnswerComments,
  addAnswerComment as apiAddAnswerComment,
  fetchProposalComments as apiFetchProposalComments,
  fetchProposalChat as apiFetchProposalChat,
  addProposalChatMessage as apiAddProposalChatMessage,
  fetchProposalSuggestions as apiFetchProposalSuggestions,
  createSuggestion as apiCreateSuggestion,
  updateSuggestionStatus as apiUpdateSuggestionStatus,
  type Proposal,
  type ProposalCreateInput,
  type ProposalUpdateInput,
  type QuestionCreateInput,
  type CollaborationCreateInput,
  type CollaborationUpdateInput,
  type AddCommentRequest,
  type AnswerComment,
} from "@/api/proposals";
import { searchUsers as apiSearchUsers } from "@/api/users";

export const proposalKeys = {
  all: ["proposals"] as const,
  list: () => [...proposalKeys.all, "list"] as const,
  detail: (id: number) => [...proposalKeys.all, "detail", id] as const,
  draft: (proposalId: number) => [...proposalKeys.all, "draft", proposalId] as const,
  questions: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "questions"] as const,
  answers: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "answers"] as const,
  answerComments: (proposalId: number, answerId: number) => [...proposalKeys.all, "detail", proposalId, "answers", answerId, "comments"] as const,
  proposalComments: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "comments"] as const,
  proposalChat: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "chat"] as const,
  suggestions: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "suggestions"] as const,
  publicByToken: (token: string) => ["proposals", "public", token] as const,
  collaborations: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "collaborations"] as const,
  myCollaborations: () => [...proposalKeys.all, "my-collaborations"] as const,
  myCollaboration: (proposalId: number) => [...proposalKeys.all, "detail", proposalId, "my-collaboration"] as const,
};

export function useProposalsList() {
  return useQuery({
    queryKey: proposalKeys.list(),
    queryFn: fetchProposals,
  });
}

export function useProposal(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.detail(proposalId!),
    queryFn: () => fetchProposal(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
  });
}

export function useProposalQuestions(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.questions(proposalId!),
    queryFn: () => fetchQuestions(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
  });
}

export function useProposalAnswers(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.answers(proposalId!),
    queryFn: () => fetchAnswers(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
  });
}

/** Fetch saved draft (proposal + questions + answers) for form rehydration on mount / when navigating back. */
export function useDraft(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.draft(proposalId!),
    queryFn: () => apiGetDraft(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
  });
}

export function useSaveDraft(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      proposal?: ProposalUpdateInput;
      answers: { questionId: number; answer: string }[];
    }) =>
      Promise.all([
        payload.proposal ? apiUpdateProposal(proposalId, { ...payload.proposal, status: "draft" }) : Promise.resolve(null),
        apiSaveAnswersBulk(proposalId, payload.answers),
      ]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.draft(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.questions(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.answers(proposalId) });
    },
  });
}

export function usePublicProposalByToken(token: string | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.publicByToken(token!),
    queryFn: () => fetchProposalByToken(token!),
    enabled: !!token?.trim(),
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposalCreateInput) => apiCreateProposal(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
    },
  });
}

export function useUpdateProposal(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProposalUpdateInput) => apiUpdateProposal(proposalId, body),
    onSuccess: (updatedProposal: Proposal) => {
      // Update detail cache immediately so status/fields show correctly without refetch
      qc.setQueryData(proposalKeys.detail(proposalId), updatedProposal);
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      // Invalidate admin proposals list so status/fields persist when navigating back
      qc.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });
}

export function useDeleteProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDeleteProposal(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: proposalKeys.detail(id) });
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
    },
  });
}

export function useCreateQuestion(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuestionCreateInput) => apiCreateQuestion(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.questions(proposalId) });
    },
  });
}

export function useUpdateQuestion(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      question,
      order,
    }: {
      questionId: number;
      question?: string;
      order?: number;
    }) => apiUpdateQuestion(proposalId, questionId, { question, order }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.questions(proposalId) });
    },
  });
}

export function useDeleteQuestion(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: number) => apiDeleteQuestion(proposalId, questionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.questions(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.answers(proposalId) });
    },
  });
}

export function useSetAnswer(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, answer }: { questionId: number; answer: string }) =>
      apiSetAnswer(proposalId, questionId, answer),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.answers(proposalId) });
    },
  });
}

export function useGetOrCreateShareToken(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiGetOrCreateShareToken(proposalId),
  });
}

export function useSubmitPublicAnswers() {
  return useMutation({
    mutationFn: apiSubmitPublicAnswers,
  });
}

export function useGenerateProposalContent(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body?: Parameters<typeof apiGenerateProposalContent>[1]) =>
      apiGenerateProposalContent(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.detail(proposalId) });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useGenerateProposalQuestions(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiGenerateProposalQuestions(proposalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.questions(proposalId) });
    },
  });
}

export function useGenerateAnswers(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: GenerateAnswersRequest) => apiGenerateAnswers(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.answers(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.draft(proposalId) });
    },
  });
}

// --- Collaborations ---

export function useCollaborations(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.collaborations(proposalId!),
    queryFn: () => fetchCollaborations(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
  });
}

export function useMyCollaborations(userId: number | null | undefined) {
  return useQuery({
    queryKey: [...proposalKeys.myCollaborations(), userId],
    queryFn: () => fetchMyCollaborations(userId),
    enabled: userId != null && Number.isFinite(userId),
    refetchInterval: 30_000, // refetch every 30s so collaborator panel stays up to date
  });
}

export function useMyCollaboration(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.myCollaboration(proposalId!),
    queryFn: () => fetchMyCollaboration(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
    retry: false,
  });
}

export function useAddCollaboration(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CollaborationCreateInput) => apiAddCollaboration(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
    },
  });
}

export function useUpdateCollaboration(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      collaborationId,
      body,
    }: {
      collaborationId: number;
      body: CollaborationUpdateInput;
    }) => apiUpdateCollaboration(proposalId, collaborationId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
    },
  });
}

export function useDeleteCollaboration(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (collaborationId: number) => apiDeleteCollaboration(proposalId, collaborationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.collaborations(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.list() });
      qc.invalidateQueries({ queryKey: proposalKeys.myCollaborations() });
    },
  });
}

export function useAnswerComments(proposalId: number | null, answerId: number | null) {
  return useQuery({
    queryKey: proposalKeys.answerComments(proposalId!, answerId!),
    queryFn: () => apiFetchAnswerComments(proposalId!, answerId!),
    enabled: typeof proposalId === "number" && proposalId > 0 && typeof answerId === "number" && answerId > 0,
    refetchInterval: 4000,
  });
}

export function useAddAnswerComment(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId, ...body }: AddCommentRequest & { answerId: number }) =>
      apiAddAnswerComment(proposalId, answerId, body),
    onSuccess: (_, { answerId }) => {
      qc.invalidateQueries({ queryKey: proposalKeys.answerComments(proposalId, answerId) });
      qc.invalidateQueries({ queryKey: proposalKeys.proposalComments(proposalId) });
    },
  });
}

export function useProposalComments(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.proposalComments(proposalId!),
    queryFn: () => apiFetchProposalComments(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
    refetchInterval: 4000,
  });
}

export function useProposalChat(proposalId: number | null | undefined) {
  return useQuery({
    queryKey: proposalKeys.proposalChat(proposalId!),
    queryFn: () => apiFetchProposalChat(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
    refetchInterval: 4000,
  });
}

export function useAddProposalChatMessage(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { text: string }) => apiAddProposalChatMessage(proposalId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.proposalChat(proposalId) });
    },
  });
}

export function useProposalSuggestions(proposalId: number | null) {
  return useQuery({
    queryKey: proposalKeys.suggestions(proposalId!),
    queryFn: () => apiFetchProposalSuggestions(proposalId!),
    enabled: typeof proposalId === "number" && proposalId > 0,
  });
}

export function useCreateSuggestion(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId, suggestedText, message }: { answerId: number; suggestedText: string; message?: string }) =>
      apiCreateSuggestion(proposalId, answerId, { suggestedText, message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.suggestions(proposalId) });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useUpdateSuggestionStatus(proposalId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ suggestionId, status }: { suggestionId: number; status: "accepted" | "rejected" }) =>
      apiUpdateSuggestionStatus(proposalId, suggestionId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalKeys.suggestions(proposalId) });
      qc.invalidateQueries({ queryKey: proposalKeys.answers(proposalId) });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

// --- Users search (for invite) ---

export const userSearchKeys = {
  search: (params: { email?: string; role?: string }) => ["users", "search", params] as const,
};

export function useSearchUsers(params: { email?: string | null; role?: string | null }) {
  const hasEmail = params.email != null && String(params.email).trim().length >= 2;
  return useQuery({
    queryKey: userSearchKeys.search({ email: params.email ?? undefined, role: params.role ?? undefined }),
    queryFn: () => apiSearchUsers({ email: params.email, role: params.role, limit: 20 }),
    enabled: hasEmail,
  });
}
