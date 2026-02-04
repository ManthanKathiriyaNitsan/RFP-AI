import { 
  users, 
  proposals, 
  collaborations, 
  chatMessages, 
  creditTransactions,
  type User, 
  type InsertUser,
  type Proposal,
  type InsertProposal,
  type Collaboration,
  type InsertCollaboration,
  type ChatMessage,
  type InsertChatMessage,
  type CreditTransaction,
  type InsertCreditTransaction
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Proposals
  getProposal(id: number): Promise<Proposal | undefined>;
  getAllProposals(): Promise<Proposal[]>;
  getProposalsByUserId(userId: number): Promise<Proposal[]>;
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  updateProposal(id: number, updates: Partial<Proposal>): Promise<Proposal>;
  deleteProposal(id: number): Promise<void>;

  // Collaborations
  getCollaborationsByProposalId(proposalId: number): Promise<Collaboration[]>;
  getCollaborationsByUserId(userId: number): Promise<Collaboration[]>;
  getCollaboration(id: number): Promise<Collaboration | undefined>;
  createCollaboration(collaboration: InsertCollaboration): Promise<Collaboration>;
  updateCollaboration(id: number, updates: Partial<Pick<Collaboration, "role">>): Promise<Collaboration>;
  deleteCollaboration(id: number): Promise<void>;

  // Chat Messages
  getChatMessagesByProposalId(proposalId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Credit Transactions
  getCreditTransactionsByUserId(userId: number): Promise<CreditTransaction[]>;
  createCreditTransaction(transaction: InsertCreditTransaction): Promise<CreditTransaction>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private proposals: Map<number, Proposal> = new Map();
  private collaborations: Map<number, Collaboration> = new Map();
  private chatMessages: Map<number, ChatMessage> = new Map();
  private creditTransactions: Map<number, CreditTransaction> = new Map();
  
  private currentId = {
    user: 1,
    proposal: 1,
    collaboration: 1,
    chatMessage: 1,
    creditTransaction: 1,
  };

  constructor() {
    this.seedData();
  }

  private seedData() {
    // Seed admin user
    const admin: User = {
      id: this.currentId.user++,
      username: "admin",
      email: "admin@rfpai.com",
      password: "password",
      firstName: "Admin",
      lastName: "User",
      role: "admin",
      company: "RFP AI",
      jobTitle: "System Administrator",
      bio: "System administrator for RFP AI platform",
      credits: 10000,
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(admin.id, admin);

    // Seed customer user
    const customer: User = {
      id: this.currentId.user++,
      username: "john.smith",
      email: "john@company.com",
      password: "password",
      firstName: "John",
      lastName: "Smith",
      role: "customer",
      company: "Acme Corporation",
      jobTitle: "Project Manager",
      bio: "Experienced project manager with 10+ years in technology consulting.",
      credits: 247,
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(customer.id, customer);

    // Seed collaborator user
    const collaborator: User = {
      id: this.currentId.user++,
      username: "sarah.johnson",
      email: "sarah@startup.com",
      password: "password",
      firstName: "Sarah",
      lastName: "Johnson",
      role: "collaborator",
      company: "Startup Inc",
      jobTitle: "Technical Writer",
      bio: "Technical writer specializing in RFP documentation",
      credits: 89,
      avatar: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(collaborator.id, collaborator);

    // Seed proposals
    const proposals = [
      {
        id: this.currentId.proposal++,
        title: "Website Redesign Project",
        description: "Complete redesign of corporate website with modern UI/UX",
        industry: "Technology",
        budgetRange: "$50K - $100K",
        timeline: "3-6 months",
        status: "in_progress",
        content: {},
        ownerId: customer.id,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: this.currentId.proposal++,
        title: "Mobile App Development",
        description: "Cross-platform mobile application for customer engagement",
        industry: "Technology",
        budgetRange: "$100K - $500K",
        timeline: "6-12 months",
        status: "draft",
        content: {},
        ownerId: customer.id,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
      {
        id: this.currentId.proposal++,
        title: "Cloud Infrastructure Setup",
        description: "Migration to cloud infrastructure with enhanced security",
        industry: "Technology",
        budgetRange: "$100K - $500K",
        timeline: "6-12 months",
        status: "completed",
        content: {},
        ownerId: customer.id,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
      {
        id: this.currentId.proposal++,
        title: "E-commerce Platform Development",
        description: "Full-featured e-commerce platform with payment integration",
        industry: "Technology",
        budgetRange: "$150K - $200K",
        timeline: "6 months",
        status: "in_progress",
        content: {},
        ownerId: customer.id,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
      {
        id: this.currentId.proposal++,
        title: "Marketing Automation Setup",
        description: "Implementation of marketing automation workflows",
        industry: "Marketing",
        budgetRange: "$50K - $75K",
        timeline: "3 months",
        status: "draft",
        content: {},
        ownerId: customer.id,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    ];

    proposals.forEach(proposal => {
      this.proposals.set(proposal.id, proposal as Proposal);
    });

    // Seed collaborations
    const collaborations = [
      {
        id: this.currentId.collaboration++,
        proposalId: 4, // E-commerce Platform Development
        userId: collaborator.id,
        role: "Technical Reviewer",
        createdAt: new Date(),
      },
      {
        id: this.currentId.collaboration++,
        proposalId: 5, // Marketing Automation Setup
        userId: collaborator.id,
        role: "Content Editor",
        createdAt: new Date(),
      },
    ];

    collaborations.forEach(collaboration => {
      this.collaborations.set(collaboration.id, collaboration as Collaboration);
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId.user++;
    const user: User = {
      id,
      username: insertUser.username,
      email: insertUser.email,
      password: insertUser.password,
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      role: insertUser.role || "customer",
      company: insertUser.company || null,
      jobTitle: insertUser.jobTitle || null,
      bio: insertUser.bio || null,
      credits: insertUser.credits || 0,
      avatar: insertUser.avatar || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    
    const updatedUser = { ...user, ...updates, updatedAt: new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<void> {
    if (!this.users.has(id)) throw new Error("User not found");
    this.users.delete(id);
    // Unlink proposals owned by this user so they remain but show no owner
    for (const [proposalId, proposal] of this.proposals.entries()) {
      if (proposal.ownerId === id) {
        this.proposals.set(proposalId, { ...proposal, ownerId: null, updatedAt: new Date() });
      }
    }
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => {
      // Sort by createdAt (newest first)
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA; // Descending order (newest first)
    });
  }

  // Proposal methods
  async getProposal(id: number): Promise<Proposal | undefined> {
    return this.proposals.get(id);
  }

  async getAllProposals(): Promise<Proposal[]> {
    return Array.from(this.proposals.values()).sort((a, b) => {
      // Sort by updatedAt first (most recently updated), then by createdAt (newest first)
      const dateA = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
      const dateB = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
      return dateB - dateA; // Descending order (newest first)
    });
  }

  async getProposalsByUserId(userId: number): Promise<Proposal[]> {
    return Array.from(this.proposals.values())
      .filter(proposal => proposal.ownerId === userId)
      .sort((a, b) => {
        // Sort by updatedAt first (most recently updated), then by createdAt (newest first)
        const dateA = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
        const dateB = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
        return dateB - dateA; // Descending order (newest first)
      });
  }

  async createProposal(insertProposal: InsertProposal): Promise<Proposal> {
    const id = this.currentId.proposal++;
    const proposal: Proposal = {
      id,
      title: insertProposal.title,
      description: insertProposal.description || null,
      industry: insertProposal.industry || null,
      budgetRange: insertProposal.budgetRange || null,
      timeline: insertProposal.timeline || null,
      status: insertProposal.status || "draft",
      content: insertProposal.content || null,
      ownerId: insertProposal.ownerId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.proposals.set(id, proposal);
    return proposal;
  }

  async updateProposal(id: number, updates: Partial<Proposal>): Promise<Proposal> {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error("Proposal not found");
    
    const updatedProposal = { ...proposal, ...updates, updatedAt: new Date() };
    this.proposals.set(id, updatedProposal);
    return updatedProposal;
  }

  async deleteProposal(id: number): Promise<void> {
    this.proposals.delete(id);
  }

  // Collaboration methods
  async getCollaborationsByProposalId(proposalId: number): Promise<Collaboration[]> {
    return Array.from(this.collaborations.values())
      .filter(collab => collab.proposalId === proposalId)
      .sort((a, b) => {
        // Sort by createdAt (newest first)
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA; // Descending order (newest first)
      });
  }

  async getCollaborationsByUserId(userId: number): Promise<Collaboration[]> {
    return Array.from(this.collaborations.values())
      .filter(collab => collab.userId === userId)
      .sort((a, b) => {
        // Sort by createdAt (newest first)
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA; // Descending order (newest first)
      });
  }

  async getCollaboration(id: number): Promise<Collaboration | undefined> {
    return this.collaborations.get(id);
  }

  async createCollaboration(insertCollaboration: InsertCollaboration): Promise<Collaboration> {
    const id = this.currentId.collaboration++;
    const collaboration: Collaboration = {
      id,
      proposalId: insertCollaboration.proposalId || null,
      userId: insertCollaboration.userId || null,
      role: insertCollaboration.role,
      createdAt: new Date(),
    };
    this.collaborations.set(id, collaboration);
    return collaboration;
  }

  async updateCollaboration(id: number, updates: Partial<Pick<Collaboration, "role">>): Promise<Collaboration> {
    const collaboration = this.collaborations.get(id);
    if (!collaboration) throw new Error("Collaboration not found");
    const updated = { ...collaboration, ...updates };
    this.collaborations.set(id, updated);
    return updated;
  }

  async deleteCollaboration(id: number): Promise<void> {
    this.collaborations.delete(id);
  }

  // Chat message methods
  async getChatMessagesByProposalId(proposalId: number): Promise<ChatMessage[]> {
    return Array.from(this.chatMessages.values())
      .filter(message => message.proposalId === proposalId)
      .sort((a, b) => {
        // Sort by createdAt (newest first)
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA; // Descending order (newest first)
      });
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = this.currentId.chatMessage++;
    const message: ChatMessage = {
      id,
      proposalId: insertMessage.proposalId || null,
      userId: insertMessage.userId || null,
      message: insertMessage.message,
      isAi: insertMessage.isAi || null,
      createdAt: new Date(),
    };
    this.chatMessages.set(id, message);
    return message;
  }

  // Credit transaction methods
  async getCreditTransactionsByUserId(userId: number): Promise<CreditTransaction[]> {
    return Array.from(this.creditTransactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => {
        // Sort by createdAt (newest first)
        const dateA = a.createdAt?.getTime() || 0;
        const dateB = b.createdAt?.getTime() || 0;
        return dateB - dateA; // Descending order (newest first)
      });
  }

  async createCreditTransaction(insertTransaction: InsertCreditTransaction): Promise<CreditTransaction> {
    const id = this.currentId.creditTransaction++;
    const transaction: CreditTransaction = {
      id,
      userId: insertTransaction.userId || null,
      amount: insertTransaction.amount,
      type: insertTransaction.type,
      description: insertTransaction.description || null,
      createdAt: new Date(),
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }
}

export const storage = new MemStorage();
