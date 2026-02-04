import type {
  StoreData,
  StoreUser,
  StoreProposal,
  ProposalFile,
  ProposalQuestion,
  ProposalAnswer,
  ShareToken,
  Collaboration,
} from "./store-types";

const STORAGE_KEY = "rfp-suite-data";

function nanoid(size = 12): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < size; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function seedData(): StoreData {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 1,
        email: "admin@rfpai.com",
        password: "password",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        company: "RFP AI",
        jobTitle: "System Administrator",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 2,
        email: "john@company.com",
        password: "password",
        firstName: "John",
        lastName: "Smith",
        role: "customer",
        company: "Acme Corporation",
        jobTitle: "Project Manager",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 3,
        email: "sarah@startup.com",
        password: "password",
        firstName: "Sarah",
        lastName: "Johnson",
        role: "collaborator",
        company: "Startup Inc",
        jobTitle: "Technical Writer",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    proposals: [
      {
        id: 1,
        title: "Website Redesign Project",
        description: "Complete redesign of corporate website with modern UI/UX",
        industry: "Technology",
        budgetRange: "$50K - $100K",
        timeline: "3-6 months",
        status: "in_progress",
        content: null,
        ownerId: 2,
        createdAt: now,
        updatedAt: now,
      },
    ],
    proposalFiles: [],
    proposalQuestions: [],
    proposalAnswers: [],
    shareTokens: [],
    collaborations: [],
    nextId: {
      user: 4,
      proposal: 2,
      file: 1,
      question: 1,
      answer: 1,
      shareToken: 1,
      collaboration: 1,
    },
  };
}

function loadData(): StoreData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoreData;
      // Ensure nextId and all arrays exist
      parsed.nextId = parsed.nextId || seedData().nextId;
      parsed.users = parsed.users || [];
      parsed.proposals = parsed.proposals || [];
      parsed.proposalFiles = parsed.proposalFiles || [];
      parsed.proposalQuestions = parsed.proposalQuestions || [];
      parsed.proposalAnswers = parsed.proposalAnswers || [];
      parsed.shareTokens = parsed.shareTokens || [];
      parsed.collaborations = parsed.collaborations || [];
      return parsed;
    }
  } catch (_) {}
  return seedData();
}

let data: StoreData = loadData();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  listeners.forEach((l) => l());
}

// Auth (uses store users)
export function getStoreUserByEmail(email: string): StoreUser | undefined {
  return data.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getStoreUser(id: number): StoreUser | undefined {
  return data.users.find((u) => u.id === id);
}

export function loginFromStore(email: string, password: string): StoreUser | null {
  const user = getStoreUserByEmail(email);
  if (!user || user.password !== password) return null;
  if (user.enabled === false) return null;
  return user;
}

export function registerInStore(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  company?: string;
  jobTitle?: string;
}): StoreUser {
  const id = data.nextId.user++;
  const now = new Date().toISOString();
  const user: StoreUser = {
    id,
    email: userData.email,
    password: userData.password,
    firstName: userData.firstName,
    lastName: userData.lastName,
    role: (userData.role as StoreUser["role"]) || "customer",
    company: userData.company ?? null,
    jobTitle: userData.jobTitle ?? null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };
  data.users.push(user);
  save();
  return user;
}

// Proposals
export function getProposals(ownerId?: number): StoreProposal[] {
  let list = [...data.proposals];
  if (ownerId != null) {
    list = list.filter((p) => p.ownerId === ownerId);
  }
  list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return list;
}

export function getProposal(id: number): StoreProposal | undefined {
  return data.proposals.find((p) => p.id === id);
}

export function createProposal(input: {
  title: string;
  description?: string | null;
  industry?: string | null;
  budgetRange?: string | null;
  timeline?: string | null;
  ownerId: number | null;
  clientName?: string | null;
  clientContact?: string | null;
  clientEmail?: string | null;
}): StoreProposal {
  const id = data.nextId.proposal++;
  const now = new Date().toISOString();
  const proposal: StoreProposal = {
    id,
    title: input.title,
    description: input.description ?? null,
    industry: input.industry ?? null,
    budgetRange: input.budgetRange ?? null,
    timeline: input.timeline ?? null,
    status: "draft",
    content: null,
    ownerId: input.ownerId,
    clientName: input.clientName ?? null,
    clientContact: input.clientContact ?? null,
    clientEmail: input.clientEmail ?? null,
    createdAt: now,
    updatedAt: now,
  };
  data.proposals.push(proposal);
  save();
  return proposal;
}

export function updateProposal(id: number, updates: Partial<StoreProposal>): StoreProposal | null {
  const idx = data.proposals.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  const updated = { ...data.proposals[idx], ...updates, updatedAt: new Date().toISOString() };
  data.proposals[idx] = updated;
  save();
  return updated;
}

export function deleteProposal(id: number): boolean {
  const idx = data.proposals.findIndex((p) => p.id === id);
  if (idx === -1) return false;
  data.proposals.splice(idx, 1);
  data.proposalFiles = data.proposalFiles.filter((f) => f.proposalId !== id);
  data.proposalQuestions = data.proposalQuestions.filter((q) => q.proposalId !== id);
  data.proposalAnswers = data.proposalAnswers.filter((a) => {
    const q = data.proposalQuestions.find((q) => q.id === a.questionId);
    return q && q.proposalId !== id;
  });
  data.shareTokens = data.shareTokens.filter((t) => t.proposalId !== id);
  data.collaborations = data.collaborations.filter((c) => c.proposalId !== id);
  save();
  return true;
}

// Files
export function getProposalFiles(proposalId: number): ProposalFile[] {
  return data.proposalFiles.filter((f) => f.proposalId === proposalId);
}

export function addProposalFile(proposalId: number, file: File): Promise<ProposalFile> {
  const id = data.nextId.file++;
  const now = new Date().toISOString();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string) || "";
      const pf: ProposalFile = {
        id,
        proposalId,
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64,
        createdAt: now,
      };
      data.proposalFiles.push(pf);
      save();
      resolve(pf);
    };
    reader.readAsDataURL(file);
  });
}

export function addProposalFileSync(proposalId: number, name: string, type: string, size: number, base64Data: string): ProposalFile {
  const id = data.nextId.file++;
  const now = new Date().toISOString();
  const pf: ProposalFile = {
    id,
    proposalId,
    name,
    type,
    size,
    data: base64Data,
    createdAt: now,
  };
  data.proposalFiles.push(pf);
  save();
  return pf;
}

export function removeProposalFile(fileId: number): boolean {
  const idx = data.proposalFiles.findIndex((f) => f.id === fileId);
  if (idx === -1) return false;
  data.proposalFiles.splice(idx, 1);
  save();
  return true;
}

// Questions (AI generates from title/description; user can add)
export function generateAiQuestions(proposalId: number, title: string, description: string): ProposalQuestion[] {
  const created: ProposalQuestion[] = [];
  const base = [title, description].filter(Boolean).join(" ");
  const sentences = base.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10);
  const templates = [
    "What are the main objectives for this project?",
    "What is the expected timeline and key milestones?",
    "What is the budget range and payment terms?",
    "What are the key technical or compliance requirements?",
    "Who are the main stakeholders and decision makers?",
    "What does success look like for this engagement?",
  ];
  const used = new Set<string>();
  let order = 0;
  for (const t of templates) {
    if (used.has(t)) continue;
    used.add(t);
    const id = data.nextId.question++;
    const q: ProposalQuestion = {
      id,
      proposalId,
      question: t,
      order: order++,
      source: "ai",
      createdAt: new Date().toISOString(),
    };
    data.proposalQuestions.push(q);
    created.push(q);
  }
  if (sentences.length > 0) {
    const extra = `Please elaborate on: ${sentences.slice(0, 2).join(". ")}`;
    const id = data.nextId.question++;
    const q: ProposalQuestion = {
      id,
      proposalId,
      question: extra,
      order: order++,
      source: "ai",
      createdAt: new Date().toISOString(),
    };
    data.proposalQuestions.push(q);
    created.push(q);
  }
  save();
  return created;
}

export function getProposalQuestions(proposalId: number): ProposalQuestion[] {
  return data.proposalQuestions
    .filter((q) => q.proposalId === proposalId)
    .sort((a, b) => a.order - b.order);
}

export function addProposalQuestion(proposalId: number, question: string, source: "ai" | "user" = "user"): ProposalQuestion {
  const id = data.nextId.question++;
  const order = data.proposalQuestions.filter((q) => q.proposalId === proposalId).length;
  const q: ProposalQuestion = {
    id,
    proposalId,
    question,
    order,
    source,
    createdAt: new Date().toISOString(),
  };
  data.proposalQuestions.push(q);
  save();
  return q;
}

export function updateProposalQuestion(questionId: number, question: string): ProposalQuestion | null {
  const idx = data.proposalQuestions.findIndex((q) => q.id === questionId);
  if (idx === -1) return null;
  data.proposalQuestions[idx] = { ...data.proposalQuestions[idx], question };
  save();
  return data.proposalQuestions[idx];
}

export function removeProposalQuestion(questionId: number): boolean {
  const idx = data.proposalQuestions.findIndex((q) => q.id === questionId);
  if (idx === -1) return false;
  data.proposalQuestions.splice(idx, 1);
  data.proposalAnswers = data.proposalAnswers.filter((a) => a.questionId !== questionId);
  save();
  return true;
}

// Answers
export function getProposalAnswers(questionIds: number[]): ProposalAnswer[] {
  const set = new Set(questionIds);
  return data.proposalAnswers.filter((a) => set.has(a.questionId));
}

export function getAnswerByQuestion(questionId: number): ProposalAnswer | undefined {
  return data.proposalAnswers.find((a) => a.questionId === questionId);
}

export function setProposalAnswer(questionId: number, answer: string, respondentToken?: string | null): ProposalAnswer {
  const existing = data.proposalAnswers.find((a) => a.questionId === questionId);
  const now = new Date().toISOString();
  if (existing) {
    existing.answer = answer;
    existing.updatedAt = now;
    if (respondentToken != null) existing.respondentToken = respondentToken;
    save();
    return existing;
  }
  const id = data.nextId.answer++;
  const a: ProposalAnswer = {
    id,
    questionId,
    answer,
    respondentToken: respondentToken ?? null,
    createdAt: now,
    updatedAt: now,
  };
  data.proposalAnswers.push(a);
  save();
  return a;
}

// Share token (unique public link)
export function getOrCreateShareToken(proposalId: number): ShareToken {
  let st = data.shareTokens.find((t) => t.proposalId === proposalId);
  if (st) return st;
  const id = data.nextId.shareToken++;
  const token = nanoid(16);
  st = {
    id,
    proposalId,
    token,
    createdAt: new Date().toISOString(),
  };
  data.shareTokens.push(st);
  save();
  return st;
}

export function getShareToken(token: string): ShareToken | undefined {
  return data.shareTokens.find((t) => t.token === token);
}

export function getProposalByShareToken(token: string): StoreProposal | undefined {
  const st = getShareToken(token);
  if (!st) return undefined;
  return getProposal(st.proposalId);
}

// Collaborations
export function getCollaborationsByProposal(proposalId: number): Collaboration[] {
  return data.collaborations.filter((c) => c.proposalId === proposalId);
}

export function getCollaborationsByUser(userId: number): Collaboration[] {
  return data.collaborations.filter((c) => c.userId === userId);
}

export function addCollaboration(proposalId: number, userId: number, role: string): Collaboration {
  const id = data.nextId.collaboration++;
  const now = new Date().toISOString();
  const c: Collaboration = {
    id,
    proposalId,
    userId,
    role,
    enabled: true,
    createdAt: now,
  };
  data.collaborations.push(c);
  save();
  return c;
}

export function updateCollaboration(id: number, updates: Partial<Collaboration>): Collaboration | null {
  const idx = data.collaborations.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  data.collaborations[idx] = { ...data.collaborations[idx], ...updates };
  save();
  return data.collaborations[idx];
}

export function deleteCollaboration(id: number): boolean {
  const idx = data.collaborations.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  data.collaborations.splice(idx, 1);
  save();
  return true;
}

// Collaborators (users with role collaborator) - for customer management
export function getCollaboratorsForCustomer(customerId: number): StoreUser[] {
  const proposalIds = data.proposals.filter((p) => p.ownerId === customerId).map((p) => p.id);
  const userIds = new Set(data.collaborations.filter((c) => proposalIds.includes(c.proposalId)).map((c) => c.userId));
  return data.users.filter((u) => u.role === "collaborator" && userIds.has(u.id));
}

export function getAllCollaboratorsAsUsers(): StoreUser[] {
  return data.users.filter((u) => u.role === "collaborator");
}

export function createCollaboratorUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  jobTitle?: string;
}): StoreUser {
  return registerInStore({ ...input, role: "collaborator" });
}

export function updateStoreUser(id: number, updates: Partial<StoreUser>): StoreUser | null {
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  const updated = { ...data.users[idx], ...updates, updatedAt: new Date().toISOString() };
  data.users[idx] = updated;
  save();
  return updated;
}

export function getCollaboratorProposals(userId: number): StoreProposal[] {
  const collabIds = data.collaborations.filter((c) => c.userId === userId).map((c) => c.proposalId);
  return data.proposals.filter((p) => collabIds.includes(p.id));
}

/** Get unique collaborator users (store users) who have collaborations on any of the given proposal IDs. */
export function getCollaboratorsForProposalIds(proposalIds: number[]): StoreUser[] {
  const set = new Set(proposalIds);
  const userIds = new Set(
    data.collaborations.filter((c) => set.has(c.proposalId)).map((c) => c.userId)
  );
  return data.users.filter((u) => u.role === "collaborator" && userIds.has(u.id));
}

// AI generate proposal document from Step 1 + Step 2
export function generateProposalDocument(proposalId: number): StoreProposal | null {
  const proposal = getProposal(proposalId);
  if (!proposal) return null;
  const questions = getProposalQuestions(proposalId);
  const answers = data.proposalAnswers.filter((a) => questions.some((q) => q.id === a.questionId));
  const qaText = questions
    .map((q) => {
      const a = answers.find((x) => x.questionId === q.id);
      return `${q.question}\n${a?.answer || "(No answer)"}`;
    })
    .join("\n\n");

  const content = {
    executiveSummary: `This proposal outlines our approach for ${proposal.title}. ${proposal.description || ""}`,
    introduction: `We are pleased to submit this proposal for ${proposal.title}. The following sections detail our understanding and approach based on your requirements.`,
    projectOverview: {
      title: proposal.title,
      description: proposal.description || "",
      industry: proposal.industry || "",
      timeline: proposal.timeline || "",
      budget: proposal.budgetRange || "",
    },
    requirementsAndAnswers: qaText,
    generatedAt: new Date().toISOString(),
  };

  return updateProposal(proposalId, { content, status: "in_progress" });
}

// Subscribe for React (reload from localStorage and notify)
let listeners: Array<() => void> = [];
export function subscribeStore(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

export function notifyStore() {
  data = loadData();
  listeners.forEach((l) => l());
}

export function getStoreData(): StoreData {
  return data;
}
