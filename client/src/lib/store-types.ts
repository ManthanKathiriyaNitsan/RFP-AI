// Client-side JSON store types (no backend)

export interface StoreUser {
  id: number;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "customer" | "admin" | "collaborator";
  company?: string | null;
  jobTitle?: string | null;
  enabled?: boolean; // for collaborators: customer can enable/disable
  createdAt: string;
  updatedAt: string;
}

export interface ProposalFile {
  id: number;
  proposalId: number;
  name: string;
  type: string;
  size: number;
  data: string; // base64 for localStorage
  createdAt: string;
}

export interface ProposalQuestion {
  id: number;
  proposalId: number;
  question: string;
  order: number;
  source: "ai" | "user";
  createdAt: string;
}

export interface ProposalAnswer {
  id: number;
  questionId: number;
  answer: string;
  respondentToken?: string | null; // if submitted via public link
  createdAt: string;
  updatedAt: string;
}

export interface ShareToken {
  id: number;
  proposalId: number;
  token: string;
  createdAt: string;
}

export interface StoreProposal {
  id: number;
  title: string;
  description: string | null;
  industry: string | null;
  budgetRange: string | null;
  timeline: string | null;
  status: "draft" | "in_progress" | "completed";
  content: Record<string, unknown> | null;
  ownerId: number | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Collaboration {
  id: number;
  proposalId: number;
  userId: number;
  role: string;
  enabled?: boolean;
  createdAt: string;
}

export interface StoreData {
  users: StoreUser[];
  proposals: StoreProposal[];
  proposalFiles: ProposalFile[];
  proposalQuestions: ProposalQuestion[];
  proposalAnswers: ProposalAnswer[];
  shareTokens: ShareToken[];
  collaborations: Collaboration[];
  nextId: {
    user: number;
    proposal: number;
    file: number;
    question: number;
    answer: number;
    shareToken: number;
    collaboration: number;
  };
}
