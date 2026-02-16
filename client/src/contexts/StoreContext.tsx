import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import * as store from "@/lib/localStore";
import type {
  StoreUser,
  StoreProposal,
  ProposalFile,
  ProposalQuestion,
  ProposalAnswer,
  ShareToken,
  Collaboration,
} from "@/lib/store-types";

interface StoreContextValue {
  // Proposals
  proposals: StoreProposal[];
  getProposals: (ownerId?: number) => StoreProposal[];
  getProposal: (id: number) => StoreProposal | undefined;
  createProposal: (input: Parameters<typeof store.createProposal>[0]) => StoreProposal;
  updateProposal: (id: number, updates: Partial<StoreProposal>) => StoreProposal | null;
  deleteProposal: (id: number) => boolean;
  refreshProposals: () => void;

  // Files
  getProposalFiles: (proposalId: number) => ProposalFile[];
  addProposalFile: (proposalId: number, file: File) => Promise<ProposalFile>;
  removeProposalFile: (fileId: number) => boolean;

  // Questions
  getProposalQuestions: (proposalId: number) => ProposalQuestion[];
  generateAiQuestions: (proposalId: number, title: string, description: string) => ProposalQuestion[];
  addProposalQuestion: (proposalId: number, question: string, source?: "ai" | "user") => ProposalQuestion;
  updateProposalQuestion: (questionId: number, question: string) => ProposalQuestion | null;
  removeProposalQuestion: (questionId: number) => boolean;

  // Answers
  getProposalAnswers: (questionIds: number[]) => ProposalAnswer[];
  getAnswerByQuestion: (questionId: number) => ProposalAnswer | undefined;
  setProposalAnswer: (questionId: number, answer: string, respondentToken?: string | null) => ProposalAnswer;

  // Share link
  getOrCreateShareToken: (proposalId: number) => ShareToken;
  getShareToken: (token: string) => ShareToken | undefined;
  getProposalByShareToken: (token: string) => StoreProposal | undefined;

  // Collaborations
  getCollaborationsByProposal: (proposalId: number) => Collaboration[];
  getCollaborationsByUser: (userId: number) => Collaboration[];
  addCollaboration: (proposalId: number, userId: number, role: string) => Collaboration;
  updateCollaboration: (id: number, updates: Partial<Collaboration>) => Collaboration | null;
  deleteCollaboration: (id: number) => boolean;

  // Users (collaborators for customer)
  getStoreUser: (id: number) => StoreUser | undefined;
  getStoreUserByEmail: (email: string) => StoreUser | undefined;
  getCollaboratorsForCustomer: (customerId: number) => StoreUser[];
  createCollaboratorUser: (input: Parameters<typeof store.createCollaboratorUser>[0]) => StoreUser;
  updateStoreUser: (id: number, updates: Partial<StoreUser>) => StoreUser | null;
  getCollaboratorProposals: (userId: number) => StoreProposal[];
  getCollaboratorsForProposalIds: (proposalIds: number[]) => StoreUser[];

  // Document generation
  generateProposalDocument: (proposalId: number) => StoreProposal | null;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = store.subscribeStore(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const refreshProposals = useCallback(() => {
    store.notifyStore();
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
    proposals: store.getProposals(),
    getProposals: store.getProposals,
    getProposal: store.getProposal,
    createProposal: store.createProposal,
    updateProposal: store.updateProposal,
    deleteProposal: store.deleteProposal,
    refreshProposals,

    getProposalFiles: store.getProposalFiles,
    addProposalFile: store.addProposalFile,
    removeProposalFile: store.removeProposalFile,

    getProposalQuestions: store.getProposalQuestions,
    generateAiQuestions: store.generateAiQuestions,
    addProposalQuestion: store.addProposalQuestion,
    updateProposalQuestion: store.updateProposalQuestion,
    removeProposalQuestion: store.removeProposalQuestion,

    getProposalAnswers: store.getProposalAnswers,
    getAnswerByQuestion: store.getAnswerByQuestion,
    setProposalAnswer: store.setProposalAnswer,

    getOrCreateShareToken: store.getOrCreateShareToken,
    getShareToken: store.getShareToken,
    getProposalByShareToken: store.getProposalByShareToken,

    getCollaborationsByProposal: store.getCollaborationsByProposal,
    getCollaborationsByUser: store.getCollaborationsByUser,
    addCollaboration: store.addCollaboration,
    updateCollaboration: store.updateCollaboration,
    deleteCollaboration: store.deleteCollaboration,

    getStoreUser: store.getStoreUser,
    getStoreUserByEmail: store.getStoreUserByEmail,
    getCollaboratorsForCustomer: store.getCollaboratorsForCustomer,
    createCollaboratorUser: store.createCollaboratorUser,
    updateStoreUser: store.updateStoreUser,
    getCollaboratorProposals: store.getCollaboratorProposals,
    getCollaboratorsForProposalIds: store.getCollaboratorsForProposalIds,

    generateProposalDocument: store.generateProposalDocument,
  }),
    [tick, refreshProposals]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
