// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
var MemStorage = class {
  users = /* @__PURE__ */ new Map();
  proposals = /* @__PURE__ */ new Map();
  collaborations = /* @__PURE__ */ new Map();
  chatMessages = /* @__PURE__ */ new Map();
  creditTransactions = /* @__PURE__ */ new Map();
  currentId = {
    user: 1,
    proposal: 1,
    collaboration: 1,
    chatMessage: 1,
    creditTransaction: 1
  };
  constructor() {
    this.seedData();
  }
  seedData() {
    const admin = {
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
      credits: 1e4,
      avatar: null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(admin.id, admin);
    const customer = {
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
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(customer.id, customer);
    const collaborator = {
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
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(collaborator.id, collaborator);
    const proposals2 = [
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
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1e3),
        // 2 hours ago
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1e3)
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
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1e3),
        // 1 day ago
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1e3)
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
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3),
        // 3 days ago
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1e3)
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
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1e3),
        // 3 hours ago
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1e3)
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
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1e3),
        // 1 day ago
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1e3)
      }
    ];
    proposals2.forEach((proposal) => {
      this.proposals.set(proposal.id, proposal);
    });
    const collaborations2 = [
      {
        id: this.currentId.collaboration++,
        proposalId: 4,
        // E-commerce Platform Development
        userId: collaborator.id,
        role: "Technical Reviewer",
        createdAt: /* @__PURE__ */ new Date()
      },
      {
        id: this.currentId.collaboration++,
        proposalId: 5,
        // Marketing Automation Setup
        userId: collaborator.id,
        role: "Content Editor",
        createdAt: /* @__PURE__ */ new Date()
      }
    ];
    collaborations2.forEach((collaboration) => {
      this.collaborations.set(collaboration.id, collaboration);
    });
  }
  // User methods
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }
  async createUser(insertUser) {
    const id = this.currentId.user++;
    const user = {
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
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, user);
    return user;
  }
  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updatedUser = { ...user, ...updates, updatedAt: /* @__PURE__ */ new Date() };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  async deleteUser(id) {
    if (!this.users.has(id)) throw new Error("User not found");
    this.users.delete(id);
    for (const [proposalId, proposal] of this.proposals.entries()) {
      if (proposal.ownerId === id) {
        this.proposals.set(proposalId, { ...proposal, ownerId: null, updatedAt: /* @__PURE__ */ new Date() });
      }
    }
  }
  async getAllUsers() {
    return Array.from(this.users.values()).sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  // Proposal methods
  async getProposal(id) {
    return this.proposals.get(id);
  }
  async getAllProposals() {
    return Array.from(this.proposals.values()).sort((a, b) => {
      const dateA = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
      const dateB = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  async getProposalsByUserId(userId) {
    return Array.from(this.proposals.values()).filter((proposal) => proposal.ownerId === userId).sort((a, b) => {
      const dateA = a.updatedAt?.getTime() || a.createdAt?.getTime() || 0;
      const dateB = b.updatedAt?.getTime() || b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  async createProposal(insertProposal) {
    const id = this.currentId.proposal++;
    const proposal = {
      id,
      title: insertProposal.title,
      description: insertProposal.description || null,
      industry: insertProposal.industry || null,
      budgetRange: insertProposal.budgetRange || null,
      timeline: insertProposal.timeline || null,
      status: insertProposal.status || "draft",
      content: insertProposal.content || null,
      ownerId: insertProposal.ownerId || null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.proposals.set(id, proposal);
    return proposal;
  }
  async updateProposal(id, updates) {
    const proposal = this.proposals.get(id);
    if (!proposal) throw new Error("Proposal not found");
    const updatedProposal = { ...proposal, ...updates, updatedAt: /* @__PURE__ */ new Date() };
    this.proposals.set(id, updatedProposal);
    return updatedProposal;
  }
  async deleteProposal(id) {
    this.proposals.delete(id);
  }
  // Collaboration methods
  async getCollaborationsByProposalId(proposalId) {
    return Array.from(this.collaborations.values()).filter((collab) => collab.proposalId === proposalId).sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  async getCollaborationsByUserId(userId) {
    return Array.from(this.collaborations.values()).filter((collab) => collab.userId === userId).sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  async getCollaboration(id) {
    return this.collaborations.get(id);
  }
  async createCollaboration(insertCollaboration) {
    const id = this.currentId.collaboration++;
    const collaboration = {
      id,
      proposalId: insertCollaboration.proposalId || null,
      userId: insertCollaboration.userId || null,
      role: insertCollaboration.role,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.collaborations.set(id, collaboration);
    return collaboration;
  }
  async updateCollaboration(id, updates) {
    const collaboration = this.collaborations.get(id);
    if (!collaboration) throw new Error("Collaboration not found");
    const updated = { ...collaboration, ...updates };
    this.collaborations.set(id, updated);
    return updated;
  }
  async deleteCollaboration(id) {
    this.collaborations.delete(id);
  }
  // Chat message methods
  async getChatMessagesByProposalId(proposalId) {
    return Array.from(this.chatMessages.values()).filter((message) => message.proposalId === proposalId).sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  async createChatMessage(insertMessage) {
    const id = this.currentId.chatMessage++;
    const message = {
      id,
      proposalId: insertMessage.proposalId || null,
      userId: insertMessage.userId || null,
      message: insertMessage.message,
      isAi: insertMessage.isAi || null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.chatMessages.set(id, message);
    return message;
  }
  // Credit transaction methods
  async getCreditTransactionsByUserId(userId) {
    return Array.from(this.creditTransactions.values()).filter((transaction) => transaction.userId === userId).sort((a, b) => {
      const dateA = a.createdAt?.getTime() || 0;
      const dateB = b.createdAt?.getTime() || 0;
      return dateB - dateA;
    });
  }
  async createCreditTransaction(insertTransaction) {
    const id = this.currentId.creditTransaction++;
    const transaction = {
      id,
      userId: insertTransaction.userId || null,
      amount: insertTransaction.amount,
      type: insertTransaction.type,
      description: insertTransaction.description || null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.creditTransactions.set(id, transaction);
    return transaction;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("customer"),
  // customer, admin, collaborator
  company: text("company"),
  jobTitle: text("job_title"),
  bio: text("bio"),
  credits: integer("credits").default(0),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  industry: text("industry"),
  budgetRange: text("budget_range"),
  timeline: text("timeline"),
  status: text("status").notNull().default("draft"),
  // draft, in_progress, completed
  content: jsonb("content"),
  ownerId: integer("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var collaborations = pgTable("collaborations", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").references(() => proposals.id),
  userId: integer("user_id").references(() => users.id),
  role: text("role").notNull(),
  // editor, reviewer, viewer
  createdAt: timestamp("created_at").defaultNow()
});
var chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").references(() => proposals.id),
  userId: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  isAi: boolean("is_ai").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(),
  // purchase, usage, refund
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCollaborationSchema = createInsertSchema(collaborations).omit({
  id: true,
  createdAt: true
});
var insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true
});
var insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true
});

// server/routes.ts
var ROLE_TO_PERMISSIONS = {
  viewer: { canView: true, canEdit: false, canComment: false, canReview: false, canGenerateAi: false },
  commenter: { canView: true, canEdit: false, canComment: true, canReview: false, canGenerateAi: false },
  editor: { canView: true, canEdit: true, canComment: true, canReview: false, canGenerateAi: false },
  reviewer: { canView: true, canEdit: true, canComment: true, canReview: true, canGenerateAi: false },
  contributor: { canView: true, canEdit: true, canComment: true, canReview: true, canGenerateAi: true }
};
function getPermissionsForRole(role) {
  const r = (role || "viewer").toLowerCase();
  return ROLE_TO_PERMISSIONS[r] ?? ROLE_TO_PERMISSIONS.viewer;
}
async function getProposalAccess(proposalId, callerUserId, callerUserRole) {
  const proposal = await storage.getProposal(proposalId);
  if (!proposal) return { proposal: null, isAdmin: false, isOwner: false, permissions: null };
  if (callerUserId == null || callerUserRole === void 0 || callerUserRole === "") {
    return { proposal, isAdmin: true, isOwner: true, permissions: ROLE_TO_PERMISSIONS.contributor };
  }
  const role = (callerUserRole || "").toLowerCase();
  if (role === "admin") return { proposal, isAdmin: true, isOwner: false, permissions: ROLE_TO_PERMISSIONS.contributor };
  if (proposal.ownerId === callerUserId) return { proposal, isAdmin: false, isOwner: true, permissions: ROLE_TO_PERMISSIONS.contributor };
  const collabs = await storage.getCollaborationsByProposalId(proposalId);
  const collab = collabs.find((c) => c.userId === callerUserId);
  if (!collab) return { proposal, isAdmin: false, isOwner: false, permissions: null };
  const permissions = getPermissionsForRole(collab.role);
  return { proposal, isAdmin: false, isOwner: false, permissions };
}
function withoutPassword(user) {
  const { password: _, ...rest } = user;
  return rest;
}
async function registerRoutes(app2) {
  app2.get("/api/users", async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      res.json(users2.map((u) => withoutPassword(u)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.get("/api/v1/users", async (req, res) => {
    try {
      const users2 = await storage.getAllUsers();
      res.json(users2.map((u) => withoutPassword(u)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.get("/api/v1/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const user = await storage.updateUser(id, updates);
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  app2.patch("/api/v1/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const user = await storage.updateUser(id, updates);
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  app2.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app2.delete("/api/v1/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app2.get("/api/proposals", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId) : void 0;
      const userRole = req.query.userRole;
      let proposals2;
      if (userRole === "admin") {
        proposals2 = await storage.getAllProposals();
      } else if (userId) {
        proposals2 = await storage.getProposalsByUserId(userId);
      } else {
        return res.status(400).json({ message: "userId required for non-admin users" });
      }
      const proposalsWithOwners = await Promise.all(
        proposals2.map(async (proposal) => {
          let owner = null;
          if (proposal.ownerId) {
            const ownerUser = await storage.getUser(proposal.ownerId);
            if (ownerUser) {
              owner = {
                id: ownerUser.id,
                name: `${ownerUser.firstName} ${ownerUser.lastName}`,
                avatar: ownerUser.avatar || `${ownerUser.firstName[0]}${ownerUser.lastName[0]}`,
                email: ownerUser.email,
                company: ownerUser.company
              };
            }
          }
          return {
            ...proposal,
            owner
          };
        })
      );
      res.json(proposalsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposals" });
    }
  });
  app2.get("/api/proposals/:id", async (req, res) => {
    try {
      const proposal = await storage.getProposal(parseInt(req.params.id));
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposal" });
    }
  });
  app2.post("/api/proposals", async (req, res) => {
    try {
      const proposalData = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(proposalData);
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ message: "Failed to create proposal" });
    }
  });
  app2.patch("/api/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const proposal = await storage.updateProposal(id, updates);
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to update proposal" });
    }
  });
  app2.delete("/api/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProposal(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete proposal" });
    }
  });
  const getProposalsHandler = async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId) : void 0;
      const userRole = req.query.userRole;
      let proposals2;
      if (userRole === "admin") {
        proposals2 = await storage.getAllProposals();
      } else if (userId) {
        proposals2 = await storage.getProposalsByUserId(userId);
      } else {
        return res.status(400).json({ message: "userId required for non-admin users" });
      }
      const proposalsWithOwners = await Promise.all(
        proposals2.map(async (proposal) => {
          let owner = null;
          if (proposal.ownerId) {
            const ownerUser = await storage.getUser(proposal.ownerId);
            if (ownerUser) {
              owner = {
                id: ownerUser.id,
                name: `${ownerUser.firstName} ${ownerUser.lastName}`,
                avatar: ownerUser.avatar || `${ownerUser.firstName[0]}${ownerUser.lastName[0]}`,
                email: ownerUser.email,
                company: ownerUser.company
              };
            }
          }
          return { ...proposal, owner };
        })
      );
      res.json(proposalsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposals" });
    }
  };
  app2.get("/api/v1/proposals", getProposalsHandler);
  app2.get("/api/v1/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const callerUserId = req.query.userId != null ? parseInt(req.query.userId) : void 0;
      const callerUserRole = req.query.userRole;
      const access = await getProposalAccess(id, callerUserId, callerUserRole);
      if (!access.proposal) return res.status(404).json({ message: "Proposal not found" });
      const canView = access.isAdmin || access.isOwner || access.permissions?.canView === true;
      if (!canView) return res.status(403).json({ message: "You do not have permission to view this proposal" });
      res.json(access.proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposal" });
    }
  });
  app2.post("/api/v1/proposals", async (req, res) => {
    try {
      const proposalData = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(proposalData);
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ message: "Failed to create proposal" });
    }
  });
  app2.post("/api/v1/proposals/parse-upload", async (_req, res) => {
    res.status(501).json({ message: "RFP file parser not implemented; use placeholder flow" });
  });
  app2.patch("/api/v1/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const callerUserId = req.query.userId != null ? parseInt(req.query.userId) : req.body?.userId != null ? parseInt(String(req.body.userId)) : void 0;
      const callerUserRole = req.query.userRole ?? req.body?.userRole;
      const access = await getProposalAccess(id, callerUserId, callerUserRole);
      if (!access.proposal) return res.status(404).json({ message: "Proposal not found" });
      const canEdit = access.isAdmin || access.isOwner || access.permissions?.canEdit === true;
      if (!canEdit) return res.status(403).json({ message: "You do not have permission to edit this proposal" });
      const { userId: _u, userRole: _r, ...updates } = req.body;
      const proposal = await storage.updateProposal(id, updates);
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to update proposal" });
    }
  });
  app2.delete("/api/v1/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProposal(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete proposal" });
    }
  });
  app2.get("/api/v1/proposals/:id/activity", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const callerUserId = req.query.userId != null ? parseInt(req.query.userId) : void 0;
      const callerUserRole = req.query.userRole;
      const access = await getProposalAccess(id, callerUserId, callerUserRole);
      if (!access.proposal) return res.status(404).json({ message: "Proposal not found" });
      const canView = access.isAdmin || access.isOwner || access.permissions?.canView === true;
      if (!canView) return res.status(403).json({ message: "You do not have permission to view this proposal's activity" });
      res.json({ entries: [] });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });
  app2.post("/api/proposals/:id/generate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const proposal = await storage.getProposal(id);
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }
      const { requirements, aiContext, clientName, clientContact, clientEmail } = req.body;
      const requirementsList = requirements ? typeof requirements === "string" ? requirements.split(",").map((r) => r.trim()).filter((r) => r) : requirements : [];
      const generatedContent = {
        executiveSummary: `This proposal outlines our comprehensive solution for ${proposal.title}. Based on the requirements and industry standards, we have developed a tailored approach that addresses all key aspects of your project.${aiContext ? `

Additional context: ${aiContext}` : ""}`,
        introduction: `We are pleased to submit this proposal for ${proposal.title}. Our team has carefully reviewed your requirements and is excited to present a solution that aligns with your objectives and budget considerations.${clientName ? ` We look forward to partnering with ${clientName} on this initiative.` : ""}`,
        projectOverview: {
          title: proposal.title,
          description: proposal.description || "A comprehensive solution tailored to your needs",
          industry: proposal.industry || "General",
          timeline: proposal.timeline || "To be determined",
          budget: proposal.budgetRange || "To be discussed",
          client: clientName || null,
          contact: clientContact || null,
          email: clientEmail || null
        },
        requirements: requirementsList.length > 0 ? requirementsList : [
          "Comprehensive analysis and planning phase",
          "Agile development methodology",
          "Quality assurance and testing protocols"
        ],
        solutionApproach: `Our approach combines industry best practices with innovative solutions to deliver exceptional results. We will leverage our expertise in ${proposal.industry || "your industry"} to ensure successful project delivery.${aiContext ? `

Special considerations: ${aiContext}` : ""}`,
        technicalSpecifications: [
          "Comprehensive analysis and planning phase",
          "Agile development methodology",
          "Quality assurance and testing protocols",
          "Deployment and integration support",
          "Ongoing maintenance and support services"
        ],
        deliverables: [
          "Complete project documentation",
          "Source code and technical assets",
          "Training materials and sessions",
          "Post-deployment support plan",
          "Regular progress reports and updates"
        ],
        timeline: {
          phase1: "Planning and Analysis (Weeks 1-2)",
          phase2: "Design and Development (Weeks 3-8)",
          phase3: "Testing and Quality Assurance (Weeks 9-10)",
          phase4: "Deployment and Training (Weeks 11-12)"
        },
        team: {
          projectManager: "Dedicated project manager for coordination",
          technicalLead: "Experienced technical lead for architecture",
          developers: "Skilled development team",
          qa: "Quality assurance specialists"
        },
        pricing: {
          base: proposal.budgetRange || "Custom pricing available",
          paymentTerms: "Milestone-based payments",
          additionalServices: "Available upon request"
        },
        nextSteps: [
          "Schedule a detailed discussion meeting",
          "Review and refine proposal details",
          "Finalize contract terms",
          "Begin project kickoff"
        ],
        generatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      const updatedProposal = await storage.updateProposal(id, {
        content: generatedContent,
        status: "in_progress"
      });
      res.json(updatedProposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate proposal content" });
    }
  });
  app2.get("/api/v1/proposals/my-collaborations", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId) : void 0;
      if (userId == null || isNaN(userId)) {
        return res.status(400).json({ message: "userId query parameter required" });
      }
      const collaborations2 = await storage.getCollaborationsByUserId(userId);
      const items = await Promise.all(
        collaborations2.map(async (collab) => {
          const proposal = await storage.getProposal(collab.proposalId);
          if (!proposal) return null;
          const perms = getPermissionsForRole(collab.role ?? "viewer");
          const collaboration = {
            id: collab.id,
            proposalId: collab.proposalId,
            userId: collab.userId,
            role: collab.role,
            enabled: true,
            canView: perms.canView,
            canEdit: perms.canEdit,
            canComment: perms.canComment,
            canReview: perms.canReview,
            canGenerateAi: perms.canGenerateAi,
            createdAt: collab.createdAt instanceof Date ? collab.createdAt.toISOString() : collab.createdAt ?? ""
          };
          const proposalJson = {
            ...proposal,
            createdAt: proposal.createdAt instanceof Date ? proposal.createdAt.toISOString() : proposal.createdAt ?? "",
            updatedAt: proposal.updatedAt instanceof Date ? proposal.updatedAt.toISOString() : proposal.updatedAt ?? ""
          };
          return { proposal: proposalJson, collaboration };
        })
      );
      res.json(items.filter(Boolean));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborations" });
    }
  });
  async function collaborationJson(collab) {
    const user = collab.userId != null ? await storage.getUser(collab.userId) : null;
    const perms = getPermissionsForRole(collab.role ?? "viewer");
    return {
      id: collab.id,
      proposalId: collab.proposalId,
      userId: collab.userId,
      role: collab.role,
      enabled: true,
      canView: perms.canView,
      canEdit: perms.canEdit,
      canComment: perms.canComment,
      canReview: perms.canReview,
      canGenerateAi: perms.canGenerateAi,
      createdAt: collab.createdAt instanceof Date ? collab.createdAt.toISOString() : collab.createdAt ?? "",
      user: user ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } : void 0
    };
  }
  app2.get("/api/v1/proposals/:id/collaborations", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const list = await storage.getCollaborationsByProposalId(proposalId);
      const result = await Promise.all(list.map((c) => collaborationJson(c)));
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborations" });
    }
  });
  app2.get("/api/v1/proposals/:id/my-collaboration", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const userId = req.query.userId ? parseInt(req.query.userId) : void 0;
      if (userId == null || isNaN(userId)) {
        return res.status(400).json({ message: "userId query parameter required" });
      }
      const list = await storage.getCollaborationsByProposalId(proposalId);
      const collab = list.find((c) => c.userId === userId);
      if (!collab) return res.status(404).json({ message: "Not a collaborator on this proposal" });
      const result = await collaborationJson(collab);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaboration" });
    }
  });
  app2.post("/api/v1/proposals/:id/collaborations", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const { userId, role } = req.body;
      if (userId == null) return res.status(400).json({ message: "userId required" });
      const existing = await storage.getCollaborationsByProposalId(proposalId);
      if (existing.some((c) => c.userId === userId)) {
        return res.status(400).json({ message: "User already added to this proposal" });
      }
      const created = await storage.createCollaboration({
        proposalId,
        userId: Number(userId),
        role: role || "viewer"
      });
      const result = await collaborationJson(created);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to add collaboration" });
    }
  });
  app2.patch("/api/v1/proposals/:id/collaborations/:cid", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const collaborationId = parseInt(req.params.cid);
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const collab = await storage.getCollaboration(collaborationId);
      if (!collab || collab.proposalId !== proposalId) return res.status(404).json({ message: "Collaboration not found" });
      const { role } = req.body;
      const updated = await storage.updateCollaboration(collaborationId, role != null ? { role } : {});
      const result = await collaborationJson(updated);
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to update collaboration" });
    }
  });
  app2.delete("/api/v1/proposals/:id/collaborations/:cid", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const collaborationId = parseInt(req.params.cid);
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const collab = await storage.getCollaboration(collaborationId);
      if (!collab || collab.proposalId !== proposalId) return res.status(404).json({ message: "Collaboration not found" });
      await storage.deleteCollaboration(collaborationId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to remove collaboration" });
    }
  });
  const proposalQuestionsStore = [];
  const proposalAnswersStore = [];
  const shareTokensStore = [];
  let questionNextId = 1;
  let answerNextId = 1;
  let shareTokenNextId = 1;
  const isoNow = () => (/* @__PURE__ */ new Date()).toISOString();
  async function ensureProposalExists(proposalId) {
    const p = await storage.getProposal(proposalId);
    return !!p;
  }
  app2.get("/api/v1/proposals/:id/questions", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!await ensureProposalExists(proposalId)) return res.status(404).json({ message: "Proposal not found" });
      const list = proposalQuestionsStore.filter((q) => q.proposalId === proposalId).sort((a, b) => a.order - b.order);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });
  app2.post("/api/v1/proposals/:id/questions", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!await ensureProposalExists(proposalId)) return res.status(404).json({ message: "Proposal not found" });
      const body = req.body || {};
      const question = {
        id: questionNextId++,
        proposalId,
        question: typeof body.question === "string" ? body.question : "",
        order: typeof body.order === "number" ? body.order : proposalQuestionsStore.filter((q) => q.proposalId === proposalId).length,
        source: typeof body.source === "string" ? body.source : "user",
        createdAt: isoNow()
      };
      proposalQuestionsStore.push(question);
      res.status(201).json(question);
    } catch (error) {
      res.status(400).json({ message: "Failed to create question" });
    }
  });
  app2.patch("/api/v1/proposals/:id/questions/:questionId", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const questionId = parseInt(req.params.questionId);
      const q = proposalQuestionsStore.find((x) => x.id === questionId && x.proposalId === proposalId);
      if (!q) return res.status(404).json({ message: "Question not found" });
      const body = req.body || {};
      if (typeof body.question === "string") q.question = body.question;
      if (typeof body.order === "number") q.order = body.order;
      res.json(q);
    } catch (error) {
      res.status(500).json({ message: "Failed to update question" });
    }
  });
  app2.delete("/api/v1/proposals/:id/questions/:questionId", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const questionId = parseInt(req.params.questionId);
      const idx = proposalQuestionsStore.findIndex((x) => x.id === questionId && x.proposalId === proposalId);
      if (idx === -1) return res.status(404).json({ message: "Question not found" });
      proposalQuestionsStore.splice(idx, 1);
      for (let i = proposalAnswersStore.length - 1; i >= 0; i--) {
        if (proposalAnswersStore[i].questionId === questionId) proposalAnswersStore.splice(i, 1);
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete question" });
    }
  });
  app2.get("/api/v1/proposals/:id/answers", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!await ensureProposalExists(proposalId)) return res.status(404).json({ message: "Proposal not found" });
      const questionIds = new Set(proposalQuestionsStore.filter((q) => q.proposalId === proposalId).map((q) => q.id));
      const list = proposalAnswersStore.filter((a) => questionIds.has(a.questionId));
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch answers" });
    }
  });
  app2.post("/api/v1/proposals/:id/answers", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!await ensureProposalExists(proposalId)) return res.status(404).json({ message: "Proposal not found" });
      const { questionId, answer } = req.body || {};
      const qid = questionId != null ? Number(questionId) : NaN;
      if (!Number.isInteger(qid) || !proposalQuestionsStore.some((q) => q.id === qid && q.proposalId === proposalId)) {
        return res.status(400).json({ message: "Valid questionId required" });
      }
      const now = isoNow();
      const existing = proposalAnswersStore.find((a) => a.questionId === qid);
      if (existing) {
        existing.answer = typeof answer === "string" ? answer : "";
        existing.updatedAt = now;
        return res.json(existing);
      }
      const ans = { id: answerNextId++, questionId: qid, answer: typeof answer === "string" ? answer : "", createdAt: now, updatedAt: now };
      proposalAnswersStore.push(ans);
      res.status(201).json(ans);
    } catch (error) {
      res.status(400).json({ message: "Failed to save answer" });
    }
  });
  app2.post("/api/v1/proposals/:id/answers/bulk", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!await ensureProposalExists(proposalId)) return res.status(404).json({ message: "Proposal not found" });
      const questionIds = new Set(proposalQuestionsStore.filter((q) => q.proposalId === proposalId).map((q) => q.id));
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const now = isoNow();
      const result = [];
      for (const item of answers) {
        const qid = item.questionId != null ? Number(item.questionId) : NaN;
        if (!Number.isInteger(qid) || !questionIds.has(qid)) continue;
        const text2 = typeof item.answer === "string" ? item.answer : "";
        const existing = proposalAnswersStore.find((a) => a.questionId === qid);
        if (existing) {
          existing.answer = text2;
          existing.updatedAt = now;
          result.push(existing);
        } else {
          const ans = { id: answerNextId++, questionId: qid, answer: text2, createdAt: now, updatedAt: now };
          proposalAnswersStore.push(ans);
          result.push(ans);
        }
      }
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: "Failed to save answers" });
    }
  });
  app2.get("/api/v1/proposals/:id/draft", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const questions = proposalQuestionsStore.filter((q) => q.proposalId === proposalId).sort((a, b) => a.order - b.order);
      const questionIds = new Set(questions.map((q) => q.id));
      const answers = proposalAnswersStore.filter((a) => questionIds.has(a.questionId));
      const proposalJson = {
        ...proposal,
        createdAt: proposal.createdAt instanceof Date ? proposal.createdAt.toISOString() : proposal.createdAt ?? "",
        updatedAt: proposal.updatedAt instanceof Date ? proposal.updatedAt.toISOString() : proposal.updatedAt ?? ""
      };
      res.json({ proposal: proposalJson, questions, answers, status: proposal.status || "draft" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });
  app2.post("/api/v1/proposals/:id/share-token", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!await ensureProposalExists(proposalId)) return res.status(404).json({ message: "Proposal not found" });
      let rec = shareTokensStore.find((t) => t.proposalId === proposalId);
      if (!rec) {
        rec = { id: shareTokenNextId++, proposalId, token: `tk_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`, createdAt: isoNow() };
        shareTokensStore.push(rec);
      }
      res.status(201).json(rec);
    } catch (error) {
      res.status(400).json({ message: "Failed to create share token" });
    }
  });
  app2.get("/api/collaborations", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId) : void 0;
      const proposalId = req.query.proposalId ? parseInt(req.query.proposalId) : void 0;
      if (userId) {
        const collaborations2 = await storage.getCollaborationsByUserId(userId);
        const collaborationsWithProposals = await Promise.all(
          collaborations2.map(async (collab) => {
            const proposal = await storage.getProposal(collab.proposalId);
            const owner = proposal ? await storage.getUser(proposal.ownerId) : null;
            return {
              ...collab,
              proposal,
              owner: owner ? { ...owner, password: void 0 } : null
            };
          })
        );
        res.json(collaborationsWithProposals);
      } else if (proposalId) {
        const collaborations2 = await storage.getCollaborationsByProposalId(proposalId);
        res.json(collaborations2);
      } else {
        res.status(400).json({ message: "userId or proposalId required" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborations" });
    }
  });
  app2.get("/api/chat/:proposalId", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.proposalId);
      const messages = await storage.getChatMessagesByProposalId(proposalId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });
  app2.post("/api/chat", async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      if (!messageData.isAi) {
        setTimeout(async () => {
          const aiResponse = await storage.createChatMessage({
            proposalId: messageData.proposalId,
            userId: messageData.userId,
            message: "That's a great question! Based on your project requirements, I'd recommend focusing on scalability and security. Would you like me to elaborate on specific technical requirements?",
            isAi: true
          });
        }, 1e3);
      }
      res.json(message);
    } catch (error) {
      res.status(400).json({ message: "Failed to send message" });
    }
  });
  app2.post("/api/credits/purchase", async (req, res) => {
    try {
      const { userId, plan, amount } = req.body;
      await new Promise((resolve) => setTimeout(resolve, 2e3));
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const updatedUser = await storage.updateUser(userId, {
        credits: (user.credits || 0) + amount
      });
      await storage.createCreditTransaction({
        userId,
        amount,
        type: "purchase",
        description: `Purchased ${plan} plan`
      });
      res.json({ success: true, credits: updatedUser.credits });
    } catch (error) {
      res.status(500).json({ message: "Payment failed" });
    }
  });
  const customerKbDocuments = [];
  const customerKbVersions = [];
  let customerKbDocNextId = 1;
  let customerKbVersionNextId = 1;
  app2.get("/api/v1/customer/knowledge-base/documents", async (_req, res) => {
    try {
      res.json(customerKbDocuments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });
  app2.post("/api/v1/customer/knowledge-base/documents", async (req, res) => {
    try {
      const body = req.body || {};
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const doc = {
        id: customerKbDocNextId++,
        name: typeof body.name === "string" ? body.name : "Untitled",
        type: typeof body.type === "string" ? body.type : "pdf",
        size: typeof body.size === "number" ? body.size : 0,
        uploadedAt: now,
        tags: Array.isArray(body.tags) ? body.tags : [],
        version: 1,
        description: typeof body.description === "string" ? body.description : ""
      };
      customerKbDocuments.push(doc);
      customerKbVersions.push({
        id: customerKbVersionNextId++,
        documentId: doc.id,
        version: 1,
        uploadedAt: now,
        uploadedBy: "You",
        changes: "Initial upload"
      });
      res.status(201).json(doc);
    } catch (error) {
      res.status(400).json({ message: "Failed to create document" });
    }
  });
  app2.delete("/api/v1/customer/knowledge-base/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const idx = customerKbDocuments.findIndex((d) => d.id === id);
      if (idx === -1) return res.status(404).json({ message: "Document not found" });
      customerKbDocuments.splice(idx, 1);
      for (let i = customerKbVersions.length - 1; i >= 0; i--) {
        if (customerKbVersions[i].documentId === id) customerKbVersions.splice(i, 1);
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });
  app2.get("/api/v1/customer/knowledge-base/documents/:id/versions", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const list = customerKbVersions.filter((v) => v.documentId === documentId).sort((a, b) => b.version - a.version);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch versions" });
    }
  });
  app2.get("/api/v1/customer/knowledge-base/versions", async (_req, res) => {
    try {
      const list = [...customerKbVersions].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch version history" });
    }
  });
  app2.get("/api/v1/customer/account-settings", async (_req, res) => {
    try {
      const config = {
        page: { title: "Account Settings", subtitle: "Manage your profile and preferences" },
        headerActions: [
          { id: "home", label: "Home", icon: "home", href: "" },
          { id: "aiChat", label: "AI Chat", icon: "bot", href: "/ai-chat" },
          { id: "newProposal", label: "New Proposal", icon: "fileText", href: "/proposals/new" }
        ],
        sidebar: {
          settingsLabel: "Settings",
          nav: [
            { id: "profile", label: "Profile", icon: "user" },
            { id: "security", label: "Security", icon: "lock" },
            { id: "notifications", label: "Notifications", icon: "bell" },
            { id: "billing", label: "Billing", icon: "creditCard" }
          ],
          userCard: { creditsLabel: "Credits", creditsSuffix: "credits available", showCreditsBar: true }
        },
        sections: {
          profile: {
            title: "Profile Information",
            avatar: { sectionLabel: "Profile Picture", uploadLabel: "Upload New", removeLabel: "Remove", removeConfirmTitle: "Remove Profile Picture", removeConfirmDescription: "Are you sure you want to remove your profile picture?", removeConfirmButton: "Remove", removeCancelButton: "Cancel" },
            fields: [
              { id: "firstName", label: "First Name", type: "text", gridCol: "half" },
              { id: "lastName", label: "Last Name", type: "text", gridCol: "half" },
              { id: "email", label: "Email", type: "email", gridCol: "full" },
              { id: "company", label: "Company", type: "text", gridCol: "full" },
              { id: "jobTitle", label: "Job Title", type: "text", gridCol: "full" },
              { id: "bio", label: "Bio", type: "textarea", placeholder: "Tell us about yourself...", rows: 3, gridCol: "full" }
            ],
            saveLabel: "Save Changes",
            savingLabel: "Saving..."
          },
          security: {
            title: "Security Settings",
            fields: [
              { id: "currentPassword", label: "Current Password", type: "password", placeholder: "Enter current password" },
              { id: "newPassword", label: "New Password", type: "password", placeholder: "Enter new password" },
              { id: "confirmPassword", label: "Confirm New Password", type: "password", placeholder: "Confirm new password" }
            ],
            twoFactor: { title: "Two-Factor Authentication", description: "Add an extra layer of security to your account", buttonLabel: "Enable 2FA", confirmTitle: "Enable Two-Factor Authentication", confirmDescription: "2FA Setup Code: {setupCode}\n\nPlease save this code. Continue to enable 2FA?", confirmButton: "Enable 2FA", cancelButton: "Cancel", successTitle: "2FA Enabled", successDescription: "Two-factor authentication has been enabled. Please scan the QR code with your authenticator app." },
            activeSessions: { title: "Active Sessions", sessionLabel: "Current Session", sessionDescription: "Chrome on macOS \u2022 Last active now", currentBadge: "Current" },
            updatePasswordLabel: "Update Password",
            updatingLabel: "Updating..."
          },
          notifications: {
            title: "Notification Preferences",
            toggles: [
              { id: "emailNotifications", label: "Email Notifications", description: "Receive notifications via email", defaultValue: true },
              { id: "proposalUpdates", label: "Proposal Updates", description: "Get notified when proposals are updated", defaultValue: true },
              { id: "collaborationInvites", label: "Collaboration Invites", description: "Get notified when invited to collaborate", defaultValue: true },
              { id: "marketingEmails", label: "Marketing Emails", description: "Receive updates about new features and tips", defaultValue: false },
              { id: "securityAlerts", label: "Security Alerts", description: "Get notified about security-related activities", defaultValue: true }
            ],
            saveLabel: "Save Preferences",
            successTitle: "Preferences saved",
            successDescription: "Your notification preferences have been saved."
          },
          billing: {
            title: "Billing & Subscription",
            plan: { title: "Current Plan", planName: "Professional Plan", statusBadge: "Active", creditsLabel: "Credits Remaining:", nextBillingLabel: "Next Billing Date:" },
            paymentMethod: { title: "Payment Method", maskLabel: "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 4242", expiresLabel: "Expires 12/24", updateButtonLabel: "Update", updatePromptTitle: "Update Card Number", updatePromptDescription: "Enter new card number (16 digits)", updatePromptPlaceholder: "\u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022 \u2022\u2022\u2022\u2022", successTitle: "Payment method updated", successDescription: "Your payment method has been updated successfully.", invalidTitle: "Invalid card number", invalidDescription: "Please enter a valid 16-digit card number." },
            transactionsTitle: "Recent Transactions",
            transactions: [
              { id: "1", description: "Professional Plan", date: "Dec 15, 2023", amount: "$79.00" },
              { id: "2", description: "Credit Top-up", date: "Nov 28, 2023", amount: "$29.00" }
            ],
            downloadInvoiceLabel: "Download Invoice",
            cancelSubscriptionLabel: "Cancel Subscription",
            cancelConfirmTitle: "Cancel Subscription",
            cancelConfirmDescription: "Are you sure you want to cancel your subscription? This action cannot be undone.",
            cancelConfirmButton: "Cancel Subscription",
            cancelKeepButton: "Keep Subscription",
            cancelSuccessTitle: "Subscription cancelled",
            cancelSuccessDescription: "Your subscription has been cancelled. Access will continue until the end of the billing period.",
            invoiceDownloadedTitle: "Invoice downloaded",
            invoiceDownloadedDescription: "Your invoice has been downloaded."
          }
        }
      };
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch account settings config" });
    }
  });
  const CONTENT_CATEGORY_ICONS = {
    "Company Overview": "BookOpen",
    "Technical Capabilities": "Lightbulb",
    "Case Studies": "FileText",
    "Pricing Templates": "Tag",
    "Security & Compliance": "CheckCircle"
  };
  const CONTENT_CATEGORY_COLORS = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-red-500"];
  const contentStore = [];
  let contentNextId = 1;
  function formatDate(d) {
    return d.toISOString().slice(0, 10);
  }
  app2.get("/api/v1/admin/content", async (_req, res) => {
    try {
      const categoryCounts = /* @__PURE__ */ new Map();
      for (const item of contentStore) {
        const c = item.category || "Uncategorized";
        categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
      }
      const categories = Array.from(categoryCounts.entries()).map(([name], idx) => ({
        id: idx + 1,
        name,
        icon: CONTENT_CATEGORY_ICONS[name] || "FileText",
        count: categoryCounts.get(name) || 0,
        color: CONTENT_CATEGORY_COLORS[idx % CONTENT_CATEGORY_COLORS.length]
      }));
      const contentItems = contentStore.map((item) => ({
        id: item.id,
        title: item.title,
        category: item.category,
        status: item.status,
        usageCount: item.usageCount,
        lastUsed: item.lastUsed,
        lastUpdated: item.lastUpdated,
        author: item.author,
        tags: item.tags || [],
        starred: item.starred
      }));
      res.json({ contentCategories: categories, contentItems });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });
  app2.get("/api/content", async (_req, res) => {
    try {
      res.json(contentStore.map((item) => ({ ...item, tags: item.tags || [] })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });
  app2.get("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = contentStore.find((c) => c.id === id);
      if (!item) return res.status(404).json({ message: "Content not found" });
      res.json({ ...item, tags: item.tags || [] });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });
  app2.post("/api/content", async (req, res) => {
    try {
      const body = req.body || {};
      const now = formatDate(/* @__PURE__ */ new Date());
      const item = {
        id: contentNextId++,
        title: typeof body.title === "string" ? body.title : "",
        category: typeof body.category === "string" ? body.category : "",
        content: typeof body.content === "string" ? body.content : "",
        status: typeof body.status === "string" ? body.status : "draft",
        tags: Array.isArray(body.tags) ? body.tags : [],
        starred: Boolean(body.starred),
        usageCount: 0,
        lastUsed: "",
        lastUpdated: now,
        author: typeof body.author === "string" ? body.author : "Admin"
      };
      contentStore.push(item);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Failed to create content" });
    }
  });
  app2.patch("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = contentStore.find((c) => c.id === id);
      if (!item) return res.status(404).json({ message: "Content not found" });
      const body = req.body || {};
      if (typeof body.title === "string") item.title = body.title;
      if (typeof body.category === "string") item.category = body.category;
      if (typeof body.content === "string") item.content = body.content;
      if (typeof body.status === "string") item.status = body.status;
      if (Array.isArray(body.tags)) item.tags = body.tags;
      if (typeof body.starred === "boolean") item.starred = body.starred;
      item.lastUpdated = formatDate(/* @__PURE__ */ new Date());
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content" });
    }
  });
  app2.delete("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const idx = contentStore.findIndex((c) => c.id === id);
      if (idx === -1) return res.status(404).json({ message: "Content not found" });
      contentStore.splice(idx, 1);
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete content" });
    }
  });
  app2.get("/api/integrations", async (req, res) => {
    try {
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });
  app2.post("/api/integrations", async (req, res) => {
    try {
      const integrationData = req.body;
      res.json({ id: Date.now(), ...integrationData });
    } catch (error) {
      res.status(400).json({ message: "Failed to create integration" });
    }
  });
  app2.get("/api/v1/admin/sidebar", async (_req, res) => {
    try {
      res.json({
        navGroups: [
          {
            title: "Overview",
            items: [
              { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
              { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" }
            ]
          },
          {
            title: "Management",
            items: [
              { href: "/admin/users", label: "Users", icon: "Users" },
              { href: "/admin/users-terms", label: "User terms", icon: "FileText" },
              { href: "/admin/roles", label: "Roles & Permissions", icon: "ShieldCheck" },
              { href: "/admin/organizations", label: "Organizations", icon: "Building2" },
              { href: "/admin/proposals", label: "Proposals", icon: "FileCheck" },
              { href: "/admin/rfp-templates", label: "RFP Templates", icon: "LayoutTemplate" },
              { href: "/admin/content", label: "Content Library", icon: "Library" }
            ]
          },
          {
            title: "AI & Billing",
            items: [
              { href: "/admin/ai-config", label: "AI Config", icon: "Sparkles" },
              { href: "/admin/knowledge-base", label: "Knowledge Base", icon: "Database" },
              { href: "/admin/usage", label: "Usage", icon: "TrendingUp" },
              { href: "/admin/credits", label: "Credits", icon: "CreditCard" },
              { href: "/admin/subscription-billing", label: "Subscription & Billing", icon: "Receipt" }
            ]
          },
          {
            title: "Security & Settings",
            items: [
              { href: "/admin/security", label: "Security", icon: "Shield" },
              { href: "/admin/audit-logs", label: "Audit Logs", icon: "ScrollText" },
              { href: "/admin/integrations", label: "Integrations", icon: "Zap" },
              { href: "/admin/settings", label: "Settings", icon: "Settings" }
            ]
          }
        ],
        sidebarWidget: {
          title: "AI Credits",
          usedLabel: "Used this month",
          usedValue: "45,789",
          percentage: 75,
          percentageLabel: "75% of monthly allocation"
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sidebar" });
    }
  });
  const orgStore = [];
  let orgNextId = 1;
  app2.get("/api/v1/admin/organizations", async (_req, res) => {
    try {
      res.json(orgStore);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });
  app2.get("/api/v1/admin/organizations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = orgStore.find((o) => o.id === id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });
  app2.post("/api/v1/admin/organizations", async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name is required" });
      }
      const org = { id: orgNextId++, name: name.trim(), customerIds: [], archived: false };
      orgStore.push(org);
      res.status(201).json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to create organization" });
    }
  });
  app2.patch("/api/v1/admin/organizations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = orgStore.find((o) => o.id === id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const { name, customerIds, archived, settings } = req.body || {};
      if (name !== void 0 && typeof name === "string") org.name = name.trim();
      if (customerIds !== void 0 && Array.isArray(customerIds)) org.customerIds = customerIds.map((n) => Number(n)).filter((n) => !Number.isNaN(n));
      if (archived !== void 0) org.archived = Boolean(archived);
      if (settings !== void 0 && settings !== null && typeof settings === "object") org.settings = settings;
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to update organization" });
    }
  });
  app2.delete("/api/v1/admin/organizations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const idx = orgStore.findIndex((o) => o.id === id);
      if (idx === -1) return res.status(404).json({ message: "Organization not found" });
      orgStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete organization" });
    }
  });
  app2.post("/api/v1/admin/organizations/:id/branding/upload", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = orgStore.find((o) => o.id === id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const body = req.body;
      const type = body?.type === "favicon" ? "favicon" : "logo";
      const data = typeof body?.data === "string" ? body.data : "";
      if (!data || !data.startsWith("data:")) {
        return res.status(400).json({ message: "data (data URL) is required" });
      }
      if (!org.settings) org.settings = {};
      if (type === "logo") org.settings.primaryLogoUrl = data;
      else org.settings.faviconUrl = data;
      res.json({ url: data });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload branding asset" });
    }
  });
  const settingsStore = {
    organization: { companyName: "RFP AI", industry: "Technology", description: "", website: "", supportEmail: "" },
    billing: { planName: "Professional Plan", planPrice: "$199/month", billingInterval: "Billed annually" },
    localization: { locale: "en", timezone: "UTC", dateFormat: "MM/DD/YYYY", currency: "USD" },
    colorPresets: [
      { name: "Default", primary: "#6366f1", secondary: "#8b5cf6" },
      { name: "Purple", primary: "#7c3aed", secondary: "#a78bfa" },
      { name: "Blue", primary: "#2563eb", secondary: "#60a5fa" },
      { name: "Green", primary: "#16a34a", secondary: "#22c55e" },
      { name: "Ocean", primary: "#0ea5e9", secondary: "#06b6d4" },
      { name: "Forest", primary: "#22c55e", secondary: "#16a34a" },
      { name: "Orange", primary: "#ea580c", secondary: "#f97316" },
      { name: "Pink", primary: "#db2777", secondary: "#ec4899" }
    ],
    notificationSettings: [
      { id: 1, name: "Proposal updates", description: "When a proposal status changes", email: true, push: true },
      { id: 2, name: "New comments", description: "When someone comments", email: true, push: false }
    ],
    emailServer: { host: "", port: 587, user: "", from: "", secure: true },
    storage: { provider: "local", bucket: "", region: "", endpoint: "" },
    apiKeys: [],
    backups: []
  };
  let apiKeyNextId = 1;
  let backupNextId = 1;
  app2.get("/api/v1/admin/settings", async (_req, res) => {
    try {
      res.json({
        defaultTheme: "Default",
        ...settingsStore
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });
  app2.patch("/api/v1/admin/settings", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.emailServer && typeof body.emailServer === "object") {
        const e = body.emailServer;
        if (e.host !== void 0) settingsStore.emailServer.host = String(e.host);
        if (e.port !== void 0) settingsStore.emailServer.port = Number(e.port) || 587;
        if (e.user !== void 0) settingsStore.emailServer.user = String(e.user);
        if (e.from !== void 0) settingsStore.emailServer.from = String(e.from);
        if (e.secure !== void 0) settingsStore.emailServer.secure = Boolean(e.secure);
      }
      if (body.storage && typeof body.storage === "object") {
        const s = body.storage;
        if (s.provider !== void 0) settingsStore.storage.provider = String(s.provider);
        if (s.bucket !== void 0) settingsStore.storage.bucket = String(s.bucket);
        if (s.region !== void 0) settingsStore.storage.region = String(s.region);
        if (s.endpoint !== void 0) settingsStore.storage.endpoint = String(s.endpoint);
      }
      if (body.apiKeys && typeof body.apiKeys === "object") {
        if (body.apiKeys.create && body.apiKeys.create.name) {
          const created = { id: `key_${apiKeyNextId++}`, name: body.apiKeys.create.name, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
          settingsStore.apiKeys.push(created);
        }
        if (Array.isArray(body.apiKeys.revoke)) {
          settingsStore.apiKeys = settingsStore.apiKeys.filter((k) => !body.apiKeys.revoke.includes(k.id));
        }
      }
      res.json({ defaultTheme: "Default", ...settingsStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });
  app2.post("/api/v1/admin/settings/backup", async (_req, res) => {
    try {
      const backup = { id: `backup_${backupNextId++}`, createdAt: (/* @__PURE__ */ new Date()).toISOString(), size: "\u2014", status: "completed" };
      settingsStore.backups.unshift(backup);
      res.json(backup);
    } catch (error) {
      res.status(500).json({ message: "Failed to create backup" });
    }
  });
  app2.get("/api/v1/branding", async (req, res) => {
    try {
      const organizationId = req.query.organizationId != null ? parseInt(String(req.query.organizationId), 10) : null;
      let org;
      if (organizationId != null && !Number.isNaN(organizationId)) {
        org = orgStore.find((o) => o.id === organizationId);
      }
      if (!org && orgStore.length > 0) org = orgStore[0];
      const settings = org?.settings || {};
      const primaryLogoUrl = settings.primaryLogoUrl ?? null;
      const faviconUrl = settings.faviconUrl ?? null;
      const colorTheme = settings.colorTheme ?? (settingsStore.colorPresets?.[0]?.name ?? "Default");
      res.json({
        primaryLogoUrl,
        faviconUrl,
        colorTheme,
        colorPresets: settingsStore.colorPresets ?? []
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch branding" });
    }
  });
  const permissionDefinitions = [
    { key: "can_create_rfp", label: "Create RFP", description: "Create new RFP proposals", scopes: ["read", "write"] },
    { key: "can_edit_proposal", label: "Edit proposal", description: "Edit proposal content", scopes: ["read", "write"] },
    { key: "can_delete_proposal", label: "Delete proposal", description: "Delete proposals", scopes: ["read", "write", "delete"] },
    { key: "can_invite_collaborators", label: "Invite collaborators", description: "Add collaborators to proposals", scopes: ["read", "write"] },
    { key: "can_use_ai", label: "Use AI generation", description: "Use AI to generate content", scopes: ["read", "write"] },
    { key: "can_manage_content", label: "Manage content library", description: "Upload and manage content", scopes: ["read", "write", "delete"] },
    { key: "can_view_analytics", label: "View analytics", description: "Access analytics and reports", scopes: ["read"] },
    { key: "can_manage_users", label: "Manage users", description: "Invite and manage users", scopes: ["read", "write", "delete"] }
  ];
  app2.get("/api/v1/admin/permissions", async (_req, res) => {
    try {
      res.json({
        permissions: permissionDefinitions.map((p) => p.key),
        defaultRolePermissions: {
          Admin: permissionDefinitions.map((p) => p.key),
          User: ["can_create_rfp", "can_edit_proposal", "can_invite_collaborators", "can_use_ai", "can_view_analytics"],
          Collaborator: ["can_edit_proposal", "can_use_ai"]
        }
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });
  const rolesStore = [
    { id: "admin", name: "Admin", isBuiltIn: true, permissions: Object.fromEntries(permissionDefinitions.map((p) => [p.key, p.scopes ?? ["read", "write", "delete"]])) },
    { id: "customer", name: "Customer", isBuiltIn: true, permissions: { can_create_rfp: ["read", "write"], can_edit_proposal: ["read", "write"], can_invite_collaborators: ["read", "write"], can_use_ai: ["read", "write"], can_view_analytics: ["read"] } },
    { id: "collaborator", name: "Collaborator", isBuiltIn: true, permissions: { can_edit_proposal: ["read", "write"], can_use_ai: ["read", "write"] } }
  ];
  let roleNextId = 1;
  app2.get("/api/v1/admin/roles", async (_req, res) => {
    try {
      res.json({ roles: rolesStore, permissionDefinitions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });
  app2.post("/api/v1/admin/roles", async (req, res) => {
    try {
      const { name, permissions } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name is required" });
      }
      const id = `custom_${roleNextId++}`;
      const role = { id, name: name.trim(), isBuiltIn: false, permissions: permissions && typeof permissions === "object" ? permissions : {} };
      rolesStore.push(role);
      res.status(201).json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to create role" });
    }
  });
  app2.patch("/api/v1/admin/roles/:id", async (req, res) => {
    try {
      const role = rolesStore.find((r) => r.id === req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      const { name, permissions } = req.body || {};
      if (!role.isBuiltIn && name !== void 0 && typeof name === "string") role.name = name.trim();
      if (permissions !== void 0 && permissions !== null && typeof permissions === "object") role.permissions = permissions;
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });
  app2.delete("/api/v1/admin/roles/:id", async (req, res) => {
    try {
      const role = rolesStore.find((r) => r.id === req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      if (role.isBuiltIn) return res.status(400).json({ message: "Cannot delete built-in role" });
      rolesStore.splice(rolesStore.indexOf(role), 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete role" });
    }
  });
  const rfpTemplatesStore = [];
  let rfpTemplateNextId = 1;
  app2.get("/api/v1/admin/rfp-templates", async (_req, res) => {
    try {
      res.json({ templates: rfpTemplatesStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch RFP templates" });
    }
  });
  app2.post("/api/v1/admin/rfp-templates", async (req, res) => {
    try {
      const body = req.body || {};
      const name = body.name && typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return res.status(400).json({ message: "name is required" });
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const template = {
        id: `tpl_${rfpTemplateNextId++}`,
        name,
        description: typeof body.description === "string" ? body.description : "",
        mandatorySections: Array.isArray(body.mandatorySections) ? body.mandatorySections.filter((e) => typeof e === "string") : [],
        questionSet: Array.isArray(body.questionSet) ? body.questionSet.map((q, i) => ({ question: typeof q.question === "string" ? q.question : "", order: typeof q.order === "number" ? q.order : i })) : [],
        locked: false,
        createdAt: now,
        updatedAt: now
      };
      rfpTemplatesStore.push(template);
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to create RFP template" });
    }
  });
  app2.patch("/api/v1/admin/rfp-templates/:id", async (req, res) => {
    try {
      const template = rfpTemplatesStore.find((t) => t.id === req.params.id);
      if (!template) return res.status(404).json({ message: "RFP template not found" });
      const body = req.body || {};
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (body.locked !== void 0) template.locked = Boolean(body.locked);
      if (body.name !== void 0 && typeof body.name === "string" && !template.locked) template.name = body.name.trim();
      if (body.description !== void 0 && typeof body.description === "string" && !template.locked) template.description = body.description;
      if (body.mandatorySections !== void 0 && Array.isArray(body.mandatorySections) && !template.locked) template.mandatorySections = body.mandatorySections.filter((e) => typeof e === "string");
      if (body.questionSet !== void 0 && Array.isArray(body.questionSet) && !template.locked) template.questionSet = body.questionSet.map((q, i) => ({ question: typeof q.question === "string" ? q.question : "", order: typeof q.order === "number" ? q.order : i }));
      template.updatedAt = now;
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to update RFP template" });
    }
  });
  app2.delete("/api/v1/admin/rfp-templates/:id", async (req, res) => {
    try {
      const idx = rfpTemplatesStore.findIndex((t2) => t2.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: "RFP template not found" });
      const t = rfpTemplatesStore[idx];
      if (t.locked) return res.status(400).json({ message: "Unlock template before deleting" });
      rfpTemplatesStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete RFP template" });
    }
  });
  const kbDocumentsStore = [
    { id: "kb_doc_1", title: "Product Overview", embeddingStatus: "indexed", chunkCount: 12, lastIndexedAt: (/* @__PURE__ */ new Date()).toISOString() },
    { id: "kb_doc_2", title: "Security & Compliance", embeddingStatus: "indexed", chunkCount: 8, lastIndexedAt: (/* @__PURE__ */ new Date()).toISOString() }
  ];
  let kbLastRebuildAt = null;
  const kbVersionsStore = [];
  let kbVersionNextId = 1;
  app2.get("/api/v1/admin/knowledge-base", async (_req, res) => {
    try {
      res.json({
        documents: kbDocumentsStore,
        lastRebuildAt: kbLastRebuildAt ?? void 0,
        indexVersion: kbLastRebuildAt ? `v-${kbVersionNextId - 1}` : void 0
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });
  app2.post("/api/v1/admin/knowledge-base/rebuild", async (_req, res) => {
    try {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      kbLastRebuildAt = now;
      const version = { id: `kb_${kbVersionNextId++}`, createdAt: now, documentCount: kbDocumentsStore.length, size: "\u2014" };
      kbVersionsStore.unshift(version);
      res.json({ success: true, rebuiltAt: now });
    } catch (error) {
      res.status(500).json({ message: "Failed to rebuild index" });
    }
  });
  app2.get("/api/v1/admin/knowledge-base/versions", async (_req, res) => {
    try {
      res.json({ versions: kbVersionsStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch versions" });
    }
  });
  app2.post("/api/v1/admin/knowledge-base/versions/:id/restore", async (req, res) => {
    try {
      const version = kbVersionsStore.find((v) => v.id === req.params.id);
      if (!version) return res.status(404).json({ message: "Version not found" });
      res.json({ success: true, restored: version.id });
    } catch (error) {
      res.status(500).json({ message: "Failed to restore version" });
    }
  });
  const billingPlansStore = [
    { id: "plan_pro", name: "Professional", price: 99, interval: "month", creditsIncluded: 1e4, apiQuotaPerMonth: 5e3, features: ["AI generation", "Unlimited proposals"] },
    { id: "plan_enterprise", name: "Enterprise", price: 299, interval: "month", creditsIncluded: 5e4, apiQuotaPerMonth: 5e4, features: ["Everything in Pro", "SSO", "Priority support"] }
  ];
  let billingPlanNextId = 1;
  const userPlanAssignments = {};
  const apiQuotaConfig = { limitPerMonth: 1e4, usedThisMonth: 0, windowStart: (/* @__PURE__ */ new Date()).toISOString().split("T")[0] };
  const invoicesStore = [];
  app2.get("/api/v1/admin/billing/plans", async (_req, res) => {
    try {
      res.json({ plans: billingPlansStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });
  app2.post("/api/v1/admin/billing/plans", async (req, res) => {
    try {
      const body = req.body || {};
      const name = body.name && typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return res.status(400).json({ message: "name is required" });
      const plan = {
        id: `plan_${billingPlanNextId++}`,
        name,
        price: Number(body.price) || 0,
        interval: body.interval === "year" ? "year" : "month",
        creditsIncluded: body.creditsIncluded != null ? Number(body.creditsIncluded) : void 0,
        apiQuotaPerMonth: body.apiQuotaPerMonth != null ? Number(body.apiQuotaPerMonth) : void 0,
        features: Array.isArray(body.features) ? body.features.filter((e) => typeof e === "string") : void 0
      };
      billingPlansStore.push(plan);
      res.status(201).json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to create plan" });
    }
  });
  app2.patch("/api/v1/admin/billing/plans/:id", async (req, res) => {
    try {
      const plan = billingPlansStore.find((p) => p.id === req.params.id);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      const body = req.body || {};
      if (body.name !== void 0 && typeof body.name === "string") plan.name = body.name.trim();
      if (body.price !== void 0) plan.price = Number(body.price);
      if (body.interval !== void 0) plan.interval = body.interval === "year" ? "year" : "month";
      if (body.creditsIncluded !== void 0) plan.creditsIncluded = Number(body.creditsIncluded);
      if (body.apiQuotaPerMonth !== void 0) plan.apiQuotaPerMonth = Number(body.apiQuotaPerMonth);
      if (body.features !== void 0 && Array.isArray(body.features)) plan.features = body.features.filter((e) => typeof e === "string");
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to update plan" });
    }
  });
  app2.delete("/api/v1/admin/billing/plans/:id", async (req, res) => {
    try {
      const idx = billingPlansStore.findIndex((p) => p.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: "Plan not found" });
      billingPlansStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete plan" });
    }
  });
  app2.post("/api/v1/admin/billing/assign", async (req, res) => {
    try {
      const { userId, planId } = req.body || {};
      if (userId == null || !planId) return res.status(400).json({ message: "userId and planId required" });
      const plan = billingPlansStore.find((p) => p.id === planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      userPlanAssignments[Number(userId)] = planId;
      res.json({ success: true, userId: Number(userId), planId });
    } catch (error) {
      res.status(500).json({ message: "Failed to assign plan" });
    }
  });
  app2.get("/api/v1/admin/billing/invoices", async (_req, res) => {
    try {
      const list = invoicesStore.length > 0 ? invoicesStore : [{ id: "inv_1", planName: "Professional", amount: 99, currency: "USD", status: "paid", dueDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0], paidAt: (/* @__PURE__ */ new Date()).toISOString() }];
      res.json({ invoices: list });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });
  app2.get("/api/v1/admin/billing/api-quota", async (_req, res) => {
    try {
      res.json(apiQuotaConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch API quota" });
    }
  });
  app2.patch("/api/v1/admin/billing/api-quota", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.limitPerMonth !== void 0) apiQuotaConfig.limitPerMonth = Number(body.limitPerMonth);
      res.json(apiQuotaConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to update API quota" });
    }
  });
  const securityConfig = {
    sessionIdleMinutes: 30,
    sessionMaxDurationMinutes: 480,
    sessionRememberMeDays: 14,
    ipRestrictionEnabled: false,
    ipAllowlist: [],
    ipDenylist: []
  };
  app2.get("/api/v1/admin/security", async (_req, res) => {
    try {
      const payload = {
        defaultPasswordLength: "12",
        defaultSessionDuration: "90",
        securityAlerts: [{ id: 1, type: "warning", message: "3 users without 2FA", action: "Review", time: "2 hours ago" }],
        recentActivity: [
          { id: 1, action: "Login", user: "admin@example.com", ip: "192.168.1.1", location: "Office", time: "10 min ago", status: "success" }
        ],
        securitySettings: [
          { id: 1, name: "Two-factor authentication", description: "Require 2FA for all users", enabled: true },
          { id: 2, name: "Single sign-on", description: "Allow SSO login", enabled: false }
        ],
        complianceCertifications: [
          { name: "SOC 2", status: "Compliant", date: "2024-01", icon: "Shield" },
          { name: "GDPR", status: "Certified", date: "2024-01", icon: "Lock" }
        ],
        ...securityConfig
      };
      res.json(payload);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch security" });
    }
  });
  app2.patch("/api/v1/admin/security", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.sessionIdleMinutes !== void 0) securityConfig.sessionIdleMinutes = Number(body.sessionIdleMinutes);
      if (body.sessionMaxDurationMinutes !== void 0) securityConfig.sessionMaxDurationMinutes = Number(body.sessionMaxDurationMinutes);
      if (body.sessionRememberMeDays !== void 0) securityConfig.sessionRememberMeDays = Number(body.sessionRememberMeDays);
      if (body.ipRestrictionEnabled !== void 0) securityConfig.ipRestrictionEnabled = Boolean(body.ipRestrictionEnabled);
      if (Array.isArray(body.ipAllowlist)) securityConfig.ipAllowlist = body.ipAllowlist.filter((e) => typeof e === "string");
      if (Array.isArray(body.ipDenylist)) securityConfig.ipDenylist = body.ipDenylist.filter((e) => typeof e === "string");
      const payload = {
        defaultPasswordLength: "12",
        defaultSessionDuration: "90",
        securityAlerts: [],
        recentActivity: [],
        securitySettings: [],
        complianceCertifications: [],
        ...securityConfig
      };
      res.json(payload);
    } catch (error) {
      res.status(500).json({ message: "Failed to update security" });
    }
  });
  app2.get("/api/v1/admin/audit-logs", async (req, res) => {
    try {
      const type = req.query.type || "login";
      const now = /* @__PURE__ */ new Date();
      const ts = (d) => d.toISOString();
      const sample = [];
      const base = [
        { user: "admin@example.com", ip: "192.168.1.1", location: "San Francisco, US" },
        { user: "jane@example.com", ip: "10.0.0.5", location: "New York, US" },
        { user: "john@example.com", ip: "172.16.0.2", location: "London, UK" }
      ];
      if (type === "login") {
        sample.push(
          { id: "1", type: "login", action: "Login successful", ...base[0], timestamp: ts(now), status: "success" },
          { id: "2", type: "login", action: "Login successful", ...base[1], timestamp: ts(new Date(now.getTime() - 36e5)), status: "success" },
          { id: "3", type: "login", action: "Failed login attempt", ...base[2], timestamp: ts(new Date(now.getTime() - 72e5)), status: "failure" }
        );
      } else if (type === "data_access") {
        sample.push(
          { id: "4", type: "data_access", action: "Viewed proposal", ...base[0], resource: "Proposal #101", timestamp: ts(now), status: "success" },
          { id: "5", type: "data_access", action: "Exported proposal PDF", ...base[1], resource: "Proposal #102", timestamp: ts(new Date(now.getTime() - 18e5)), status: "success" }
        );
      } else if (type === "file") {
        sample.push(
          { id: "6", type: "file", action: "Uploaded document", ...base[0], resource: "RFP-spec.pdf", details: "Content Library", timestamp: ts(now), status: "success" },
          { id: "7", type: "file", action: "Downloaded proposal", ...base[1], resource: "Proposal #101", timestamp: ts(new Date(now.getTime() - 36e5)), status: "success" }
        );
      } else if (type === "ai_usage") {
        sample.push(
          { id: "8", type: "ai_usage", action: "AI generation", ...base[0], resource: "Proposal #101", details: "GPT-4, ~1.2k tokens", timestamp: ts(now), status: "success" },
          { id: "9", type: "ai_usage", action: "AI generation", ...base[2], resource: "Proposal #103", details: "GPT-4, ~800 tokens", timestamp: ts(new Date(now.getTime() - 54e5)), status: "success" }
        );
      }
      res.json({ entries: sample, total: sample.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    // All /api requests go to RFP backend (auth, users, proposals, etc.)
    // Uses VITE_API_BASE_URL from client/.env when set; otherwise localhost:8000
    proxy: {
      "/api": {
        target: process.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000",
        changeOrigin: true
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
import os from "os";
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const requestedPort = Number(process.env.PORT) || 5e3;
  const host = process.env.HOST || "0.0.0.0";
  const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      const nets = interfaces[name];
      if (nets) {
        for (const net of nets) {
          if (net.family === "IPv4" && !net.internal) {
            return net.address;
          }
        }
      }
    }
    return null;
  };
  const tryListen = (port, maxAttempts = 100) => {
    if (maxAttempts <= 0) {
      throw new Error("Could not find an available port after multiple attempts");
    }
    const errorHandler = (err) => {
      if (err.code === "EADDRINUSE") {
        log(`Port ${port} is in use, trying port ${port + 1}...`);
        server.removeListener("error", errorHandler);
        tryListen(port + 1, maxAttempts - 1);
      } else {
        server.removeListener("error", errorHandler);
        throw err;
      }
    };
    server.once("error", errorHandler);
    try {
      server.listen(port, host, () => {
        server.removeListener("error", errorHandler);
        const localIP = getLocalIP();
        if (port !== requestedPort) {
          log(`Port ${requestedPort} was in use, serving on port ${port} instead`);
        }
        log(`\u2713 Server is running!`);
        log(`  Local:   http://localhost:${port}`);
        if (localIP) {
          log(`  Network: http://${localIP}:${port}`);
        }
      });
    } catch (err) {
      server.removeListener("error", errorHandler);
      throw err;
    }
  };
  tryListen(requestedPort);
})();
