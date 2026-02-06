import type { Express } from "express";
import { createServer, type Server } from "http";
import { ZodError } from "zod";
import { storage } from "./storage";
import { insertProposalSchema, insertChatMessageSchema } from "@shared/schema";

/** Collaborator role → permissions (must match client ROLE_TO_PERMISSIONS). Admins always have full access. */
const ROLE_TO_PERMISSIONS: Record<string, { canView: boolean; canEdit: boolean; canComment: boolean; canReview: boolean; canGenerateAi: boolean }> = {
  viewer: { canView: true, canEdit: false, canComment: false, canReview: false, canGenerateAi: false },
  commenter: { canView: true, canEdit: false, canComment: true, canReview: false, canGenerateAi: false },
  editor: { canView: true, canEdit: true, canComment: true, canReview: false, canGenerateAi: true },
  reviewer: { canView: true, canEdit: true, canComment: true, canReview: true, canGenerateAi: false },
  contributor: { canView: true, canEdit: true, canComment: true, canReview: true, canGenerateAi: true },
};

function getPermissionsForRole(role: string): { canView: boolean; canEdit: boolean; canComment: boolean; canReview: boolean; canGenerateAi: boolean } {
  const r = (role || "viewer").toLowerCase();
  return ROLE_TO_PERMISSIONS[r] ?? ROLE_TO_PERMISSIONS.viewer;
}

/** Resolve proposal access for a caller. Returns proposal + whether caller is admin/owner or has collaborator permissions. */
async function getProposalAccess(
  proposalId: number,
  callerUserId?: number,
  callerUserRole?: string
): Promise<
  | { proposal: import("@shared/schema").Proposal; isAdmin: boolean; isOwner: boolean; permissions: { canView: boolean; canEdit: boolean; canComment: boolean; canReview: boolean; canGenerateAi: boolean } }
  | { proposal: null; isAdmin: false; isOwner: false; permissions: null }
> {
  const proposal = await storage.getProposal(proposalId);
  if (!proposal) return { proposal: null, isAdmin: false, isOwner: false, permissions: null };
  if (callerUserId == null || callerUserRole === undefined || callerUserRole === "") {
    return { proposal, isAdmin: true, isOwner: true, permissions: ROLE_TO_PERMISSIONS.contributor };
  }
  const role = (callerUserRole || "").toLowerCase();
  if (role === "admin") return { proposal, isAdmin: true, isOwner: false, permissions: ROLE_TO_PERMISSIONS.contributor };
  if (proposal.ownerId === callerUserId) return { proposal, isAdmin: false, isOwner: true, permissions: ROLE_TO_PERMISSIONS.contributor };
  const collabs = await storage.getCollaborationsByProposalId(proposalId);
  const collab = collabs.find((c) => c.userId === callerUserId);
  if (!collab) return { proposal, isAdmin: false, isOwner: false, permissions: { canView: false, canEdit: false, canComment: false, canReview: false, canGenerateAi: false } };
  const permissions = getPermissionsForRole(collab.role);
  return { proposal, isAdmin: false, isOwner: false, permissions };
}

function withoutPassword<T extends { password?: string }>(user: T): Omit<T, "password"> {
  const { password: _, ...rest } = user;
  return rest;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // User routes (RFPSuite storage) – also used when same-origin; client may call /api/users or /api/v1/users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map((u) => withoutPassword(u)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app.get("/api/v1/users", async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map((u) => withoutPassword(u)));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app.get("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app.get("/api/v1/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app.patch("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const user = await storage.updateUser(id, updates);
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  app.patch("/api/v1/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const user = await storage.updateUser(id, updates);
      res.json(withoutPassword(user));
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });
  app.delete("/api/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
  app.delete("/api/v1/users/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Proposal routes
  app.get("/api/proposals", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const userRole = req.query.userRole as string | undefined;
      
      let proposals;
      if (userRole === "admin" || userRole === "super_admin") {
        // Admin and super_admin see all proposals (same list)
        proposals = await storage.getAllProposals();
      } else if (userId) {
        // Regular users see only their proposals
        proposals = await storage.getProposalsByUserId(userId);
      } else {
        return res.status(400).json({ message: "userId required for non-admin users" });
      }

      // Fetch owner information for each proposal
      const proposalsWithOwners = await Promise.all(
        proposals.map(async (proposal) => {
          let owner = null;
          if (proposal.ownerId) {
            const ownerUser = await storage.getUser(proposal.ownerId);
            if (ownerUser) {
              owner = {
                id: ownerUser.id,
                name: `${ownerUser.firstName} ${ownerUser.lastName}`,
                avatar: ownerUser.avatar || `${ownerUser.firstName[0]}${ownerUser.lastName[0]}`,
                email: ownerUser.email,
                company: ownerUser.company,
              };
            }
          }
          return {
            ...proposal,
            owner,
          };
        })
      );

      res.json(proposalsWithOwners);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposals" });
    }
  });

  app.get("/api/proposals/:id", async (req, res) => {
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

  app.post("/api/proposals", async (req, res) => {
    try {
      const proposalData = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(proposalData);
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ message: "Failed to create proposal" });
    }
  });

  app.patch("/api/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updates = req.body;
      const proposal = await storage.updateProposal(id, updates);
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to update proposal" });
    }
  });

  app.delete("/api/proposals/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProposal(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete proposal" });
    }
  });

  // Mount same proposal routes under /api/v1 (client uses /api/v1 via getApiUrl)
  const getProposalsHandler = async (req: import("express").Request, res: import("express").Response) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const userRole = req.query.userRole as string | undefined;
      let proposals;
      if (userRole === "admin" || userRole === "super_admin") {
        proposals = await storage.getAllProposals();
      } else if (userId) {
        proposals = await storage.getProposalsByUserId(userId);
      } else {
        return res.status(400).json({ message: "userId required for non-admin users" });
      }
      const proposalsWithOwners = await Promise.all(
        proposals.map(async (proposal: any) => {
          let owner = null;
          if (proposal.ownerId) {
            const ownerUser = await storage.getUser(proposal.ownerId);
            if (ownerUser) {
              owner = {
                id: ownerUser.id,
                name: `${ownerUser.firstName} ${ownerUser.lastName}`,
                avatar: ownerUser.avatar || `${ownerUser.firstName[0]}${ownerUser.lastName[0]}`,
                email: ownerUser.email,
                company: ownerUser.company,
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
  app.get("/api/v1/proposals", getProposalsHandler);
  app.get("/api/v1/proposals/:id", async (req: import("express").Request, res: import("express").Response) => {
    try {
      const id = parseInt(req.params.id);
      const callerUserId = req.query.userId != null ? parseInt(req.query.userId as string) : undefined;
      const callerUserRole = req.query.userRole as string | undefined;
      const access = await getProposalAccess(id, callerUserId, callerUserRole);
      if (!access.proposal) return res.status(404).json({ message: "Proposal not found" });
      const canView = access.isAdmin || access.isOwner || (access.permissions?.canView === true);
      if (!canView) return res.status(403).json({ message: "You do not have permission to view this proposal" });
      res.json(access.proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposal" });
    }
  });
  app.post("/api/v1/proposals", async (req: import("express").Request, res: import("express").Response) => {
    try {
      const proposalData = insertProposalSchema.parse(req.body);
      const proposal = await storage.createProposal(proposalData);
      res.json(proposal);
    } catch (error) {
      res.status(400).json({ message: "Failed to create proposal" });
    }
  });
  // RFP file parse (PDF/Word) – stub returns 501 until real parser is implemented; client creates proposal with placeholder then
  app.post("/api/v1/proposals/parse-upload", async (_req: import("express").Request, res: import("express").Response) => {
    res.status(501).json({ message: "RFP file parser not implemented; use placeholder flow" });
  });
  app.patch("/api/v1/proposals/:id", async (req: import("express").Request, res: import("express").Response) => {
    try {
      const id = parseInt(req.params.id);
      const callerUserId = req.query.userId != null ? parseInt(req.query.userId as string) : req.body?.userId != null ? parseInt(String(req.body.userId)) : undefined;
      const callerUserRole = (req.query.userRole as string) ?? req.body?.userRole;
      const access = await getProposalAccess(id, callerUserId, callerUserRole);
      if (!access.proposal) return res.status(404).json({ message: "Proposal not found" });
      const canEdit = access.isAdmin || access.isOwner || (access.permissions?.canEdit === true);
      if (!canEdit) return res.status(403).json({ message: "You do not have permission to edit this proposal" });
      const { userId: _u, userRole: _r, ...updates } = req.body;
      const proposal = await storage.updateProposal(id, updates);
      res.json(proposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to update proposal" });
    }
  });
  app.delete("/api/v1/proposals/:id", async (req: import("express").Request, res: import("express").Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteProposal(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete proposal" });
    }
  });

  app.get("/api/v1/proposals/:id/activity", async (req: import("express").Request, res: import("express").Response) => {
    try {
      const id = parseInt(req.params.id);
      const callerUserId = req.query.userId != null ? parseInt(req.query.userId as string) : undefined;
      const callerUserRole = req.query.userRole as string | undefined;
      const access = await getProposalAccess(id, callerUserId, callerUserRole);
      if (!access.proposal) return res.status(404).json({ message: "Proposal not found" });
      const canView = access.isAdmin || access.isOwner || (access.permissions?.canView === true);
      if (!canView) return res.status(403).json({ message: "You do not have permission to view this proposal's activity" });
      res.json({ entries: [] });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activity" });
    }
  });

  app.post("/api/proposals/:id/generate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const proposal = await storage.getProposal(id);
      
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found" });
      }

      // Get additional context from request body (requirements, AI context, etc.)
      const { requirements, aiContext, clientName, clientContact, clientEmail } = req.body;
      
      // Parse requirements if provided as string
      const requirementsList = requirements 
        ? (typeof requirements === 'string' ? requirements.split(',').map(r => r.trim()).filter(r => r) : requirements)
        : [];

      // Simulate AI generation (in a real app, you'd call an AI service)
      // Generate comprehensive proposal content based on the proposal data
      const generatedContent = {
        executiveSummary: `This proposal outlines our comprehensive solution for ${proposal.title}. Based on the requirements and industry standards, we have developed a tailored approach that addresses all key aspects of your project.${aiContext ? `\n\nAdditional context: ${aiContext}` : ''}`,
        introduction: `We are pleased to submit this proposal for ${proposal.title}. Our team has carefully reviewed your requirements and is excited to present a solution that aligns with your objectives and budget considerations.${clientName ? ` We look forward to partnering with ${clientName} on this initiative.` : ''}`,
        projectOverview: {
          title: proposal.title,
          description: proposal.description || "A comprehensive solution tailored to your needs",
          industry: proposal.industry || "General",
          timeline: proposal.timeline || "To be determined",
          budget: proposal.budgetRange || "To be discussed",
          client: clientName || null,
          contact: clientContact || null,
          email: clientEmail || null,
        },
        requirements: requirementsList.length > 0 ? requirementsList : [
          "Comprehensive analysis and planning phase",
          "Agile development methodology",
          "Quality assurance and testing protocols",
        ],
        solutionApproach: `Our approach combines industry best practices with innovative solutions to deliver exceptional results. We will leverage our expertise in ${proposal.industry || "your industry"} to ensure successful project delivery.${aiContext ? `\n\nSpecial considerations: ${aiContext}` : ''}`,
        technicalSpecifications: [
          "Comprehensive analysis and planning phase",
          "Agile development methodology",
          "Quality assurance and testing protocols",
          "Deployment and integration support",
          "Ongoing maintenance and support services",
        ],
        deliverables: [
          "Complete project documentation",
          "Source code and technical assets",
          "Training materials and sessions",
          "Post-deployment support plan",
          "Regular progress reports and updates",
        ],
        timeline: {
          phase1: "Planning and Analysis (Weeks 1-2)",
          phase2: "Design and Development (Weeks 3-8)",
          phase3: "Testing and Quality Assurance (Weeks 9-10)",
          phase4: "Deployment and Training (Weeks 11-12)",
        },
        team: {
          projectManager: "Dedicated project manager for coordination",
          technicalLead: "Experienced technical lead for architecture",
          developers: "Skilled development team",
          qa: "Quality assurance specialists",
        },
        pricing: {
          base: proposal.budgetRange || "Custom pricing available",
          paymentTerms: "Milestone-based payments",
          additionalServices: "Available upon request",
        },
        nextSteps: [
          "Schedule a detailed discussion meeting",
          "Review and refine proposal details",
          "Finalize contract terms",
          "Begin project kickoff",
        ],
        generatedAt: new Date().toISOString(),
      };

      // Update proposal with generated content and change status to in_progress
      const updatedProposal = await storage.updateProposal(id, {
        content: generatedContent,
        status: "in_progress",
      });

      res.json(updatedProposal);
    } catch (error) {
      res.status(500).json({ message: "Failed to generate proposal content" });
    }
  });

  // My collaborations (for collaborator view) – same shape as client MyCollaborationItem[]
  app.get("/api/v1/proposals/my-collaborations", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      if (userId == null || isNaN(userId)) {
        return res.status(400).json({ message: "userId query parameter required" });
      }
      const collaborations = await storage.getCollaborationsByUserId(userId);
      const items = await Promise.all(
        collaborations.map(async (collab) => {
          const proposal = await storage.getProposal(collab.proposalId!);
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
            createdAt: collab.createdAt instanceof Date ? collab.createdAt.toISOString() : (collab.createdAt as string | null) ?? "",
          };
          const proposalJson = {
            ...proposal,
            createdAt: proposal.createdAt instanceof Date ? proposal.createdAt.toISOString() : (proposal.createdAt as string | null) ?? "",
            updatedAt: proposal.updatedAt instanceof Date ? proposal.updatedAt.toISOString() : (proposal.updatedAt as string | null) ?? "",
          };
          return { proposal: proposalJson, collaboration };
        })
      );
      res.json(items.filter(Boolean));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborations" });
    }
  });

  // Build collaboration API response with user and permission flags (strictly from role)
  async function collaborationJson(collab: import("@shared/schema").Collaboration) {
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
      createdAt: collab.createdAt instanceof Date ? collab.createdAt.toISOString() : (collab.createdAt as string | null) ?? "",
      user: user
        ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName }
        : undefined,
    };
  }

  // V1 proposal-scoped collaboration routes (admin and customer/owner have full control)
  app.get("/api/v1/proposals/:id/collaborations", async (req, res) => {
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

  app.get("/api/v1/proposals/:id/my-collaboration", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
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

  app.post("/api/v1/proposals/:id/collaborations", async (req, res) => {
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
        role: role || "viewer",
      });
      const result = await collaborationJson(created);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ message: "Failed to add collaboration" });
    }
  });

  app.patch("/api/v1/proposals/:id/collaborations/:cid", async (req, res) => {
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

  app.delete("/api/v1/proposals/:id/collaborations/:cid", async (req, res) => {
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

  // Proposal questions & answers (in-memory; replace with DB in production)
  type QuestionRecord = { id: number; proposalId: number; question: string; order: number; source: string; createdAt: string };
  type AnswerRecord = { id: number; questionId: number; answer: string; respondentToken?: string | null; createdAt: string; updatedAt: string };
  type ShareTokenRecord = { id: number; proposalId: number; token: string; createdAt: string };
  type AnswerCommentRecord = { id: number; proposalId: number; answerId: number; authorId: number; authorName: string; text: string; mentions: number[]; parentId: number | null; createdAt: string };
  const proposalQuestionsStore: QuestionRecord[] = [];
  const proposalAnswersStore: AnswerRecord[] = [];
  const shareTokensStore: ShareTokenRecord[] = [];
  const answerCommentsStore: AnswerCommentRecord[] = [];
  type SuggestionRecord = { id: number; proposalId: number; answerId: number; suggestedBy: number; suggestedByName: string; suggestedText: string; message: string; status: "pending" | "accepted" | "rejected"; createdAt: string };
  type ProposalChatRecord = { id: number; proposalId: number; authorId: number; authorName: string; text: string; createdAt: string };
  const suggestionStore: SuggestionRecord[] = [];
  const proposalChatStore: ProposalChatRecord[] = [];
  type NotificationRecord = { id: string; userId: number; title: string; message: string; type: string; read: boolean; link?: string; createdAt: string };
  const notificationStore: NotificationRecord[] = [];
  let notificationNextId = 1;
  let questionNextId = 1;
  let answerNextId = 1;
  let shareTokenNextId = 1;
  let commentNextId = 1;
  let suggestionNextId = 1;
  let proposalChatNextId = 1;
  const isoNow = () => new Date().toISOString();

  function addNotification(forUserId: number, title: string, message: string, type: string, link?: string) {
    if (!forUserId) return;
    notificationStore.push({
      id: `notif_${notificationNextId++}`,
      userId: forUserId,
      title,
      message,
      type,
      read: false,
      link,
      createdAt: isoNow(),
    });
  }

  async function ensureProposalExists(proposalId: number): Promise<boolean> {
    const p = await storage.getProposal(proposalId);
    return !!p;
  }

  app.get("/api/v1/proposals/:id/questions", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const list = proposalQuestionsStore.filter((q) => q.proposalId === proposalId).sort((a, b) => a.order - b.order);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch questions" });
    }
  });

  app.post("/api/v1/proposals/:id/questions", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const body = req.body || {};
      const question: QuestionRecord = {
        id: questionNextId++,
        proposalId,
        question: typeof body.question === "string" ? body.question : "",
        order: typeof body.order === "number" ? body.order : proposalQuestionsStore.filter((q) => q.proposalId === proposalId).length,
        source: typeof body.source === "string" ? body.source : "user",
        createdAt: isoNow(),
      };
      proposalQuestionsStore.push(question);
      res.status(201).json(question);
    } catch (error) {
      res.status(400).json({ message: "Failed to create question" });
    }
  });

  app.patch("/api/v1/proposals/:id/questions/:questionId", async (req, res) => {
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

  app.delete("/api/v1/proposals/:id/questions/:questionId", async (req, res) => {
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

  app.get("/api/v1/proposals/:id/answers", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const questionIds = new Set(proposalQuestionsStore.filter((q) => q.proposalId === proposalId).map((q) => q.id));
      const list = proposalAnswersStore.filter((a) => questionIds.has(a.questionId));
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch answers" });
    }
  });

  app.post("/api/v1/proposals/:id/answers", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
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
      const ans: AnswerRecord = { id: answerNextId++, questionId: qid, answer: typeof answer === "string" ? answer : "", createdAt: now, updatedAt: now };
      proposalAnswersStore.push(ans);
      res.status(201).json(ans);
    } catch (error) {
      res.status(400).json({ message: "Failed to save answer" });
    }
  });

  app.post("/api/v1/proposals/:id/answers/bulk", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const questionIds = new Set(proposalQuestionsStore.filter((q) => q.proposalId === proposalId).map((q) => q.id));
      const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
      const now = isoNow();
      const result: AnswerRecord[] = [];
      for (const item of answers) {
        const qid = item.questionId != null ? Number(item.questionId) : NaN;
        if (!Number.isInteger(qid) || !questionIds.has(qid)) continue;
        const text = typeof item.answer === "string" ? item.answer : "";
        const existing = proposalAnswersStore.find((a) => a.questionId === qid);
        if (existing) {
          existing.answer = text;
          existing.updatedAt = now;
          result.push(existing);
        } else {
          const ans: AnswerRecord = { id: answerNextId++, questionId: qid, answer: text, createdAt: now, updatedAt: now };
          proposalAnswersStore.push(ans);
          result.push(ans);
        }
      }
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: "Failed to save answers" });
    }
  });

  // Generate AI answers for questions (contract: questionIds + options.tone, options.detailLevel → { answers: [{ questionId, answer, generatedAt }] })
  app.post("/api/v1/proposals/:id/answers/generate", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const questionIds = Array.isArray(req.body?.questionIds) ? req.body.questionIds.map((x: unknown) => Number(x)).filter(Number.isInteger) : [];
      const options = req.body?.options ?? {};
      const tone = options.tone ?? "professional";
      const detailLevel = options.detailLevel ?? "detailed";
      const questions = proposalQuestionsStore.filter((q) => q.proposalId === proposalId && questionIds.includes(q.id));
      const now = new Date().toISOString();
      const answers = questions.map((q) => ({
        questionId: q.id,
        answer: `[AI-generated placeholder for: "${q.question.slice(0, 60)}..." — tone: ${tone}, length: ${detailLevel}. Replace with real LLM in backend.]`,
        generatedAt: now,
      }));
      res.json({ answers });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate answers" });
    }
  });

  app.get("/api/v1/proposals/:id/answers/:answerId/comments", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const answerId = parseInt(req.params.answerId);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const list = answerCommentsStore.filter((c) => c.proposalId === proposalId && c.answerId === answerId);
      const byParent = new Map<number | null, AnswerCommentRecord[]>();
      list.forEach((c) => {
        const key = c.parentId ?? null;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(c);
      });
      const root = (byParent.get(null) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const comments = root.map((c) => ({
        ...c,
        replies: (byParent.get(c.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }));
      res.json({ comments });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/v1/proposals/:id/answers/:answerId/comments", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const answerId = parseInt(req.params.answerId);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const text = (req.body?.text ?? req.body?.message ?? "") as string;
      const mentions = (req.body?.mentions ?? []) as number[];
      const parentId = req.body?.parentId != null ? Number(req.body.parentId) : null;
      const userId = (req as any).user?.id ?? 1;
      const userName = (req as any).user ? `${(req as any).user.firstName ?? ""} ${(req as any).user.lastName ?? ""}`.trim() || "User" : "User";
      const now = isoNow();
      const rec: AnswerCommentRecord = {
        id: commentNextId++,
        proposalId,
        answerId,
        authorId: userId,
        authorName: userName,
        text: typeof text === "string" ? text : "",
        mentions: Array.isArray(mentions) ? mentions : [],
        parentId: parentId != null ? Number(parentId) : null,
        createdAt: now,
      };
      answerCommentsStore.push(rec);
      const proposal = await storage.getProposal(proposalId);
      const ownerId = proposal?.ownerId;
      if (ownerId != null && ownerId !== userId) {
        const isReply = parentId != null;
        addNotification(
          ownerId,
          isReply ? "New reply on proposal" : "New comment on proposal",
          `${userName} ${isReply ? "replied to a comment" : "commented"} on a question.`,
          "comment",
          `/rfp/${proposalId}/questions`
        );
      }
      res.status(201).json(rec);
    } catch (error) {
      res.status(400).json({ message: "Failed to add comment" });
    }
  });

  app.get("/api/v1/proposals/:id/chat", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const list = proposalChatStore.filter((c) => c.proposalId === proposalId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      res.json({ messages: list });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposal chat" });
    }
  });

  app.post("/api/v1/proposals/:id/chat", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const { text } = req.body ?? {};
      const userId = (req as any).user?.id ?? 1;
      const userName = (req as any).user ? `${(req as any).user.firstName ?? ""} ${(req as any).user.lastName ?? ""}`.trim() || "User" : "User";
      const now = isoNow();
      const rec: ProposalChatRecord = {
        id: proposalChatNextId++,
        proposalId,
        authorId: userId,
        authorName: userName,
        text: typeof text === "string" ? text : "",
        createdAt: now,
      };
      proposalChatStore.push(rec);
      res.status(201).json(rec);
    } catch (error) {
      res.status(400).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/v1/proposals/:id/comments", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const allComments = answerCommentsStore.filter((c) => c.proposalId === proposalId);
      const questions = proposalQuestionsStore.filter((q) => q.proposalId === proposalId).sort((a, b) => a.order - b.order);
      const answers = proposalAnswersStore.filter((a) => questions.some((q) => q.id === a.questionId));
      const questionById = new Map(questions.map((q) => [q.id, q]));
      const answerIdsByQuestionId = new Map<number, number[]>();
      answers.forEach((a) => {
        if (!answerIdsByQuestionId.has(a.questionId)) answerIdsByQuestionId.set(a.questionId, []);
        answerIdsByQuestionId.get(a.questionId)!.push(a.id);
      });
      const groups: { answerId: number; questionId: number; questionText: string; comments: { id: number; authorName: string; text: string; parentId: number | null; createdAt: string; replies: unknown[] }[] }[] = [];
      const answerIdsWithComments = [...new Set(allComments.map((c) => c.answerId))];
      for (const q of questions) {
        const answerIds = answerIdsByQuestionId.get(q.id) ?? [];
        for (const answerId of answerIds) {
          if (!answerIdsWithComments.includes(answerId)) continue;
          const list = allComments.filter((c) => c.answerId === answerId);
          const byParent = new Map<number | null, AnswerCommentRecord[]>();
          list.forEach((c) => {
            const key = c.parentId ?? null;
            if (!byParent.has(key)) byParent.set(key, []);
            byParent.get(key)!.push(c);
          });
          const root = (byParent.get(null) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const comments = root.map((c) => ({
            ...c,
            replies: (byParent.get(c.id) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
          }));
          groups.push({ answerId, questionId: q.id, questionText: q.question, comments });
        }
      }
      res.json({ groups });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposal comments" });
    }
  });

  app.get("/api/v1/proposals/:id/suggestions", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const list = suggestionStore.filter((s) => s.proposalId === proposalId);
      res.json({ suggestions: list });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch suggestions" });
    }
  });

  app.post("/api/v1/proposals/:id/answers/:answerId/suggestions", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const answerId = parseInt(req.params.answerId);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const { suggestedText, message = "" } = req.body ?? {};
      const userId = (req as any).user?.id ?? 1;
      const userName = (req as any).user ? `${(req as any).user.firstName ?? ""} ${(req as any).user.lastName ?? ""}`.trim() || "User" : "User";
      const now = isoNow();
      const rec: SuggestionRecord = {
        id: suggestionNextId++,
        proposalId,
        answerId,
        suggestedBy: userId,
        suggestedByName: userName,
        suggestedText: typeof suggestedText === "string" ? suggestedText : "",
        message: typeof message === "string" ? message : "",
        status: "pending",
        createdAt: now,
      };
      suggestionStore.push(rec);
      const proposal = await storage.getProposal(proposalId);
      const ownerId = proposal?.ownerId;
      if (ownerId != null && ownerId !== userId) {
        addNotification(
          ownerId,
          "New suggestion on proposal",
          `${userName} suggested an edit to an answer.`,
          "info",
          `/rfp/${proposalId}/questions`
        );
      }
      res.status(201).json(rec);
    } catch (error) {
      res.status(400).json({ message: "Failed to create suggestion" });
    }
  });

  app.patch("/api/v1/proposals/:id/suggestions/:suggestionId", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const suggestionId = parseInt(req.params.suggestionId);
      const { status } = req.body ?? {};
      if (status !== "accepted" && status !== "rejected") return res.status(400).json({ message: "status must be accepted or rejected" });
      const rec = suggestionStore.find((s) => s.proposalId === proposalId && s.id === suggestionId);
      if (!rec) return res.status(404).json({ message: "Suggestion not found" });
      const previousStatus = rec.status;
      rec.status = status;
      const userId = (req as any).user?.id ?? 1;
      if (rec.suggestedBy !== userId && previousStatus === "pending") {
        addNotification(
          rec.suggestedBy,
          status === "accepted" ? "Suggestion accepted" : "Suggestion rejected",
          `Your suggested edit was ${status}.`,
          status === "accepted" ? "success" : "info",
          `/rfp/${proposalId}/questions`
        );
      }
      res.json(rec);
    } catch (error) {
      res.status(400).json({ message: "Failed to update suggestion" });
    }
  });

  app.get("/api/v1/proposals/:id/draft", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });
      const questions = proposalQuestionsStore.filter((q) => q.proposalId === proposalId).sort((a, b) => a.order - b.order);
      const questionIds = new Set(questions.map((q) => q.id));
      const answers = proposalAnswersStore.filter((a) => questionIds.has(a.questionId));
      const proposalJson = {
        ...proposal,
        createdAt: proposal.createdAt instanceof Date ? proposal.createdAt.toISOString() : (proposal.createdAt as string | null) ?? "",
        updatedAt: proposal.updatedAt instanceof Date ? proposal.updatedAt.toISOString() : (proposal.updatedAt as string | null) ?? "",
      };
      res.json({ proposal: proposalJson, questions, answers, status: proposal.status || "draft" });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch draft" });
    }
  });

  app.post("/api/v1/proposals/:id/share-token", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
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

  app.get("/api/v1/notifications", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      if (userId == null) return res.json([]);
      const list = notificationStore.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(list.map((n) => ({ id: n.id, title: n.title, message: n.message, type: n.type, time: n.createdAt, read: n.read, link: n.link ?? null, createdAt: n.createdAt })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/v1/notifications/:notificationId/read", async (req, res) => {
    try {
      const id = req.params.notificationId;
      const n = notificationStore.find((x) => x.id === id);
      if (n) n.read = true;
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.delete("/api/v1/notifications/:notificationId", async (req, res) => {
    try {
      const id = req.params.notificationId;
      const idx = notificationStore.findIndex((x) => x.id === id);
      if (idx !== -1) notificationStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to dismiss" });
    }
  });

  app.patch("/api/v1/notifications/read-all", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      if (userId != null) notificationStore.filter((n) => n.userId === userId).forEach((n) => { n.read = true; });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });

  app.delete("/api/v1/notifications", async (req, res) => {
    try {
      const userId = (req as any).user?.id ?? null;
      if (userId != null) {
        for (let i = notificationStore.length - 1; i >= 0; i--) {
          if (notificationStore[i].userId === userId) notificationStore.splice(i, 1);
        }
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to dismiss all" });
    }
  });

  // Collaboration routes
  app.get("/api/collaborations", async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const proposalId = req.query.proposalId ? parseInt(req.query.proposalId as string) : undefined;
      
      if (userId) {
        const collaborations = await storage.getCollaborationsByUserId(userId);
        
        // Get proposal details for each collaboration
        const collaborationsWithProposals = await Promise.all(
          collaborations.map(async (collab) => {
            const proposal = await storage.getProposal(collab.proposalId!);
            const owner = proposal ? await storage.getUser(proposal.ownerId!) : null;
            return {
              ...collab,
              proposal,
              owner: owner ? { ...owner, password: undefined } : null,
            };
          })
        );
        
        res.json(collaborationsWithProposals);
      } else if (proposalId) {
        const collaborations = await storage.getCollaborationsByProposalId(proposalId);
        res.json(collaborations);
      } else {
        res.status(400).json({ message: "userId or proposalId required" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborations" });
    }
  });

  // Chat routes
  app.get("/api/chat/:proposalId", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.proposalId);
      const messages = await storage.getChatMessagesByProposalId(proposalId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      
      // Simulate AI response (in a real app, you'd call an AI service)
      if (!messageData.isAi) {
        setTimeout(async () => {
          const aiResponse = await storage.createChatMessage({
            proposalId: messageData.proposalId,
            userId: messageData.userId,
            message: "That's a great question! Based on your project requirements, I'd recommend focusing on scalability and security. Would you like me to elaborate on specific technical requirements?",
            isAi: true,
          });
        }, 1000);
      }
      
      res.json(message);
    } catch (error) {
      res.status(400).json({ message: "Failed to send message" });
    }
  });

  // Credit purchase routes
  app.post("/api/credits/purchase", async (req, res) => {
    try {
      const { userId, plan, amount } = req.body;
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Add credits to user
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const updatedUser = await storage.updateUser(userId, {
        credits: (user.credits || 0) + amount,
      });
      
      // Record transaction
      await storage.createCreditTransaction({
        userId,
        amount,
        type: "purchase",
        description: `Purchased ${plan} plan`,
      });
      
      res.json({ success: true, credits: updatedUser.credits });
    } catch (error) {
      res.status(500).json({ message: "Payment failed" });
    }
  });

  // Customer: knowledge base documents (in-memory; replace with DB in production)
  type CustomerKbDoc = { id: number; name: string; type: string; size: number; uploadedAt: string; tags: string[]; version: number; description: string };
  type CustomerKbVersion = { id: number; documentId: number; version: number; uploadedAt: string; uploadedBy: string; changes: string };
  const customerKbDocuments: CustomerKbDoc[] = [];
  const customerKbVersions: CustomerKbVersion[] = [];
  let customerKbDocNextId = 1;
  let customerKbVersionNextId = 1;

  app.get("/api/v1/customer/knowledge-base/documents", async (_req, res) => {
    try {
      res.json(customerKbDocuments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/v1/customer/knowledge-base/documents", async (req, res) => {
    try {
      const body = req.body || {};
      const now = new Date().toISOString();
      const doc: CustomerKbDoc = {
        id: customerKbDocNextId++,
        name: typeof body.name === "string" ? body.name : "Untitled",
        type: typeof body.type === "string" ? body.type : "pdf",
        size: typeof body.size === "number" ? body.size : 0,
        uploadedAt: now,
        tags: Array.isArray(body.tags) ? body.tags : [],
        version: 1,
        description: typeof body.description === "string" ? body.description : "",
      };
      customerKbDocuments.push(doc);
      customerKbVersions.push({
        id: customerKbVersionNextId++,
        documentId: doc.id,
        version: 1,
        uploadedAt: now,
        uploadedBy: "You",
        changes: "Initial upload",
      });
      res.status(201).json(doc);
    } catch (error) {
      res.status(400).json({ message: "Failed to create document" });
    }
  });

  app.patch("/api/v1/customer/knowledge-base/documents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = req.body || {};
      const doc = customerKbDocuments.find((d) => d.id === id);
      if (!doc) return res.status(404).json({ message: "Document not found" });
      if (Array.isArray(body.tags)) {
        doc.tags = body.tags;
      }
      res.json(doc);
    } catch (error) {
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete("/api/v1/customer/knowledge-base/documents/:id", async (req, res) => {
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

  app.get("/api/v1/customer/knowledge-base/documents/:id/versions", async (req, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const list = customerKbVersions.filter((v) => v.documentId === documentId).sort((a, b) => b.version - a.version);
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch versions" });
    }
  });

  app.get("/api/v1/customer/knowledge-base/versions", async (_req, res) => {
    try {
      const list = [...customerKbVersions].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch version history" });
    }
  });

  // Customer: account settings config (API source of truth; client can fall back to static JSON if unreachable)
  app.get("/api/v1/customer/account-settings", async (_req, res) => {
    try {
      const config = {
        page: { title: "Account Settings", subtitle: "Manage your profile and preferences" },
        headerActions: [
          { id: "home", label: "Home", icon: "home", href: "" },
          { id: "aiChat", label: "AI Chat", icon: "bot", href: "/ai-chat" },
          { id: "newProposal", label: "New Proposal", icon: "fileText", href: "/proposals/new" },
        ],
        sidebar: {
          settingsLabel: "Settings",
          nav: [
            { id: "profile", label: "Profile", icon: "user" },
            { id: "security", label: "Security", icon: "lock" },
            { id: "notifications", label: "Notifications", icon: "bell" },
            { id: "billing", label: "Billing", icon: "creditCard" },
          ],
          userCard: { creditsLabel: "Credits", creditsSuffix: "credits available", showCreditsBar: true },
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
              { id: "bio", label: "Bio", type: "textarea", placeholder: "Tell us about yourself...", rows: 3, gridCol: "full" },
            ],
            saveLabel: "Save Changes",
            savingLabel: "Saving...",
          },
          security: {
            title: "Security Settings",
            fields: [
              { id: "currentPassword", label: "Current Password", type: "password", placeholder: "Enter current password" },
              { id: "newPassword", label: "New Password", type: "password", placeholder: "Enter new password" },
              { id: "confirmPassword", label: "Confirm New Password", type: "password", placeholder: "Confirm new password" },
            ],
            twoFactor: { title: "Two-Factor Authentication", description: "Add an extra layer of security to your account", buttonLabel: "Enable 2FA", confirmTitle: "Enable Two-Factor Authentication", confirmDescription: "2FA Setup Code: {setupCode}\n\nPlease save this code. Continue to enable 2FA?", confirmButton: "Enable 2FA", cancelButton: "Cancel", successTitle: "2FA Enabled", successDescription: "Two-factor authentication has been enabled. Please scan the QR code with your authenticator app." },
            activeSessions: { title: "Active Sessions", sessionLabel: "Current Session", sessionDescription: "Chrome on macOS • Last active now", currentBadge: "Current" },
            updatePasswordLabel: "Update Password",
            updatingLabel: "Updating...",
          },
          notifications: {
            title: "Notification Preferences",
            toggles: [
              { id: "emailNotifications", label: "Email Notifications", description: "Receive notifications via email", defaultValue: true },
              { id: "proposalUpdates", label: "Proposal Updates", description: "Get notified when proposals are updated", defaultValue: true },
              { id: "collaborationInvites", label: "Collaboration Invites", description: "Get notified when invited to collaborate", defaultValue: true },
              { id: "marketingEmails", label: "Marketing Emails", description: "Receive updates about new features and tips", defaultValue: false },
              { id: "securityAlerts", label: "Security Alerts", description: "Get notified about security-related activities", defaultValue: true },
            ],
            saveLabel: "Save Preferences",
            successTitle: "Preferences saved",
            successDescription: "Your notification preferences have been saved.",
          },
          billing: {
            title: "Billing & Subscription",
            plan: { title: "Current Plan", planName: "Professional Plan", statusBadge: "Active", creditsLabel: "Credits Remaining:", nextBillingLabel: "Next Billing Date:" },
            paymentMethod: { title: "Payment Method", maskLabel: "•••• •••• •••• 4242", expiresLabel: "Expires 12/24", updateButtonLabel: "Update", updatePromptTitle: "Update Card Number", updatePromptDescription: "Enter new card number (16 digits)", updatePromptPlaceholder: "•••• •••• •••• ••••", successTitle: "Payment method updated", successDescription: "Your payment method has been updated successfully.", invalidTitle: "Invalid card number", invalidDescription: "Please enter a valid 16-digit card number." },
            transactionsTitle: "Recent Transactions",
            transactions: [
              { id: "1", description: "Professional Plan", date: "Dec 15, 2023", amount: "$79.00" },
              { id: "2", description: "Credit Top-up", date: "Nov 28, 2023", amount: "$29.00" },
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
            invoiceDownloadedDescription: "Your invoice has been downloaded.",
          },
        },
      };
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch account settings config" });
    }
  });

  // Content Library (in-memory store; replace with DB in production)
  type ContentAttachment = { name: string; dataUrl: string; size?: number };
  type ContentItemRecord = {
    id: number;
    title: string;
    category: string;
    content: string;
    status: string;
    tags: string[];
    starred: boolean;
    usageCount: number;
    lastUsed: string;
    lastUpdated: string;
    author: string;
    attachments?: ContentAttachment[];
  };
  const CONTENT_CATEGORY_ICONS: Record<string, string> = {
    "Company Overview": "BookOpen",
    "Technical Capabilities": "Lightbulb",
    "Case Studies": "FileText",
    "Pricing Templates": "Tag",
    "Security & Compliance": "CheckCircle",
  };
  const CONTENT_CATEGORY_COLORS = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-red-500"];
  const contentStore: ContentItemRecord[] = [];
  let contentNextId = 1;

  function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  app.get("/api/v1/admin/content", async (_req, res) => {
    try {
      const categoryCounts = new Map<string, number>();
      for (const item of contentStore) {
        const c = item.category || "Uncategorized";
        categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
      }
      const categories = Array.from(categoryCounts.entries()).map(([name], idx) => ({
        id: idx + 1,
        name,
        icon: CONTENT_CATEGORY_ICONS[name] || "FileText",
        count: categoryCounts.get(name) || 0,
        color: CONTENT_CATEGORY_COLORS[idx % CONTENT_CATEGORY_COLORS.length],
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
        starred: item.starred,
      }));
      res.json({ contentCategories: categories, contentItems });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.get("/api/content", async (_req, res) => {
    try {
      res.json(contentStore.map((item) => ({ ...item, tags: item.tags || [] })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.get("/api/content/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const item = contentStore.find((c) => c.id === id);
      if (!item) return res.status(404).json({ message: "Content not found" });
      res.json({ ...item, tags: item.tags || [] });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  app.post("/api/content", async (req, res) => {
    try {
      const body = req.body || {};
      const now = formatDate(new Date());
      const attachments = Array.isArray(body.attachments)
        ? body.attachments.filter(
            (a: unknown) =>
              a && typeof a === "object" && "name" in a && "dataUrl" in a && typeof (a as ContentAttachment).name === "string" && typeof (a as ContentAttachment).dataUrl === "string"
          ).map((a: ContentAttachment) => ({
            name: a.name,
            dataUrl: a.dataUrl,
            size: typeof a.size === "number" ? a.size : undefined,
          }))
        : [];
      const item: ContentItemRecord = {
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
        author: typeof body.author === "string" ? body.author : "Admin",
        attachments: attachments.length ? attachments : undefined,
      };
      contentStore.push(item);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ message: "Failed to create content" });
    }
  });

  app.patch("/api/content/:id", async (req, res) => {
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
      if (Array.isArray(body.attachments)) {
        const attachments = body.attachments.filter(
          (a: unknown) =>
            a && typeof a === "object" && "name" in a && "dataUrl" in a && typeof (a as ContentAttachment).name === "string" && typeof (a as ContentAttachment).dataUrl === "string"
        ).map((a: ContentAttachment) => ({
          name: a.name,
          dataUrl: a.dataUrl,
          size: typeof a.size === "number" ? a.size : undefined,
        }));
        item.attachments = attachments.length ? attachments : undefined;
      }
      item.lastUpdated = formatDate(new Date());
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update content" });
    }
  });

  app.delete("/api/content/:id", async (req, res) => {
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

  // Integrations routes
  app.get("/api/integrations", async (req, res) => {
    try {
      // Return mock integrations for now
      res.json([]);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations", async (req, res) => {
    try {
      const integrationData = req.body;
      // In a real app, save to database
      res.json({ id: Date.now(), ...integrationData });
    } catch (error) {
      res.status(400).json({ message: "Failed to create integration" });
    }
  });

  // Admin sidebar: full nav so all admin pages are reachable from the UI
  app.get("/api/v1/admin/sidebar", async (_req, res) => {
    try {
      res.json({
        navGroups: [
          {
            title: "Overview",
            items: [
              { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
              { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
            ],
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
              { href: "/admin/content", label: "Content Library", icon: "Library" },
            ],
          },
          {
            title: "AI & Billing",
            items: [
              { href: "/admin/ai-config", label: "AI Config", icon: "Sparkles" },
              { href: "/admin/knowledge-base", label: "Knowledge Base", icon: "Database" },
              { href: "/admin/usage", label: "Usage", icon: "TrendingUp" },
              { href: "/admin/credits", label: "Credits", icon: "CreditCard" },
              { href: "/admin/subscription-billing", label: "Subscription & Billing", icon: "Receipt" },
            ],
          },
          {
            title: "Security & Settings",
            items: [
              { href: "/admin/security", label: "Security", icon: "Shield" },
              { href: "/admin/audit-logs", label: "Audit Logs", icon: "ScrollText" },
              { href: "/admin/integrations", label: "Integrations", icon: "Zap" },
              { href: "/admin/settings", label: "Settings", icon: "Settings" },
            ],
          },
        ],
        sidebarWidget: {
          title: "AI Credits",
          usedLabel: "Used this month",
          usedValue: "45,789",
          percentage: 75,
          percentageLabel: "75% of monthly allocation",
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch sidebar" });
    }
  });

  // Admin: organizations (in-memory; replace with DB in production)
  type OrgRecord = { id: number; name: string; customerIds: number[]; archived: boolean; settings?: Record<string, unknown> };
  const orgStore: OrgRecord[] = [];
  let orgNextId = 1;

  app.get("/api/v1/admin/organizations", async (_req, res) => {
    try {
      res.json(orgStore);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organizations" });
    }
  });

  app.get("/api/v1/admin/organizations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = orgStore.find((o) => o.id === id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch organization" });
    }
  });

  app.post("/api/v1/admin/organizations", async (req, res) => {
    try {
      const { name } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name is required" });
      }
      const org: OrgRecord = { id: orgNextId++, name: name.trim(), customerIds: [], archived: false };
      orgStore.push(org);
      res.status(201).json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to create organization" });
    }
  });

  app.patch("/api/v1/admin/organizations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = orgStore.find((o) => o.id === id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const { name, customerIds, archived, settings } = req.body || {};
      if (name !== undefined && typeof name === "string") org.name = name.trim();
      if (customerIds !== undefined && Array.isArray(customerIds)) org.customerIds = customerIds.map((n: unknown) => Number(n)).filter((n) => !Number.isNaN(n));
      if (archived !== undefined) org.archived = Boolean(archived);
      if (settings !== undefined && settings !== null && typeof settings === "object") org.settings = settings as Record<string, unknown>;
      res.json(org);
    } catch (error) {
      res.status(500).json({ message: "Failed to update organization" });
    }
  });

  app.delete("/api/v1/admin/organizations/:id", async (req, res) => {
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

  // Current user context: return organizationId so customers/collaborators get their org's branding.
  // When using RFP-AI Python backend, implement GET /api/v1/me to return { organizationId } for the authenticated user.
  app.get("/api/v1/me", async (req, res) => {
    try {
      const userIdHeader = req.headers["x-user-id"];
      const userId = userIdHeader != null ? parseInt(String(userIdHeader), 10) : undefined;
      if (userId != null && !Number.isNaN(userId)) {
        const org = orgStore.find((o) => o.customerIds?.includes(userId));
        if (org) return res.json({ organizationId: org.id });
      }
      res.json({ organizationId: null });
    } catch (error) {
      res.status(500).json({ organizationId: null });
    }
  });

  // Branding upload for org: accept base64 data URL, return URL (stub stores in org.settings)
  app.post("/api/v1/admin/organizations/:id/branding/upload", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const org = orgStore.find((o) => o.id === id);
      if (!org) return res.status(404).json({ message: "Organization not found" });
      const body = req.body as { type?: string; data?: string };
      const type = body?.type === "favicon" ? "favicon" : "logo";
      const data = typeof body?.data === "string" ? body.data : "";
      if (!data || !data.startsWith("data:")) {
        return res.status(400).json({ message: "data (data URL) is required" });
      }
      if (!org.settings) org.settings = {};
      if (type === "logo") (org.settings as Record<string, string>).primaryLogoUrl = data;
      else (org.settings as Record<string, string>).faviconUrl = data;
      res.json({ url: data });
    } catch (error) {
      res.status(500).json({ message: "Failed to upload branding asset" });
    }
  });

  // Admin: settings (stub + in-memory for email, storage, API keys, backups)
  type EmailServerConfig = { host: string; port: number; user: string; from: string; secure: boolean };
  type StorageConfig = { provider: string; bucket?: string; region?: string; endpoint?: string };
  type ApiKeyRecord = { id: string; name: string; lastUsedAt?: string; createdAt: string };
  type BackupRecord = { id: string; createdAt: string; size?: string; status: string };
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
      { name: "Pink", primary: "#db2777", secondary: "#ec4899" },
    ],
    notificationSettings: [
      { id: 1, name: "Proposal updates", description: "When a proposal status changes", email: true, push: true },
      { id: 2, name: "New comments", description: "When someone comments", email: true, push: false },
    ],
    emailServer: { host: "", port: 587, user: "", from: "", secure: true } as EmailServerConfig,
    storage: { provider: "local", bucket: "", region: "", endpoint: "" } as StorageConfig,
    apiKeys: [] as ApiKeyRecord[],
    backups: [] as BackupRecord[],
  };
  let apiKeyNextId = 1;
  let backupNextId = 1;

  app.get("/api/v1/admin/settings", async (_req, res) => {
    try {
      res.json({
        defaultTheme: "Default",
        ...settingsStore,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch("/api/v1/admin/settings", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.emailServer && typeof body.emailServer === "object") {
        const e = body.emailServer;
        if (e.host !== undefined) settingsStore.emailServer.host = String(e.host);
        if (e.port !== undefined) settingsStore.emailServer.port = Number(e.port) || 587;
        if (e.user !== undefined) settingsStore.emailServer.user = String(e.user);
        if (e.from !== undefined) settingsStore.emailServer.from = String(e.from);
        if (e.secure !== undefined) settingsStore.emailServer.secure = Boolean(e.secure);
      }
      if (body.storage && typeof body.storage === "object") {
        const s = body.storage;
        if (s.provider !== undefined) settingsStore.storage.provider = String(s.provider);
        if (s.bucket !== undefined) settingsStore.storage.bucket = String(s.bucket);
        if (s.region !== undefined) settingsStore.storage.region = String(s.region);
        if (s.endpoint !== undefined) settingsStore.storage.endpoint = String(s.endpoint);
      }
      if (body.apiKeys && typeof body.apiKeys === "object") {
        if (body.apiKeys.create && body.apiKeys.create.name) {
          const created = { id: `key_${apiKeyNextId++}`, name: body.apiKeys.create.name, createdAt: new Date().toISOString() };
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

  app.post("/api/v1/admin/settings/backup", async (_req, res) => {
    try {
      const backup: BackupRecord = { id: `backup_${backupNextId++}`, createdAt: new Date().toISOString(), size: "—", status: "completed" };
      settingsStore.backups.unshift(backup);
      res.json(backup);
    } catch (error) {
      res.status(500).json({ message: "Failed to create backup" });
    }
  });

  // Public/authenticated branding for app-wide use: returns org branding + color presets
  app.get("/api/v1/branding", async (req, res) => {
    try {
      const organizationId = req.query.organizationId != null ? parseInt(String(req.query.organizationId), 10) : null;
      let org: OrgRecord | undefined;
      if (organizationId != null && !Number.isNaN(organizationId)) {
        org = orgStore.find((o) => o.id === organizationId);
      }
      if (!org && orgStore.length > 0) org = orgStore[0];
      const settings = (org?.settings || {}) as Record<string, string>;
      const primaryLogoUrl = settings.primaryLogoUrl ?? null;
      const faviconUrl = settings.faviconUrl ?? null;
      const colorTheme = settings.colorTheme ?? (settingsStore.colorPresets?.[0]?.name ?? "Default");
      res.json({
        primaryLogoUrl,
        faviconUrl,
        colorTheme,
        colorPresets: settingsStore.colorPresets ?? [],
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch branding" });
    }
  });

  // Admin: permissions (stub for options/permissions)
  const permissionDefinitions = [
    { key: "can_create_rfp", label: "Create RFP", description: "Create new RFP proposals", scopes: ["read", "write"] },
    { key: "can_edit_proposal", label: "Edit proposal", description: "Edit proposal content", scopes: ["read", "write"] },
    { key: "can_delete_proposal", label: "Delete proposal", description: "Delete proposals", scopes: ["read", "write", "delete"] },
    { key: "can_invite_collaborators", label: "Invite collaborators", description: "Add collaborators to proposals", scopes: ["read", "write"] },
    { key: "can_use_ai", label: "Use AI generation", description: "Use AI to generate content", scopes: ["read", "write"] },
    { key: "can_manage_content", label: "Manage content library", description: "Upload and manage content", scopes: ["read", "write", "delete"] },
    { key: "can_view_analytics", label: "View analytics", description: "Access analytics and reports", scopes: ["read"] },
    { key: "can_manage_users", label: "Manage users", description: "Invite and manage users", scopes: ["read", "write", "delete"] },
  ];

  app.get("/api/v1/admin/permissions", async (_req, res) => {
    try {
      res.json({
        permissions: permissionDefinitions.map((p) => p.key),
        defaultRolePermissions: {
          Admin: permissionDefinitions.map((p) => p.key),
          User: ["can_create_rfp", "can_edit_proposal", "can_invite_collaborators", "can_use_ai", "can_view_analytics"],
          Collaborator: ["can_edit_proposal", "can_use_ai"],
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch permissions" });
    }
  });

  // Admin: roles (built-in + custom with granular permissions)
  type RoleRecord = { id: string; name: string; isBuiltIn: boolean; permissions: Record<string, string[]> };
  const rolesStore: RoleRecord[] = [
    { id: "admin", name: "Admin", isBuiltIn: true, permissions: Object.fromEntries(permissionDefinitions.map((p) => [p.key, p.scopes ?? ["read", "write", "delete"]])) },
    { id: "customer", name: "Customer", isBuiltIn: true, permissions: { can_create_rfp: ["read", "write"], can_edit_proposal: ["read", "write"], can_invite_collaborators: ["read", "write"], can_use_ai: ["read", "write"], can_view_analytics: ["read"] } },
    { id: "collaborator", name: "Collaborator", isBuiltIn: true, permissions: { can_edit_proposal: ["read", "write"], can_use_ai: ["read", "write"] } },
  ];
  let roleNextId = 1;

  app.get("/api/v1/admin/roles", async (_req, res) => {
    try {
      res.json({ roles: rolesStore, permissionDefinitions });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/v1/admin/roles", async (req, res) => {
    try {
      const { name, permissions } = req.body || {};
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ message: "name is required" });
      }
      const id = `custom_${roleNextId++}`;
      const role: RoleRecord = { id, name: name.trim(), isBuiltIn: false, permissions: permissions && typeof permissions === "object" ? permissions as Record<string, string[]> : {} };
      rolesStore.push(role);
      res.status(201).json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to create role" });
    }
  });

  app.patch("/api/v1/admin/roles/:id", async (req, res) => {
    try {
      const role = rolesStore.find((r) => r.id === req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      const { name, permissions } = req.body || {};
      if (!role.isBuiltIn && name !== undefined && typeof name === "string") role.name = name.trim();
      if (permissions !== undefined && permissions !== null && typeof permissions === "object") role.permissions = permissions as Record<string, string[]>;
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  app.delete("/api/v1/admin/roles/:id", async (req, res) => {
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

  // Admin: RFP templates (global templates, question sets, mandatory sections, lock)
  type RfpTemplateRecord = {
    id: string;
    name: string;
    description: string;
    mandatorySections: string[];
    questionSet: { question: string; order: number }[];
    locked: boolean;
    createdAt: string;
    updatedAt: string;
  };
  const rfpTemplatesStore: RfpTemplateRecord[] = [];
  let rfpTemplateNextId = 1;

  app.get("/api/v1/admin/rfp-templates", async (_req, res) => {
    try {
      res.json({ templates: rfpTemplatesStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch RFP templates" });
    }
  });

  app.post("/api/v1/admin/rfp-templates", async (req, res) => {
    try {
      const body = req.body || {};
      const name = body.name && typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return res.status(400).json({ message: "name is required" });
      const now = new Date().toISOString();
      const template: RfpTemplateRecord = {
        id: `tpl_${rfpTemplateNextId++}`,
        name,
        description: typeof body.description === "string" ? body.description : "",
        mandatorySections: Array.isArray(body.mandatorySections) ? body.mandatorySections.filter((e: unknown) => typeof e === "string") : [],
        questionSet: Array.isArray(body.questionSet) ? body.questionSet.map((q: { question?: string; order?: number }, i: number) => ({ question: typeof q.question === "string" ? q.question : "", order: typeof q.order === "number" ? q.order : i })) : [],
        locked: false,
        createdAt: now,
        updatedAt: now,
      };
      rfpTemplatesStore.push(template);
      res.status(201).json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to create RFP template" });
    }
  });

  app.patch("/api/v1/admin/rfp-templates/:id", async (req, res) => {
    try {
      const template = rfpTemplatesStore.find((t) => t.id === req.params.id);
      if (!template) return res.status(404).json({ message: "RFP template not found" });
      const body = req.body || {};
      const now = new Date().toISOString();
      if (body.locked !== undefined) template.locked = Boolean(body.locked);
      if (body.name !== undefined && typeof body.name === "string" && !template.locked) template.name = body.name.trim();
      if (body.description !== undefined && typeof body.description === "string" && !template.locked) template.description = body.description;
      if (body.mandatorySections !== undefined && Array.isArray(body.mandatorySections) && !template.locked) template.mandatorySections = body.mandatorySections.filter((e: unknown) => typeof e === "string");
      if (body.questionSet !== undefined && Array.isArray(body.questionSet) && !template.locked) template.questionSet = body.questionSet.map((q: { question?: string; order?: number }, i: number) => ({ question: typeof q.question === "string" ? q.question : "", order: typeof q.order === "number" ? q.order : i }));
      template.updatedAt = now;
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to update RFP template" });
    }
  });

  app.delete("/api/v1/admin/rfp-templates/:id", async (req, res) => {
    try {
      const idx = rfpTemplatesStore.findIndex((t) => t.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: "RFP template not found" });
      const t = rfpTemplatesStore[idx];
      if (t.locked) return res.status(400).json({ message: "Unlock template before deleting" });
      rfpTemplatesStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete RFP template" });
    }
  });

  // Admin: knowledge base (embeddings, rebuild index, version control)
  type KbDoc = { id: string; title: string; embeddingStatus: string; chunkCount?: number; lastIndexedAt?: string };
  type KbVersion = { id: string; createdAt: string; documentCount?: number; size?: string };
  const kbDocumentsStore: KbDoc[] = [
    { id: "kb_doc_1", title: "Product Overview", embeddingStatus: "indexed", chunkCount: 12, lastIndexedAt: new Date().toISOString() },
    { id: "kb_doc_2", title: "Security & Compliance", embeddingStatus: "indexed", chunkCount: 8, lastIndexedAt: new Date().toISOString() },
  ];
  let kbLastRebuildAt: string | null = null;
  const kbVersionsStore: KbVersion[] = [];
  let kbVersionNextId = 1;

  app.get("/api/v1/admin/knowledge-base", async (_req, res) => {
    try {
      res.json({
        documents: kbDocumentsStore,
        lastRebuildAt: kbLastRebuildAt ?? undefined,
        indexVersion: kbLastRebuildAt ? `v-${kbVersionNextId - 1}` : undefined,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch knowledge base" });
    }
  });

  app.post("/api/v1/admin/knowledge-base/rebuild", async (_req, res) => {
    try {
      const now = new Date().toISOString();
      kbLastRebuildAt = now;
      const version: KbVersion = { id: `kb_${kbVersionNextId++}`, createdAt: now, documentCount: kbDocumentsStore.length, size: "—" };
      kbVersionsStore.unshift(version);
      res.json({ success: true, rebuiltAt: now });
    } catch (error) {
      res.status(500).json({ message: "Failed to rebuild index" });
    }
  });

  app.get("/api/v1/admin/knowledge-base/versions", async (_req, res) => {
    try {
      res.json({ versions: kbVersionsStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch versions" });
    }
  });

  app.post("/api/v1/admin/knowledge-base/versions/:id/restore", async (req, res) => {
    try {
      const version = kbVersionsStore.find((v) => v.id === req.params.id);
      if (!version) return res.status(404).json({ message: "Version not found" });
      res.json({ success: true, restored: version.id });
    } catch (error) {
      res.status(500).json({ message: "Failed to restore version" });
    }
  });

  // Admin: subscription & billing (plans, assign, invoices, API quota)
  type BillingPlanRecord = { id: string; name: string; price: number; interval: string; creditsIncluded?: number; apiQuotaPerMonth?: number; features?: string[] };
  const billingPlansStore: BillingPlanRecord[] = [
    { id: "plan_pro", name: "Professional", price: 99, interval: "month", creditsIncluded: 10000, apiQuotaPerMonth: 5000, features: ["AI generation", "Unlimited proposals"] },
    { id: "plan_enterprise", name: "Enterprise", price: 299, interval: "month", creditsIncluded: 50000, apiQuotaPerMonth: 50000, features: ["Everything in Pro", "SSO", "Priority support"] },
  ];
  let billingPlanNextId = 1;
  const userPlanAssignments: Record<number, string> = {};
  const apiQuotaConfig = { limitPerMonth: 10000, usedThisMonth: 0, windowStart: new Date().toISOString().split("T")[0] };
  const invoicesStore: { id: string; customerId?: number; customerEmail?: string; planName: string; amount: number; currency: string; status: string; dueDate: string; paidAt?: string }[] = [];

  app.get("/api/v1/admin/billing/plans", async (_req, res) => {
    try {
      res.json({ plans: billingPlansStore });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.post("/api/v1/admin/billing/plans", async (req, res) => {
    try {
      const body = req.body || {};
      const name = body.name && typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return res.status(400).json({ message: "name is required" });
      const plan: BillingPlanRecord = {
        id: `plan_${billingPlanNextId++}`,
        name,
        price: Number(body.price) || 0,
        interval: body.interval === "year" ? "year" : "month",
        creditsIncluded: body.creditsIncluded != null ? Number(body.creditsIncluded) : undefined,
        apiQuotaPerMonth: body.apiQuotaPerMonth != null ? Number(body.apiQuotaPerMonth) : undefined,
        features: Array.isArray(body.features) ? body.features.filter((e: unknown) => typeof e === "string") : undefined,
      };
      billingPlansStore.push(plan);
      res.status(201).json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  app.patch("/api/v1/admin/billing/plans/:id", async (req, res) => {
    try {
      const plan = billingPlansStore.find((p) => p.id === req.params.id);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      const body = req.body || {};
      if (body.name !== undefined && typeof body.name === "string") plan.name = body.name.trim();
      if (body.price !== undefined) plan.price = Number(body.price);
      if (body.interval !== undefined) plan.interval = body.interval === "year" ? "year" : "month";
      if (body.creditsIncluded !== undefined) plan.creditsIncluded = Number(body.creditsIncluded);
      if (body.apiQuotaPerMonth !== undefined) plan.apiQuotaPerMonth = Number(body.apiQuotaPerMonth);
      if (body.features !== undefined && Array.isArray(body.features)) plan.features = body.features.filter((e: unknown) => typeof e === "string");
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.delete("/api/v1/admin/billing/plans/:id", async (req, res) => {
    try {
      const idx = billingPlansStore.findIndex((p) => p.id === req.params.id);
      if (idx === -1) return res.status(404).json({ message: "Plan not found" });
      billingPlansStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete plan" });
    }
  });

  app.post("/api/v1/admin/billing/assign", async (req, res) => {
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

  app.get("/api/v1/admin/billing/invoices", async (_req, res) => {
    try {
      const list = invoicesStore.length > 0 ? invoicesStore : [{ id: "inv_1", planName: "Professional", amount: 99, currency: "USD", status: "paid", dueDate: new Date().toISOString().split("T")[0], paidAt: new Date().toISOString() }];
      res.json({ invoices: list });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  app.get("/api/v1/admin/billing/api-quota", async (_req, res) => {
    try {
      res.json(apiQuotaConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch API quota" });
    }
  });

  app.patch("/api/v1/admin/billing/api-quota", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.limitPerMonth !== undefined) apiQuotaConfig.limitPerMonth = Number(body.limitPerMonth);
      res.json(apiQuotaConfig);
    } catch (error) {
      res.status(500).json({ message: "Failed to update API quota" });
    }
  });

  // Admin: AI config (stub; in-memory for local dev when not using external backend)
  type AIConfigFeatures = { autoSuggest?: boolean; contentFiltering?: boolean; allowBulkGenerate?: boolean; allowToneSelection?: boolean };
  type AIConfigStore = {
    defaultModel?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
    systemPromptDefault?: string;
    features?: AIConfigFeatures;
  };
  const aiConfigStore: AIConfigStore = {
    defaultModel: "gpt-4o",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    systemPromptDefault: "",
    features: { autoSuggest: true, contentFiltering: true, allowBulkGenerate: true, allowToneSelection: true },
  };
  app.get("/api/v1/admin/ai-config", async (_req, res) => {
    try {
      res.json({
        defaultModel: aiConfigStore.defaultModel,
        defaultTemperature: aiConfigStore.defaultTemperature,
        defaultMaxTokens: aiConfigStore.defaultMaxTokens,
        systemPromptDefault: aiConfigStore.systemPromptDefault ?? "",
        creditsUsed: "0",
        aiModels: [
          { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI", speed: "Fast", quality: "High", cost: "$$" },
          { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI", speed: "Faster", quality: "Good", cost: "$" },
        ],
        qualityMetrics: [
          { label: "Relevance", value: 92, target: 90 },
          { label: "Brand Voice Match", value: 78, target: 85 },
        ],
        features: aiConfigStore.features,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI config" });
    }
  });
  app.patch("/api/v1/admin/ai-config", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.defaultModel !== undefined) aiConfigStore.defaultModel = String(body.defaultModel);
      if (body.defaultTemperature !== undefined) aiConfigStore.defaultTemperature = Number(body.defaultTemperature);
      if (body.defaultMaxTokens !== undefined) aiConfigStore.defaultMaxTokens = Number(body.defaultMaxTokens);
      if (body.systemPromptDefault !== undefined) aiConfigStore.systemPromptDefault = String(body.systemPromptDefault);
      if (body.features !== undefined && typeof body.features === "object") {
        const f = body.features as Record<string, unknown>;
        aiConfigStore.features = {
          autoSuggest: f.autoSuggest !== undefined ? Boolean(f.autoSuggest) : aiConfigStore.features?.autoSuggest,
          contentFiltering: f.contentFiltering !== undefined ? Boolean(f.contentFiltering) : aiConfigStore.features?.contentFiltering,
          allowBulkGenerate: f.allowBulkGenerate !== undefined ? Boolean(f.allowBulkGenerate) : aiConfigStore.features?.allowBulkGenerate,
          allowToneSelection: f.allowToneSelection !== undefined ? Boolean(f.allowToneSelection) : aiConfigStore.features?.allowToneSelection,
        };
      }
      res.json({
        defaultModel: aiConfigStore.defaultModel,
        defaultTemperature: aiConfigStore.defaultTemperature,
        defaultMaxTokens: aiConfigStore.defaultMaxTokens,
        systemPromptDefault: aiConfigStore.systemPromptDefault,
        features: aiConfigStore.features,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update AI config" });
    }
  });

  // Admin: security (stub + in-memory config for session, IP, 2FA)
  type SecurityConfig = {
    sessionIdleMinutes?: number;
    sessionMaxDurationMinutes?: number;
    sessionRememberMeDays?: number;
    ipRestrictionEnabled?: boolean;
    ipAllowlist?: string[];
    ipDenylist?: string[];
    requireTwoFactorForAllUsers?: boolean;
  };
  const securityConfig: SecurityConfig = {
    sessionIdleMinutes: 30,
    sessionMaxDurationMinutes: 480,
    sessionRememberMeDays: 14,
    ipRestrictionEnabled: false,
    ipAllowlist: [],
    ipDenylist: [],
    requireTwoFactorForAllUsers: false,
  };

  app.get("/api/v1/admin/security", async (_req, res) => {
    try {
      const payload = {
        defaultPasswordLength: "12",
        defaultSessionDuration: "90",
        securityAlerts: [{ id: 1, type: "warning", message: "3 users without 2FA", action: "Review", time: "2 hours ago" }],
        recentActivity: [
          { id: 1, action: "Login", user: "admin@example.com", ip: "192.168.1.1", location: "Office", time: "10 min ago", status: "success" },
        ],
        securitySettings: [
          { id: 1, name: "Two-factor authentication", description: "Require 2FA for all users", enabled: true },
          { id: 2, name: "Single sign-on", description: "Allow SSO login", enabled: false },
        ],
        complianceCertifications: [
          { name: "SOC 2", status: "Compliant", date: "2024-01", icon: "Shield" },
          { name: "GDPR", status: "Certified", date: "2024-01", icon: "Lock" },
        ],
        ...securityConfig,
      };
      res.json(payload);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch security" });
    }
  });

  app.patch("/api/v1/admin/security", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.sessionIdleMinutes !== undefined) securityConfig.sessionIdleMinutes = Number(body.sessionIdleMinutes);
      if (body.sessionMaxDurationMinutes !== undefined) securityConfig.sessionMaxDurationMinutes = Number(body.sessionMaxDurationMinutes);
      if (body.sessionRememberMeDays !== undefined) securityConfig.sessionRememberMeDays = Number(body.sessionRememberMeDays);
      if (body.ipRestrictionEnabled !== undefined) securityConfig.ipRestrictionEnabled = Boolean(body.ipRestrictionEnabled);
      if (Array.isArray(body.ipAllowlist)) securityConfig.ipAllowlist = body.ipAllowlist.filter((e: unknown) => typeof e === "string");
      if (Array.isArray(body.ipDenylist)) securityConfig.ipDenylist = body.ipDenylist.filter((e: unknown) => typeof e === "string");
      if (body.requireTwoFactorForAllUsers !== undefined) securityConfig.requireTwoFactorForAllUsers = Boolean(body.requireTwoFactorForAllUsers);
      const payload = {
        defaultPasswordLength: "12",
        defaultSessionDuration: "90",
        securityAlerts: [],
        recentActivity: [],
        securitySettings: [],
        complianceCertifications: [],
        ...securityConfig,
      };
      res.json(payload);
    } catch (error) {
      res.status(500).json({ message: "Failed to update security" });
    }
  });

  // Admin: audit logs (stub – returns sample data; filter by type/date in real backend)
  app.get("/api/v1/admin/audit-logs", async (req, res) => {
    try {
      const type = (req.query.type as string) || "login";
      const now = new Date();
      const ts = (d: Date) => d.toISOString();
      const sample: { id: string; type: string; action: string; user: string; ip?: string; location?: string; resource?: string; details?: string; timestamp: string; status: string }[] = [];
      const base = [
        { user: "admin@example.com", ip: "192.168.1.1", location: "San Francisco, US" },
        { user: "jane@example.com", ip: "10.0.0.5", location: "New York, US" },
        { user: "john@example.com", ip: "172.16.0.2", location: "London, UK" },
      ];
      if (type === "login") {
        sample.push(
          { id: "1", type: "login", action: "Login successful", ...base[0], timestamp: ts(now), status: "success" },
          { id: "2", type: "login", action: "Login successful", ...base[1], timestamp: ts(new Date(now.getTime() - 3600000)), status: "success" },
          { id: "3", type: "login", action: "Failed login attempt", ...base[2], timestamp: ts(new Date(now.getTime() - 7200000)), status: "failure" }
        );
      } else if (type === "data_access") {
        sample.push(
          { id: "4", type: "data_access", action: "Viewed proposal", ...base[0], resource: "Proposal #101", timestamp: ts(now), status: "success" },
          { id: "5", type: "data_access", action: "Exported proposal PDF", ...base[1], resource: "Proposal #102", timestamp: ts(new Date(now.getTime() - 1800000)), status: "success" }
        );
      } else if (type === "file") {
        sample.push(
          { id: "6", type: "file", action: "Uploaded document", ...base[0], resource: "RFP-spec.pdf", details: "Content Library", timestamp: ts(now), status: "success" },
          { id: "7", type: "file", action: "Downloaded proposal", ...base[1], resource: "Proposal #101", timestamp: ts(new Date(now.getTime() - 3600000)), status: "success" }
        );
      } else if (type === "ai_usage") {
        sample.push(
          { id: "8", type: "ai_usage", action: "AI generation", ...base[0], resource: "Proposal #101", details: "GPT-4, ~1.2k tokens", timestamp: ts(now), status: "success" },
          { id: "9", type: "ai_usage", action: "AI generation", ...base[2], resource: "Proposal #103", details: "GPT-4, ~800 tokens", timestamp: ts(new Date(now.getTime() - 5400000)), status: "success" }
        );
      }
      res.json({ entries: sample, total: sample.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
