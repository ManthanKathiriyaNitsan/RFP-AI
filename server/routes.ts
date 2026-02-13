import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { ZodError } from "zod";
import Razorpay from "razorpay";
import Stripe from "stripe";
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

function getAdminUserId(req: Request): number | undefined {
  const fromUser = (req as any).user?.id;
  if (fromUser != null && Number.isInteger(fromUser)) return Number(fromUser);
  const header = req.headers["x-user-id"];
  if (header != null) {
    const n = parseInt(String(header), 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
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
      let users = await storage.getAllUsers();
      const createdBy = req.query.created_by;
      if (createdBy != null) {
        const createdById = parseInt(String(createdBy), 10);
        if (Number.isFinite(createdById)) {
          users = users.filter((u) => (u as { createdByUserId?: number | null }).createdByUserId === createdById);
        }
      }
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
      const adminId = req.query.adminId != null ? parseInt(req.query.adminId as string) : undefined;
      
      let proposals;
      if (userRole === "super_admin" && adminId != null && !Number.isNaN(adminId)) {
        // Super admin viewing a specific admin's proposals (proposals owned by that admin)
        proposals = await storage.getProposalsByUserId(adminId);
      } else if (userRole === "admin" || userRole === "super_admin") {
        // Admin sees all; super_admin with no adminId sees all (e.g. for sidebar count)
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
      const adminId = req.query.adminId != null ? parseInt(req.query.adminId as string) : undefined;
      let proposals;
      if (userRole === "super_admin" && adminId != null && !Number.isNaN(adminId)) {
        proposals = await storage.getProposalsByUserId(adminId);
      } else if (userRole === "admin" || userRole === "super_admin") {
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
      const previousStatus = access.proposal.status;
      const proposal = await storage.updateProposal(id, updates);
      const newStatus = (updates as { status?: string }).status;
      if (newStatus != null && newStatus !== previousStatus) {
        const link = `/rfp/${id}/questions`;
        const recipientIds = await getProposalNotificationRecipientIds(id, callerUserId);
        recipientIds.forEach((uid) =>
          addNotification(
            uid,
            "Proposal status updated",
            `Status changed to ${newStatus}.`,
            "status_change",
            link
          )
        );
      }
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

  const CREDITS_PER_GENERATION = 1;

  /** Resolve the user ID of the caller (for credit deduction and notifications). Uses req.user, x-user-id, body.userId, then proposal.ownerId so collaborator/customer are charged correctly. */
  function getGenerateCallerUserId(
    req: import("express").Request,
    proposal: { ownerId?: number },
    body: { userId?: number }
  ): number | null {
    const fromUser = (req as any).user?.id;
    if (fromUser != null && Number.isInteger(fromUser)) return Number(fromUser);
    const header = req.headers["x-user-id"];
    if (header != null) {
      const n = parseInt(String(header), 10);
      if (!Number.isNaN(n)) return n;
    }
    if (body?.userId != null && Number.isInteger(Number(body.userId))) return Number(body.userId);
    if (proposal.ownerId != null && Number.isInteger(proposal.ownerId)) return proposal.ownerId;
    return null;
  }

  function buildGeneratedProposalContent(
    proposal: { title: string; description?: string | null; industry?: string | null; timeline?: string | null; budgetRange?: string | null },
    body: { requirements?: string[] | string; aiContext?: string; clientName?: string; clientContact?: string; clientEmail?: string }
  ) {
    const requirementsList = body.requirements
      ? (typeof body.requirements === "string" ? body.requirements.split(",").map((r: string) => r.trim()).filter(Boolean) : body.requirements)
      : [];
    const { aiContext, clientName, clientContact, clientEmail } = body;
    return {
      executiveSummary: `This proposal outlines our comprehensive solution for ${proposal.title}. Based on the requirements and industry standards, we have developed a tailored approach that addresses all key aspects of your project.${aiContext ? `\n\nAdditional context: ${aiContext}` : ""}`,
      introduction: `We are pleased to submit this proposal for ${proposal.title}. Our team has carefully reviewed your requirements and is excited to present a solution that aligns with your objectives and budget considerations.${clientName ? ` We look forward to partnering with ${clientName} on this initiative.` : ""}`,
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
      requirements: requirementsList.length > 0 ? requirementsList : ["Comprehensive analysis and planning phase", "Agile development methodology", "Quality assurance and testing protocols"],
      solutionApproach: `Our approach combines industry best practices with innovative solutions to deliver exceptional results. We will leverage our expertise in ${proposal.industry || "your industry"} to ensure successful project delivery.${aiContext ? `\n\nSpecial considerations: ${aiContext}` : ""}`,
      technicalSpecifications: ["Comprehensive analysis and planning phase", "Agile development methodology", "Quality assurance and testing protocols", "Deployment and integration support", "Ongoing maintenance and support services"],
      deliverables: ["Complete project documentation", "Source code and technical assets", "Training materials and sessions", "Post-deployment support plan", "Regular progress reports and updates"],
      timeline: { phase1: "Planning and Analysis (Weeks 1-2)", phase2: "Design and Development (Weeks 3-8)", phase3: "Testing and Quality Assurance (Weeks 9-10)", phase4: "Deployment and Training (Weeks 11-12)" },
      team: { projectManager: "Dedicated project manager for coordination", technicalLead: "Experienced technical lead for architecture", developers: "Skilled development team", qa: "Quality assurance specialists" },
      pricing: { base: proposal.budgetRange || "Custom pricing available", paymentTerms: "Milestone-based payments", additionalServices: "Available upon request" },
      nextSteps: ["Schedule a detailed discussion meeting", "Review and refine proposal details", "Finalize contract terms", "Begin project kickoff"],
      generatedAt: new Date().toISOString(),
    };
  }

  app.post("/api/proposals/:id/generate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const proposal = await storage.getProposal(id);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });

      const body = req.body || {};
      const userId = getGenerateCallerUserId(req, proposal as { ownerId?: number }, body);
      if (userId == null) {
        return res.status(401).json({ message: "Authentication required to generate" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const currentCredits = user.credits ?? 0;
      if (currentCredits < CREDITS_PER_GENERATION) {
        return res.status(402).json({ message: "Insufficient credits to generate" });
      }

      const generatedContent = buildGeneratedProposalContent(proposal, req.body || {});
      const newBalance = currentCredits - CREDITS_PER_GENERATION;
      await storage.updateUser(userId, { credits: newBalance });
      await storage.createCreditTransaction({
        userId,
        amount: -CREDITS_PER_GENERATION,
        type: "usage",
        description: `AI generation: proposal ${id}`,
      });

      await storage.updateProposal(id, { content: generatedContent, status: "in_progress" });

      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || `User ${userId}`;
      await addLowCreditAlertAfterGeneration(userId, newBalance, userName);

      const updatedProposal = await storage.getProposal(id);
      res.json({ ...updatedProposal, creditsUsed: CREDITS_PER_GENERATION, creditsRemaining: newBalance });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate proposal content" });
    }
  });

  app.post("/api/v1/ai/proposals/:id/generate", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const proposal = await storage.getProposal(id);
      if (!proposal) return res.status(404).json({ message: "Proposal not found" });

      const body = req.body || {};
      const userId = getGenerateCallerUserId(req, proposal as { ownerId?: number }, body);
      if (userId == null) {
        return res.status(401).json({ message: "Authentication required to generate" });
      }
      const user = await storage.getUser(userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const currentCredits = user.credits ?? 0;
      if (currentCredits < CREDITS_PER_GENERATION) {
        return res.status(402).json({ message: "Insufficient credits to generate" });
      }

      const generatedContent = buildGeneratedProposalContent(proposal, req.body || {});
      const newBalance = currentCredits - CREDITS_PER_GENERATION;
      await storage.updateUser(userId, { credits: newBalance });
      await storage.createCreditTransaction({
        userId,
        amount: -CREDITS_PER_GENERATION,
        type: "usage",
        description: `AI generation: proposal ${id}`,
      });

      await storage.updateProposal(id, { content: generatedContent, status: "in_progress" });

      const userName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || `User ${userId}`;
      await addLowCreditAlertAfterGeneration(userId, newBalance, userName);

      const fullDocument = [
        generatedContent.executiveSummary,
        generatedContent.introduction,
        typeof generatedContent.solutionApproach === "string" ? generatedContent.solutionApproach : "",
      ].filter(Boolean).join("\n\n");
      res.json({ content: generatedContent, fullDocument, creditsUsed: CREDITS_PER_GENERATION, creditsRemaining: newBalance });
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
      const inviterUserId = (req as any).user?.id ?? undefined;
      const link = `/rfp/${proposalId}/questions`;
      await addNotificationToProposalParticipants(
        proposalId,
        inviterUserId,
        "New collaborator assigned",
        "A collaborator was added to this proposal.",
        "collaboration_invite",
        link
      );
      addNotification(
        Number(userId),
        "You were assigned to a proposal",
        proposal ? `${proposal.title}` : "You were added as a collaborator.",
        "collaboration_invite",
        link
      );
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

  /** Get all user IDs with role admin or super_admin (for credit alerts). */
  async function getAdminUserIds(): Promise<number[]> {
    const users = await storage.getAllUsers();
    return users
      .filter((u) => { const r = (u.role || "").toLowerCase(); return r === "admin" || r === "super_admin"; })
      .map((u) => u.id);
  }

  /** Credit levels at which we send a low-credit alert (aligned with frontend CREDIT_ALERT_THRESHOLDS). */
  const LOW_CREDIT_THRESHOLDS = [100, 50, 25, 20, 15, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1] as const;

  /** Smallest threshold >= balance, or null if balance > 100. */
  function getLowCreditThresholdForBalance(balance: number): number | null {
    const ascending = [...LOW_CREDIT_THRESHOLDS].sort((a, b) => a - b);
    for (const t of ascending) {
      if (t >= balance) return t;
    }
    return null;
  }

  /** When a user's credit balance is low (at or below 100, 50, 25, 20, 15, 10, 9, 8, …), add one alert notification for that level (user + admins). */
  async function addLowCreditNotificationsIfNeeded(
    userId: number,
    newBalance: number,
    displayName?: string
  ): Promise<void> {
    if (newBalance < 0) return;
    const threshold = getLowCreditThresholdForBalance(newBalance);
    if (threshold == null) return;
    const name = displayName || `User ${userId}`;
    const creditsLink = "/admin/credits";
    const label = threshold <= 10 ? `${threshold} or fewer` : `low (${threshold} or fewer)`;
    addNotification(
      userId,
      "Credits alert",
      `You have ${newBalance} credit(s) left (at ${threshold} or below). Consider topping up or contacting your admin.`,
      "credit_alert",
      creditsLink
    );
    const adminIds = await getAdminUserIds();
    adminIds.forEach((adminId) => {
      if (adminId === userId) return;
      addNotification(
        adminId,
        `User credits ${label}`,
        `${name} has ${newBalance} credit(s) left. Consider assigning more credits.`,
        "credit_alert",
        creditsLink
      );
    });
  }

  /** Call after every AI generation: when balance is at or below a threshold (100, 50, 25, 20, 15, 10, 9, 8, …), send one alert. For all roles (admin, customer, collaborator). */
  async function addLowCreditAlertAfterGeneration(
    userId: number,
    newBalance: number,
    displayName?: string
  ): Promise<void> {
    if (newBalance < 0) return;
    const threshold = getLowCreditThresholdForBalance(newBalance);
    if (threshold == null) return;
    const name = displayName || `User ${userId}`;
    const u = await storage.getUser(userId);
    const role = (u as { role?: string } | null)?.role?.toLowerCase() ?? "";
    const creditsLink =
      role === "admin" || role === "super_admin" ? "/admin/credits" : role === "collaborator" ? "/collaborator/credits-usage" : "/rfp-projects";

    const message = `You have ${newBalance} credit(s) left (at ${threshold} or below). Consider topping up soon.`;
    addNotification(userId, `Credits low – ${newBalance} left`, message, "credit_alert", creditsLink);

    const adminIds = await getAdminUserIds();
    adminIds.forEach((adminId) => {
      if (adminId === userId) return;
      addNotification(
        adminId,
        "User credits low – generation alert",
        `${name} has ${newBalance} credit(s) left. Alert sent after this generation.`,
        "credit_alert",
        "/admin/credits"
      );
    });
  }

  /** Collect owner + collaborators + admins/super_admins for a proposal (for broadcasting notifications). */
  async function getProposalNotificationRecipientIds(proposalId: number, excludeUserId?: number): Promise<number[]> {
    const proposal = await storage.getProposal(proposalId);
    if (!proposal) return [];
    const ids = new Set<number>();
    if (proposal.ownerId) ids.add(proposal.ownerId);
    const collabs = await storage.getCollaborationsByProposalId(proposalId);
    collabs.forEach((c) => { if (c.userId != null) ids.add(c.userId); });
    const allUsers = await storage.getAllUsers();
    allUsers.forEach((u) => {
      const r = (u.role || "").toLowerCase();
      if (r === "admin" || r === "super_admin") ids.add(u.id);
    });
    if (excludeUserId != null) ids.delete(excludeUserId);
    return Array.from(ids);
  }

  /** Notify all proposal participants (owner, collaborators, admins) except excludeUserId. */
  async function addNotificationToProposalParticipants(
    proposalId: number,
    excludeUserId: number | undefined,
    title: string,
    message: string,
    type: string,
    link?: string
  ) {
    const recipientIds = await getProposalNotificationRecipientIds(proposalId, excludeUserId);
    recipientIds.forEach((userId) => addNotification(userId, title, message, type, link));
  }

  async function ensureProposalExists(proposalId: number): Promise<boolean> {
    const p = await storage.getProposal(proposalId);
    return !!p;
  }

  // Content Library store (shared: proposal uploads and customer KB docs sync here; routes defined later)
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
    /** Who created this content (distinct from author/last-updater) */
    createdBy?: string;
    attachments?: ContentAttachment[];
  };
  const contentStore: ContentItemRecord[] = [];
  let contentNextId = 1;
  function formatContentDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // Customer knowledge base (in-memory; proposal uploads also add here so docs appear in KB)
  type CustomerKbDoc = { id: number; name: string; type: string; size: number; uploadedAt: string; tags: string[]; version: number; description: string };
  type CustomerKbVersion = { id: number; documentId: number; version: number; uploadedAt: string; uploadedBy: string; changes: string };
  const customerKbDocuments: CustomerKbDoc[] = [];
  const customerKbVersions: CustomerKbVersion[] = [];
  let customerKbDocNextId = 1;
  let customerKbVersionNextId = 1;

  // Proposal files (uploaded when creating/editing proposal; visible in all panels)
  type ProposalFileRecord = { id: number; proposalId: number; name: string; type: string; size: number; data: string; createdAt: string };
  const proposalFilesStore: ProposalFileRecord[] = [];
  let proposalFileNextId = 1;

  app.get("/api/v1/proposals/:id/files", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const list = proposalFilesStore
        .filter((f) => f.proposalId === proposalId)
        .map(({ id, proposalId: pid, name, type, size, createdAt }) => ({ id, proposalId: pid, name, type, size, createdAt }));
      res.json(list);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch proposal files" });
    }
  });

  app.post("/api/v1/proposals/:id/files", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const body = req.body || {};
      const files = Array.isArray(body.files) ? body.files : [];
      const created: { id: number; proposalId: number; name: string; type: string; size: number; createdAt: string }[] = [];
      for (const f of files) {
        const name = typeof f.name === "string" ? f.name : "file";
        const type = typeof f.type === "string" ? f.type : "application/octet-stream";
        const size = typeof f.size === "number" ? f.size : 0;
        const data = typeof f.data === "string" ? f.data : "";
        const record: ProposalFileRecord = {
          id: proposalFileNextId++,
          proposalId,
          name,
          type,
          size,
          data,
          createdAt: isoNow(),
        };
        proposalFilesStore.push(record);
        created.push({ id: record.id, proposalId: record.proposalId, name: record.name, type: record.type, size: record.size, createdAt: record.createdAt });
        // Sync to Content Library with customer name (proposal owner)
        const now = formatContentDate(new Date());
        let authorName = "Customer";
        try {
          const proposal = await storage.getProposal(proposalId);
          if (proposal?.ownerId) {
            const owner = await storage.getUser(proposal.ownerId);
            if (owner) {
              const full = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
              authorName = full || (owner.email ?? "Customer");
            }
          }
        } catch (_) {}
        const contentItem: ContentItemRecord = {
          id: contentNextId++,
          title: record.name,
          category: "From Proposals",
          content: "",
          status: "draft",
          tags: ["proposal", String(proposalId)],
          starred: false,
          usageCount: 0,
          lastUsed: "",
          lastUpdated: now,
          author: authorName,
          createdBy: authorName,
          attachments: [{ name: record.name, dataUrl: record.data, size: record.size }],
        };
        contentStore.push(contentItem);
        // Also add to customer Knowledge Base so it appears in /knowledge-base
        const nowKb = new Date().toISOString();
        const kbDoc: CustomerKbDoc = {
          id: customerKbDocNextId++,
          name: record.name,
          type: type,
          size: record.size,
          uploadedAt: nowKb,
          tags: ["proposal", String(proposalId)],
          version: 1,
          description: "",
        };
        customerKbDocuments.push(kbDoc);
        customerKbVersions.push({
          id: customerKbVersionNextId++,
          documentId: kbDoc.id,
          version: 1,
          uploadedAt: nowKb,
          uploadedBy: "Proposal",
          changes: "Uploaded from proposal",
        });
      }
      res.status(201).json(created);
    } catch (error) {
      res.status(400).json({ message: "Failed to upload proposal files" });
    }
  });

  app.get("/api/v1/proposals/:id/files/:fileId", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);
      const file = proposalFilesStore.find((f) => f.proposalId === proposalId && f.id === fileId);
      if (!file) return res.status(404).json({ message: "File not found" });
      const base64 = file.data.replace(/^data:[^;]+;base64,/, "") || file.data;
      const buf = Buffer.from(base64, "base64");
      res.setHeader("Content-Type", file.type || "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
      res.send(buf);
    } catch (error) {
      res.status(500).json({ message: "Failed to download file" });
    }
  });

  // Sync this proposal's existing files to Content Library (for documents uploaded before sync was added)
  app.post("/api/v1/admin/proposals/:id/sync-files-to-content", async (req, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      if (!(await ensureProposalExists(proposalId))) return res.status(404).json({ message: "Proposal not found" });
      const proposal = await storage.getProposal(proposalId);
      let authorName = "Customer";
      if (proposal?.ownerId) {
        try {
          const owner = await storage.getUser(proposal.ownerId);
          if (owner) {
            const full = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim();
            authorName = full || (owner.email ?? "Customer");
          }
        } catch (_) {}
      }
      const files = proposalFilesStore.filter((f) => f.proposalId === proposalId);
      let synced = 0;
      for (const file of files) {
        const alreadyInContent = contentStore.some(
          (c) => c.title === file.name && c.tags.includes("proposal") && c.tags.includes(String(proposalId))
        );
        if (alreadyInContent) continue;
        const now = formatContentDate(new Date());
        const contentItem: ContentItemRecord = {
          id: contentNextId++,
          title: file.name,
          category: "From Proposals",
          content: "",
          status: "draft",
          tags: ["proposal", String(proposalId)],
          starred: false,
          usageCount: 0,
          lastUsed: "",
          lastUpdated: now,
          author: authorName,
          createdBy: authorName,
          attachments: [{ name: file.name, dataUrl: file.data, size: file.size }],
        };
        contentStore.push(contentItem);
        synced++;
        // Also add to customer Knowledge Base
        const nowKb = new Date().toISOString();
        const kbDoc: CustomerKbDoc = {
          id: customerKbDocNextId++,
          name: file.name,
          type: file.type,
          size: file.size,
          uploadedAt: nowKb,
          tags: ["proposal", String(proposalId)],
          version: 1,
          description: "",
        };
        customerKbDocuments.push(kbDoc);
        customerKbVersions.push({
          id: customerKbVersionNextId++,
          documentId: kbDoc.id,
          version: 1,
          uploadedAt: nowKb,
          uploadedBy: "Proposal",
          changes: "Synced from proposal",
        });
      }
      res.json({ success: true, synced, total: files.length });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync files to content library" });
    }
  });

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
      const userId = (req as any).user?.id ?? undefined;
      await addNotificationToProposalParticipants(
        proposalId,
        userId,
        "New question added",
        "A new question was added to this proposal.",
        "info",
        `/rfp/${proposalId}/questions`
      );
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
      const userId = (req as any).user?.id ?? undefined;
      if (existing) {
        existing.answer = typeof answer === "string" ? answer : "";
        existing.updatedAt = now;
        await addNotificationToProposalParticipants(
          proposalId,
          userId,
          "Answer updated",
          "An answer was updated on this proposal.",
          "info",
          `/rfp/${proposalId}/questions`
        );
        return res.json(existing);
      }
      const ans: AnswerRecord = { id: answerNextId++, questionId: qid, answer: typeof answer === "string" ? answer : "", createdAt: now, updatedAt: now };
      proposalAnswersStore.push(ans);
      await addNotificationToProposalParticipants(
        proposalId,
        userId,
        "New answer submitted",
        "An answer was submitted on this proposal.",
        "info",
        `/rfp/${proposalId}/questions`
      );
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
      if (result.length > 0) {
        const userId = (req as any).user?.id ?? undefined;
        await addNotificationToProposalParticipants(
          proposalId,
          userId,
          "Answers updated",
          "Answers were updated on this proposal.",
          "info",
          `/rfp/${proposalId}/questions`
        );
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
      const isReply = parentId != null;
      await addNotificationToProposalParticipants(
        proposalId,
        userId,
        isReply ? "New reply on proposal" : "New comment on proposal",
        `${userName} ${isReply ? "replied to a comment" : "commented"} on a question.`,
        "comment",
        `/rfp/${proposalId}/questions`
      );
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
      const textPreview = typeof text === "string" ? text.slice(0, 80) : "";
      await addNotificationToProposalParticipants(
        proposalId,
        userId,
        "New message in proposal chat",
        `${userName}: ${textPreview}${(typeof text === "string" && text.length > 80) ? "…" : ""}`,
        "chat",
        `/rfp/${proposalId}/questions`
      );
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
      await addNotificationToProposalParticipants(
        proposalId,
        userId,
        "New suggestion on proposal",
        `${userName} suggested an edit to an answer.`,
        "info",
        `/rfp/${proposalId}/questions`
      );
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
      await addNotificationToProposalParticipants(
        proposalId,
        userId,
        status === "accepted" ? "Suggestion accepted" : "Suggestion rejected",
        `A suggestion was ${status} on this proposal.`,
        status === "accepted" ? "success" : "info",
        `/rfp/${proposalId}/questions`
      );
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

  /** Resolve current user ID for notification endpoints (req.user set by auth middleware, or x-user-id when using proxy). */
  function getNotificationUserId(req: import("express").Request): number | null {
    const fromUser = (req as any).user?.id;
    if (fromUser != null && Number.isInteger(fromUser)) return Number(fromUser);
    const header = req.headers["x-user-id"];
    if (header != null) {
      const n = parseInt(String(header), 10);
      if (!Number.isNaN(n)) return n;
    }
    return null;
  }

  app.get("/api/v1/notifications", async (req, res) => {
    try {
      const userId = getNotificationUserId(req);
      if (userId == null) return res.json([]);
      const list = notificationStore.filter((n) => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      res.json(list.map((n) => ({ id: n.id, title: n.title, message: n.message, type: n.type, time: n.createdAt, read: n.read, link: n.link ?? null, createdAt: n.createdAt })));
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  /** Create a notification for the current user (e.g. when showing credit toasts so it appears in the bell). */
  app.post("/api/v1/notifications", async (req, res) => {
    try {
      const userId = getNotificationUserId(req);
      if (userId == null) return res.status(401).json({ message: "Authentication required" });
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const title = typeof body.title === "string" ? body.title.trim() : "";
      const message = typeof body.message === "string" ? body.message.trim() : "";
      if (!title && !message) return res.status(400).json({ message: "title or message required" });
      const type = typeof body.type === "string" ? body.type : "credit_alert";
      const link = typeof body.link === "string" ? body.link : undefined;
      addNotification(userId, title || "Notification", message || title, type, link || undefined);
      res.status(201).json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch("/api/v1/notifications/:notificationId/read", async (req, res) => {
    try {
      const userId = getNotificationUserId(req);
      if (userId == null) return res.status(401).json({ message: "Authentication required" });
      const id = req.params.notificationId;
      const n = notificationStore.find((x) => x.id === id);
      if (!n) return res.status(404).json({ message: "Notification not found" });
      if (n.userId !== userId) return res.status(403).json({ message: "Not allowed to update this notification" });
      n.read = true;
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  app.delete("/api/v1/notifications/:notificationId", async (req, res) => {
    try {
      const userId = getNotificationUserId(req);
      if (userId == null) return res.status(401).json({ message: "Authentication required" });
      const id = req.params.notificationId;
      const idx = notificationStore.findIndex((x) => x.id === id);
      if (idx === -1) return res.status(404).json({ message: "Notification not found" });
      if (notificationStore[idx].userId !== userId) return res.status(403).json({ message: "Not allowed to delete this notification" });
      notificationStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to dismiss" });
    }
  });

  app.patch("/api/v1/notifications/read-all", async (req, res) => {
    try {
      const userId = getNotificationUserId(req);
      if (userId != null) notificationStore.filter((n) => n.userId === userId).forEach((n) => { n.read = true; });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });

  app.delete("/api/v1/notifications", async (req, res) => {
    try {
      const userId = getNotificationUserId(req);
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

      const purchaserName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || `User ${userId}`;
      addNotification(
        userId,
        "Credits purchased",
        `You purchased ${amount.toLocaleString()} credit(s) (${plan} plan). Your new balance: ${(updatedUser.credits ?? 0).toLocaleString()}.`,
        "credit_purchase",
        "/rfp-projects"
      );
      await addLowCreditNotificationsIfNeeded(userId, updatedUser.credits ?? 0, purchaserName);
      
      res.json({ success: true, credits: updatedUser.credits });
    } catch (error) {
      res.status(500).json({ message: "Payment failed" });
    }
  });

  // Customer: knowledge base documents (store declared earlier with Content Library)
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
      // Sync to Content Library so it shows there and flows to admin Knowledge Base
      const contentNow = formatContentDate(new Date());
      const contentItem: ContentItemRecord = {
        id: contentNextId++,
        title: doc.name,
        category: "From Knowledge Base",
        content: doc.description || "",
        status: "approved",
        tags: [...doc.tags],
        starred: false,
        usageCount: 0,
        lastUsed: "",
        lastUpdated: contentNow,
        author: "Customer",
        createdBy: "Customer",
      };
      contentStore.push(contentItem);
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

  // Sync proposal documents into Knowledge Base (for docs added before auto-sync or after server restart)
  app.post("/api/v1/customer/knowledge-base/sync-from-proposals", async (req, res) => {
    try {
      const body = req.body || {};
      const userId = (req as any).user?.id ?? (req.headers["x-user-id"] ? parseInt(String(req.headers["x-user-id"]), 10) : undefined) ?? (body.userId != null ? parseInt(String(body.userId), 10) : undefined);
      if (userId == null || !Number.isFinite(userId)) {
        return res.status(401).json({ message: "Sign in to sync from proposals" });
      }
      const proposals = await storage.getProposalsByUserId(userId);
      let synced = 0;
      for (const proposal of proposals) {
        const files = proposalFilesStore.filter((f) => f.proposalId === proposal.id);
        for (const file of files) {
          const alreadyInKb = customerKbDocuments.some(
            (d) => d.name === file.name && Array.isArray(d.tags) && d.tags.includes("proposal") && d.tags.includes(String(proposal.id))
          );
          if (alreadyInKb) continue;
          const nowKb = new Date().toISOString();
          const kbDoc: CustomerKbDoc = {
            id: customerKbDocNextId++,
            name: file.name,
            type: file.type,
            size: file.size,
            uploadedAt: nowKb,
            tags: ["proposal", String(proposal.id)],
            version: 1,
            description: "",
          };
          customerKbDocuments.push(kbDoc);
          customerKbVersions.push({
            id: customerKbVersionNextId++,
            documentId: kbDoc.id,
            version: 1,
            uploadedAt: nowKb,
            uploadedBy: "Proposal",
            changes: "Synced from proposal",
          });
          synced++;
        }
      }
      res.json({ synced });
    } catch (error) {
      res.status(500).json({ message: "Failed to sync from proposals" });
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

  // Content Library routes (store declared earlier so proposal/KB uploads can sync)
  const CONTENT_CATEGORY_ICONS: Record<string, string> = {
    "Company Overview": "BookOpen",
    "Technical Capabilities": "Lightbulb",
    "Case Studies": "FileText",
    "Pricing Templates": "Tag",
    "Security & Compliance": "CheckCircle",
    "From Proposals": "FileUp",
    "From Knowledge Base": "Database",
  };
  const CONTENT_CATEGORY_COLORS = ["bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500", "bg-red-500"];

  app.get("/api/v1/admin/content", async (_req, res) => {
    try {
      const categoryCounts = new Map<string, number>();
      for (const item of contentStore) {
        const c = item.category || "Uncategorized";
        categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
      }
      const skipCategory = (name: string) => !name || name.trim().toLowerCase() === "uncategorized" || name.trim().toLowerCase() === "other";
      const categories = Array.from(categoryCounts.entries())
        .filter(([name]) => !skipCategory(name))
        .map(([name], idx) => ({
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
        createdBy: item.createdBy,
        tags: item.tags || [],
        starred: item.starred,
      }));
      // Group "From Proposals" by customer (author) for "By Customer" view in admin
      const fromProposals = contentStore.filter((c) => c.category === "From Proposals");
      const authorCounts = new Map<string, number>();
      for (const item of fromProposals) {
        const name = item.author || "Unknown";
        authorCounts.set(name, (authorCounts.get(name) || 0) + 1);
      }
      const contentByCustomer = Array.from(authorCounts.entries())
        .map(([author, documentCount]) => ({ author, documentCount }))
        .sort((a, b) => (b.documentCount - a.documentCount) || a.author.localeCompare(b.author));
      res.json({ contentCategories: categories, contentItems, contentByCustomer });
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
      const now = formatContentDate(new Date());
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
      let creatorName: string = typeof body.createdBy === "string" ? body.createdBy : (typeof body.author === "string" ? body.author : "Admin");
      const adminUserId = getAdminUserId(req);
      if (adminUserId != null) {
        try {
          const user = await storage.getUser(adminUserId);
          if (user) {
            const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
            creatorName = name || (user.email ?? "Admin");
          }
        } catch (_) {}
      }
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
        author: creatorName,
        createdBy: creatorName,
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
      item.lastUpdated = formatContentDate(new Date());
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

  // Admin sidebar: full nav so all admin pages are reachable from the UI (sidebar credits = admin's pool; usedThisMonth = real usage this month)
  app.get("/api/v1/admin/sidebar", async (req, res) => {
    try {
      const adminId = getAdminUserId(req);
      let sidebarCredits = 0;
      let usedThisMonth = 0;
      let creditsDistributed: number | undefined;
      if (adminId != null) {
        const adminUser = await storage.getUser(adminId);
        const role = (adminUser as { role?: string } | undefined)?.role?.toLowerCase();
        if (role === "super_admin") {
          const allUsers = await storage.getAllUsers();
          let total = 0;
          let distributed = 0;
          for (const u of allUsers) {
            const cred = (u as { credits?: number }).credits ?? 0;
            total += cred;
            if ((u as { role?: string }).role?.toLowerCase() !== "super_admin") distributed += cred;
          }
          sidebarCredits = total;
          creditsDistributed = distributed;
        } else {
          if (adminUser?.credits != null) sidebarCredits = adminUser.credits;
        }
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const txList = await storage.getCreditTransactionsByUserId(adminId);
        let refundedThisMonth = 0;
        for (const t of txList) {
          if (!t.createdAt || t.createdAt < startOfMonth) continue;
          if (t.amount < 0) usedThisMonth += Math.abs(t.amount);
          else if (t.type === "allocation_refund" || t.type === "refund") refundedThisMonth += t.amount;
        }
        usedThisMonth = Math.max(0, usedThisMonth - refundedThisMonth);
      }
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
              { href: "/admin/proposal-options", label: "Proposal Options", icon: "Tag" },
              { href: "/admin/integrations", label: "Integrations", icon: "Zap" },
              { href: "/admin/settings", label: "Settings", icon: "Settings" },
            ],
          },
        ],
        sidebarWidget: {
          title: "AI Credits",
          credits: sidebarCredits,
          creditsLabel: "available",
          usedThisMonth,
          usageDetailHref: "/admin/usage",
          ...(creditsDistributed !== undefined && { creditsDistributed }),
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
      { name: "Teal", primary: "#00796b", secondary: "#4db6ac" },
      { name: "Indigo", primary: "#4f46e5", secondary: "#818cf8" },
      { name: "Emerald", primary: "#059669", secondary: "#34d399" },
      { name: "Violet", primary: "#6d28d9", secondary: "#a78bfa" },
      { name: "Sky", primary: "#0284c7", secondary: "#38bdf8" },
      { name: "Slate", primary: "#475569", secondary: "#94a3b8" },
      { name: "Rose", primary: "#be123c", secondary: "#fb7185" },
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
      const defaultTheme = settingsStore.colorPresets?.[0]?.name ?? "Teal";
      res.json({
        defaultTheme,
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
      const defaultTheme = settingsStore.colorPresets?.[0]?.name ?? "Teal";
      res.json({ defaultTheme, ...settingsStore });
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
      const presetNames = (settingsStore.colorPresets ?? []).map((p: { name: string }) => p.name);
      const rawTheme = settings.colorTheme ?? settingsStore.colorPresets?.[0]?.name ?? "Teal";
      const colorTheme = presetNames.includes(rawTheme) ? rawTheme : "Teal";
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

  // Admin: proposal options (categories & industries) – manageable by admin/super_admin
  type OptionItem = { value: string; label: string };
  const proposalCategoriesStore: OptionItem[] = [
    { value: "technology", label: "Technology" },
    { value: "healthcare", label: "Healthcare" },
    { value: "finance", label: "Finance" },
    { value: "government", label: "Government" },
    { value: "other", label: "Other" },
  ];
  const industriesStore: OptionItem[] = [
    { value: "technology", label: "Technology" },
    { value: "healthcare", label: "Healthcare" },
    { value: "finance", label: "Financial Services" },
    { value: "government", label: "Government" },
    { value: "manufacturing", label: "Manufacturing" },
    { value: "retail", label: "Retail" },
    { value: "education", label: "Education" },
  ];

  const defaultProposalStatuses: OptionItem[] = [
    { value: "draft", label: "Draft" },
    { value: "in_progress", label: "In Progress" },
    { value: "review", label: "Review" },
    { value: "won", label: "Won" },
    { value: "lost", label: "Lost" },
  ];
  const dateRangesUsage: OptionItem[] = [
    { value: "day", label: "Today" },
    { value: "7days", label: "Last 7 days" },
    { value: "30days", label: "Last 30 days" },
    { value: "3months", label: "Last 3 months" },
    { value: "6months", label: "Last 6 months" },
    { value: "year", label: "Last 1 year" },
  ];
  app.get("/api/v1/admin/options", async (_req, res) => {
    try {
      res.json({
        proposalCategories: [...proposalCategoriesStore],
        industries: [...industriesStore],
        roles: [],
        contentCategories: [],
        contentStatuses: [],
        termTypes: [],
        proposalStatuses: [...defaultProposalStatuses],
        dateRangesUsage: [...dateRangesUsage],
        pageTitles: {},
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch options" });
    }
  });

  app.get("/api/v1/options", async (_req, res) => {
    try {
      res.json({
        proposalCategories: [...proposalCategoriesStore],
        industries: [...industriesStore],
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch options" });
    }
  });

  app.post("/api/v1/admin/options/categories", async (req, res) => {
    try {
      const { value, label } = req.body || {};
      const v = typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : "";
      const l = typeof label === "string" ? label.trim() : v;
      if (!v) return res.status(400).json({ message: "value is required" });
      if (proposalCategoriesStore.some((c) => c.value === v)) return res.status(400).json({ message: "Category value already exists" });
      proposalCategoriesStore.push({ value: v, label: l || v });
      res.status(201).json(proposalCategoriesStore[proposalCategoriesStore.length - 1]);
    } catch (error) {
      res.status(500).json({ message: "Failed to add category" });
    }
  });

  app.patch("/api/v1/admin/options/categories/:value", async (req, res) => {
    try {
      const item = proposalCategoriesStore.find((c) => c.value === req.params.value);
      if (!item) return res.status(404).json({ message: "Category not found" });
      const { label } = req.body || {};
      if (typeof label === "string" && label.trim()) item.label = label.trim();
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/v1/admin/options/categories/:value", async (req, res) => {
    try {
      const idx = proposalCategoriesStore.findIndex((c) => c.value === req.params.value);
      if (idx === -1) return res.status(404).json({ message: "Category not found" });
      proposalCategoriesStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  app.post("/api/v1/admin/options/industries", async (req, res) => {
    try {
      const { value, label } = req.body || {};
      const v = typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "-") : "";
      const l = typeof label === "string" ? label.trim() : v;
      if (!v) return res.status(400).json({ message: "value is required" });
      if (industriesStore.some((i) => i.value === v)) return res.status(400).json({ message: "Industry value already exists" });
      industriesStore.push({ value: v, label: l || v });
      res.status(201).json(industriesStore[industriesStore.length - 1]);
    } catch (error) {
      res.status(500).json({ message: "Failed to add industry" });
    }
  });

  app.patch("/api/v1/admin/options/industries/:value", async (req, res) => {
    try {
      const item = industriesStore.find((i) => i.value === req.params.value);
      if (!item) return res.status(404).json({ message: "Industry not found" });
      const { label } = req.body || {};
      if (typeof label === "string" && label.trim()) item.label = label.trim();
      res.json(item);
    } catch (error) {
      res.status(500).json({ message: "Failed to update industry" });
    }
  });

  app.delete("/api/v1/admin/options/industries/:value", async (req, res) => {
    try {
      const idx = industriesStore.findIndex((i) => i.value === req.params.value);
      if (idx === -1) return res.status(404).json({ message: "Industry not found" });
      industriesStore.splice(idx, 1);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete industry" });
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

  // Admin: knowledge base (built from Content Library; rebuild syncs contentStore into KB list)
  type KbDoc = { id: string; title: string; embeddingStatus: string; chunkCount?: number; lastIndexedAt?: string };
  type KbVersion = { id: string; createdAt: string; documentCount?: number; size?: string };
  const kbDocumentsStore: KbDoc[] = [];
  let kbLastRebuildAt: string | null = null;
  const kbVersionsStore: KbVersion[] = [];
  let kbVersionNextId = 1;

  function syncKnowledgeBaseFromContentLibrary(): void {
    kbDocumentsStore.length = 0;
    const now = new Date().toISOString();
    for (const item of contentStore) {
      kbDocumentsStore.push({
        id: `content_${item.id}`,
        title: item.title,
        embeddingStatus: "indexed",
        chunkCount: 0,
        lastIndexedAt: now,
      });
    }
  }

  app.get("/api/v1/admin/knowledge-base", async (_req, res) => {
    try {
      // Documents in KB are always derived from Content Library (proposal uploads, customer KB, admin content)
      const documents: KbDoc[] = contentStore.map((item) => ({
        id: `content_${item.id}`,
        title: item.title,
        embeddingStatus: "indexed",
        chunkCount: 0,
        lastIndexedAt: item.lastUpdated ? new Date(item.lastUpdated).toISOString() : undefined,
      }));
      res.json({
        documents,
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
      syncKnowledgeBaseFromContentLibrary();
      kbLastRebuildAt = now;
      const version: KbVersion = { id: `kb_${kbVersionNextId++}`, createdAt: now, documentCount: contentStore.length, size: "—" };
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

  // Admin: subscription & billing (plans, invoices, API quota)
  type BillingPlanRecord = { id: string; name: string; price: number; interval: string; creditsIncluded?: number; apiQuotaPerMonth?: number; features?: string[] };
  const billingPlansStore: BillingPlanRecord[] = [
    { id: "plan_pro", name: "Professional", price: 99, interval: "month", creditsIncluded: 10000, apiQuotaPerMonth: 5000, features: ["AI generation", "Unlimited proposals"] },
    { id: "plan_enterprise", name: "Enterprise", price: 299, interval: "month", creditsIncluded: 50000, apiQuotaPerMonth: 50000, features: ["Everything in Pro", "SSO", "Priority support"] },
  ];
  let billingPlanNextId = 1;
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

  // Stripe: processed session IDs so we don't add credits twice (idempotency)
  const processedStripeSessionIds = new Set<string>();

  // Admin: credits – create Stripe Checkout Session (buy flow). Requires env: STRIPE_SECRET_KEY. Optional: APP_BASE_URL for success/cancel redirect URLs.
  app.post("/api/v1/admin/credits/create-order", async (req, res) => {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey?.trim()) {
        return res.status(503).json({ message: "Payment not configured (STRIPE_SECRET_KEY)" });
      }
      const stripe = new Stripe(secretKey.trim());
      const body = req.body || {};
      const packageId = typeof body.packageId === "string" ? body.packageId.trim() : "";
      const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
      const currency = (typeof body.currency === "string" ? body.currency : "USD").toUpperCase();
      const credits = typeof body.credits === "number" ? body.credits : Number(body.credits);
      const userId = body.userId != null ? Number(body.userId) : NaN;
      if (!packageId || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "packageId, amount (positive number), credits, and userId required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const amountCents = Math.round(amount * 100);
      const baseUrl = process.env.APP_BASE_URL?.trim() || `${req.protocol}://${req.get("host") || "localhost:5000"}`;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: amountCents,
              product_data: {
                name: `RFP AI Credits – ${packageId}`,
                description: `${credits.toLocaleString()} credits`,
                images: [],
              },
            },
          },
        ],
        success_url: `${baseUrl}/admin/credits?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/admin/credits`,
        metadata: {
          packageId,
          credits: String(credits),
          userId: String(userId),
        },
      });
      res.json({
        sessionId: session.id,
        url: session.url,
        amount: amountCents,
        currency,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create checkout session";
      res.status(500).json({ message });
    }
  });

  // Admin: credits – confirm Stripe payment and add credits (call after redirect from Checkout)
  app.post("/api/v1/admin/credits/confirm-stripe-payment", async (req, res) => {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey?.trim()) {
        return res.status(503).json({ message: "Payment not configured (STRIPE_SECRET_KEY)" });
      }
      const stripe = new Stripe(secretKey.trim());
      const body = req.body || {};
      const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId required" });
      }
      if (processedStripeSessionIds.has(sessionId)) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        const userId = session.metadata?.userId ? Number(session.metadata.userId) : NaN;
        const user = userId ? await storage.getUser(userId) : undefined;
        return res.json({ success: true, credits: user?.credits ?? 0, alreadyProcessed: true });
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.status(400).json({ message: "Payment not completed" });
      }
      const packageId = session.metadata?.packageId ?? "";
      const credits = session.metadata?.credits ? Number(session.metadata.credits) : 0;
      const userId = session.metadata?.userId ? Number(session.metadata.userId) : NaN;
      if (!packageId || !Number.isFinite(credits) || credits <= 0 || !Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ message: "Invalid session metadata" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      processedStripeSessionIds.add(sessionId);
      const updatedUser = await storage.updateUser(userId, {
        credits: (user.credits || 0) + credits,
      });
      await storage.createCreditTransaction({
        userId,
        amount: credits,
        type: "purchase",
        description: `Credits purchase: ${packageId} (Stripe ${sessionId})`,
      });
      const buyerName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || `User ${userId}`;
      addNotification(
        userId,
        "Credits purchased",
        `You bought ${credits.toLocaleString()} credit(s). Your new balance: ${(updatedUser.credits ?? 0).toLocaleString()}.`,
        "credit_purchase",
        "/admin/credits"
      );
      await addLowCreditNotificationsIfNeeded(userId, updatedUser.credits ?? 0, buyerName);
      res.json({ success: true, credits: updatedUser.credits });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to confirm payment";
      res.status(500).json({ message });
    }
  });

  // In-memory log of who allocated credits to whom (for super-admin activity view)
  type AllocationLogEntry = { allocatedByUserId: number; allocatedByName: string; targetUserId: number; targetUserName: string; targetUserRole?: string; amount: number; date: string };
  const allocationLog: AllocationLogEntry[] = [];

  // Admin: credits – get credit pool (admin's available credits) and user allocations (for Credit Management page)
  app.get("/api/v1/admin/credits", async (req, res) => {
    try {
      const adminId = getAdminUserId(req);
      if (adminId == null) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const adminUser = await storage.getUser(adminId);
      if (!adminUser) {
        return res.status(404).json({ message: "User not found" });
      }
      const poolCredits = adminUser.credits ?? 0;
      const users = await storage.getAllUsers();
      const userById = new Map(users.map((u) => [u.id, u]));
      const userName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null; id: number }) =>
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || `User ${u.id}`;
      const initials = (u: { firstName?: string | null; lastName?: string | null; email?: string | null }) => {
        const first = (u.firstName ?? "").trim().slice(0, 1).toUpperCase();
        const last = (u.lastName ?? "").trim().slice(0, 1).toUpperCase();
        if (first || last) return (first + last).slice(0, 2);
        return (u.email ?? "?").slice(0, 2).toUpperCase();
      };
      const userAllocations = users.map((u) => ({
        id: u.id,
        name: userName(u),
        avatar: initials(u),
        allocated: u.credits ?? 0,
        used: 0,
        remaining: u.credits ?? 0,
      }));
      const allTx = await storage.getAllCreditTransactions();
      const transactions = allTx.map((t) => {
        const u = t.userId != null ? userById.get(t.userId) : null;
        return {
          id: t.id,
          type: t.type,
          description: t.description ?? "",
          amount: t.amount,
          date: t.createdAt ? new Date(t.createdAt).toISOString().slice(0, 10) : "",
          user: u ? userName(u) : `User ${t.userId}`,
          status: "completed",
        };
      });
      const creditPackages = [
        { id: "plan-1", name: "Starter", credits: 1000, price: 29, popular: false, perCredit: 0.029 },
        { id: "plan-2", name: "Growth", credits: 5000, price: 99, popular: true, perCredit: 0.0198 },
        { id: "plan-3", name: "Scale", credits: 15000, price: 249, popular: false, perCredit: 0.0166 },
      ];
      res.json({
        totalCredits: poolCredits,
        usedCredits: 0,
        remainingCredits: poolCredits,
        creditPackages,
        transactions,
        userAllocations,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch credits";
      res.status(500).json({ message });
    }
  });

  // Admin: credits – allocate credits to a user. Credits move to/from the allocator's pool.
  app.post("/api/v1/admin/credits/allocate", async (req, res) => {
    try {
      const body = req.body || {};
      const targetUserId = body.userId != null ? Number(body.userId) : NaN;
      const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
      const allocatedByUserId = body.allocatedBy != null ? Number(body.allocatedBy) : getAdminUserId(req) ?? null;
      if (!Number.isInteger(targetUserId) || targetUserId <= 0 || !Number.isFinite(amount)) {
        return res.status(400).json({ message: "userId and amount required" });
      }
      const user = await storage.getUser(targetUserId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const currentTarget = user.credits ?? 0;
      const newTargetCredits = currentTarget + amount;

      if (newTargetCredits < 0) {
        return res.status(400).json({ message: "Insufficient credits: user would go below zero" });
      }

      let allocatorName: string | null = null;
      const allocator = allocatedByUserId != null && Number.isInteger(allocatedByUserId) ? await storage.getUser(allocatedByUserId) : null;
      if (allocator) {
        allocatorName = [allocator.firstName, allocator.lastName].filter(Boolean).join(" ").trim() || allocator.email || `User ${allocatedByUserId}`;
      }

      if (amount > 0) {
        if (!allocator) {
          return res.status(400).json({ message: "Allocator (admin) required when giving credits" });
        }
        const allocatorPool = allocator.credits ?? 0;
        if (allocatorPool < amount) {
          return res.status(400).json({ message: "Insufficient credits in your pool to allocate" });
        }
        await storage.updateUser(allocatedByUserId!, { credits: allocatorPool - amount });
      } else if (amount < 0) {
        if (allocator) {
          await storage.updateUser(allocatedByUserId!, { credits: (allocator.credits ?? 0) + Math.abs(amount) });
        }
      }

      await storage.updateUser(targetUserId, { credits: newTargetCredits });

      const allocationDescription =
        body.description ||
        (allocatorName
          ? (amount >= 0 ? `Allocated by ${allocatorName}: +${amount}` : `Deducted by ${allocatorName}: ${amount}`)
          : amount >= 0
            ? `Allocated +${amount}`
            : `Deducted ${amount}`);
      await storage.createCreditTransaction({
        userId: targetUserId,
        amount,
        type: "allocation",
        description: allocationDescription,
      });
      const targetName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || `User ${targetUserId}`;
      if (allocatedByUserId != null && Number.isInteger(allocatedByUserId) && allocatorName && amount > 0) {
        const targetRole = (user as { role?: string }).role ?? undefined;
        allocationLog.push({
          allocatedByUserId,
          allocatedByName: allocatorName,
          targetUserId,
          targetUserName: targetName,
          targetUserRole: targetRole,
          amount,
          date: new Date().toISOString(),
        });
      }

      // Notifications: tell target user and allocator (admin)
      if (amount > 0) {
        addNotification(
          targetUserId,
          "Credits assigned to you",
          `${allocatorName || "Admin"} assigned ${amount.toLocaleString()} credit(s) to you. Your new balance: ${newTargetCredits.toLocaleString()}.`,
          "credit_assigned",
          "/rfp-projects"
        );
        if (allocatedByUserId && allocatedByUserId !== targetUserId) {
          addNotification(
            allocatedByUserId,
            "Credits allocated",
            `You assigned ${amount.toLocaleString()} credit(s) to ${targetName}. Their new balance: ${newTargetCredits.toLocaleString()}.`,
            "credit_allocated",
            "/admin/credits"
          );
        }
      } else {
        const deducted = Math.abs(amount);
        addNotification(
          targetUserId,
          "Credits removed by admin",
          `${allocatorName || "Admin"} removed ${deducted.toLocaleString()} credit(s) from your account. Your new balance: ${newTargetCredits.toLocaleString()}.`,
          "credit_removed",
          "/rfp-projects"
        );
        if (allocatedByUserId && allocatedByUserId !== targetUserId) {
          addNotification(
            allocatedByUserId,
            "Credits removed from user",
            `You removed ${deducted.toLocaleString()} credit(s) from ${targetName}. Their new balance: ${newTargetCredits.toLocaleString()}.`,
            "credit_deducted",
            "/admin/credits"
          );
        }
      }

      await addLowCreditNotificationsIfNeeded(targetUserId, newTargetCredits, targetName);
      if (allocatedByUserId && allocator) {
        const allocatorNewBalance = amount > 0
          ? (allocator.credits ?? 0) - amount
          : (allocator.credits ?? 0) + Math.abs(amount);
        await addLowCreditNotificationsIfNeeded(allocatedByUserId, allocatorNewBalance, allocatorName || undefined);
      }

      res.json({ userId: targetUserId, previousCredits: currentTarget, newCredits: newTargetCredits, amount });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to allocate";
      res.status(500).json({ message });
    }
  });

  // Customer & collaborator: credit usage – where they received credits and where they spent (read-only, scoped to current user)
  function getCreditUsageUserId(req: import("express").Request): number | undefined {
    const fromUser = (req as any).user?.id;
    if (fromUser != null && Number.isInteger(fromUser)) return Number(fromUser);
    const header = req.headers["x-user-id"];
    if (header != null) {
      const n = parseInt(String(header), 10);
      if (!Number.isNaN(n)) return n;
    }
    return undefined;
  }
  type CreditReceivedItem = { id: number; date: string; amount: number; source: "purchase" | "allocation"; sourceDetail: string | null; description: string | null };
  type CreditUsedItem = { id: number; date: string; amount: number; description: string | null; proposalId: number | null; proposalTitle: string | null };
  type CreditReducedItem = { id: number; date: string; amount: number; takenBy: string | null; roleLabel: string | null; description: string | null };
  async function handleCreditUsage(req: import("express").Request, res: import("express").Response): Promise<void> {
    try {
      const userId = getCreditUsageUserId(req);
      if (userId == null) {
        res.status(401).json({ message: "Authentication required" });
        return;
      }
      const transactions = await storage.getCreditTransactionsByUserId(userId);
      const creditsReceived: CreditReceivedItem[] = [];
      const creditsUsed: CreditUsedItem[] = [];
      const creditsReduced: CreditReducedItem[] = [];
      const proposalsCache = new Map<number, { title: string }>();
      for (const t of transactions) {
        const date = t.createdAt ? new Date(t.createdAt).toISOString() : "";
        if (t.type === "allocation" && t.amount < 0) {
          creditsReduced.push({
            id: t.id,
            date,
            amount: Math.abs(t.amount),
            takenBy: "Admin",
            roleLabel: "Admin",
            description: t.description,
          });
        } else if (t.type === "purchase" || (t.type === "allocation" && t.amount > 0)) {
          const source = t.type === "purchase" ? "purchase" : "allocation";
          let sourceDetail: string | null = null;
          if (t.type === "allocation" && t.description) {
            const byMatch = /(?:Allocated|Deducted) by ([^:]+)/i.exec(t.description);
            if (byMatch) sourceDetail = byMatch[1].trim();
            else sourceDetail = t.description;
          } else if (t.type === "purchase" && t.description) sourceDetail = t.description;
          creditsReceived.push({
            id: t.id,
            date,
            amount: t.amount,
            source,
            sourceDetail,
            description: t.description,
          });
        } else if (t.type === "usage") {
          let proposalId: number | null = null;
          let proposalTitle: string | null = null;
          if (t.description) {
            const proposalMatch = /proposal\s*#?(\d+)/i.exec(t.description);
            if (proposalMatch) {
              proposalId = parseInt(proposalMatch[1], 10);
              if (!proposalsCache.has(proposalId)) {
                try {
                  const p = await storage.getProposal(proposalId);
                  proposalsCache.set(proposalId, { title: p?.title ?? `Proposal #${proposalId}` });
                } catch {
                  proposalsCache.set(proposalId, { title: `Proposal #${proposalId}` });
                }
              }
              proposalTitle = proposalsCache.get(proposalId)?.title ?? null;
            }
          }
          creditsUsed.push({
            id: t.id,
            date,
            amount: Math.abs(t.amount),
            description: t.description,
            proposalId,
            proposalTitle,
          });
        }
      }
      creditsReceived.sort((a, b) => (b.date > a.date ? 1 : -1));
      creditsUsed.sort((a, b) => (b.date > a.date ? 1 : -1));
      creditsReduced.sort((a, b) => (b.date > a.date ? 1 : -1));
      res.json({ creditsReceived, creditsUsed, creditsReduced });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch credit usage";
      res.status(500).json({ message });
    }
  }
  app.get("/api/v1/customer/credits/usage", (req, res) => handleCreditUsage(req, res));
  app.get("/api/v1/collaborator/credits/usage", (req, res) => handleCreditUsage(req, res));

  // Super-admin: credit activity – who bought credits and who allocated how much to whom
  app.get("/api/v1/admin/credits/activity", async (_req, res) => {
    try {
      const allTx = await storage.getAllCreditTransactions();
      const users = await storage.getAllUsers();
      const userById = new Map(users.map((u) => [u.id, u]));
      const name = (u: { firstName?: string | null; lastName?: string | null; email?: string | null; id: number }) =>
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || `User ${u.id}`;

      const purchaseTx = allTx.filter((t) => t.type === "purchase");
      const byAdmin = new Map<number, { adminId: number; adminName: string; totalCredits: number; count: number; transactions: { amount: number; date: string; description: string | null }[] }>();
      for (const t of purchaseTx) {
        const uid = t.userId;
        if (uid == null) continue;
        const u = userById.get(uid);
        const adminName = u ? name(u) : `User ${uid}`;
        if (!byAdmin.has(uid)) byAdmin.set(uid, { adminId: uid, adminName, totalCredits: 0, count: 0, transactions: [] });
        const row = byAdmin.get(uid)!;
        row.totalCredits += t.amount;
        row.count += 1;
        row.transactions.push({ amount: t.amount, date: t.createdAt ? new Date(t.createdAt).toISOString() : "", description: t.description });
      }
      const purchasesByAdmin = Array.from(byAdmin.values()).sort((a, b) => b.totalCredits - a.totalCredits);

      const byAllocator = new Map<number, { adminId: number; adminName: string; allocations: { targetUserId: number; targetUserName: string; targetUserRole?: string; amount: number; date: string }[] }>();
      for (const e of allocationLog) {
        if (!byAllocator.has(e.allocatedByUserId)) byAllocator.set(e.allocatedByUserId, { adminId: e.allocatedByUserId, adminName: e.allocatedByName, allocations: [] });
        const targetUserRole = e.targetUserRole ?? userById.get(e.targetUserId)?.role;
        byAllocator.get(e.allocatedByUserId)!.allocations.push({
          targetUserId: e.targetUserId,
          targetUserName: e.targetUserName,
          ...(targetUserRole != null && { targetUserRole: String(targetUserRole) }),
          amount: e.amount,
          date: e.date,
        });
      }
      const allocationsByAdmin = Array.from(byAllocator.values()).sort((a, b) => b.allocations.length - a.allocations.length);

      res.json({ purchasesByAdmin, allocationsByAdmin });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch activity";
      res.status(500).json({ message });
    }
  });

  // Admin: usage analytics – real data from credit transactions and proposals; super_admin can pick admin, then see admin + customers/collaborators
  app.get("/api/v1/admin/usage", async (req, res) => {
    try {
      const adminId = getAdminUserId(req);
      if (adminId == null) {
        return res.status(401).json({ message: "Authentication required" });
      }
      const currentUser = await storage.getUser(adminId);
      const userRoleRaw = (currentUser?.role ?? "").toLowerCase().replace(/\s+/g, "_");
      const isSuperAdmin = userRoleRaw === "super_admin" || userRoleRaw === "super_administrator";
      const selectedAdminIdParam = req.query.adminId != null ? parseInt(String(req.query.adminId), 10) : undefined;
      const selectedAdminId = isSuperAdmin && selectedAdminIdParam != null && !Number.isNaN(selectedAdminIdParam) ? selectedAdminIdParam : undefined;
      const dateRange = (req.query.dateRange as string) || "7days";
      const roleFilter = typeof req.query.role === "string" ? req.query.role.trim().toLowerCase() : "";
      const nameFilter = typeof req.query.name === "string" ? req.query.name.trim().toLowerCase() : "";

      const allUsers = await storage.getAllUsers();
      const userById = new Map(allUsers.map((u) => [u.id, u]));
      const displayName = (u: { firstName?: string | null; lastName?: string | null; email?: string | null; id: number }) =>
        [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || u.email || `User ${u.id}`;
      const roleLabel = (r: string) => {
        const s = (r ?? "").toLowerCase().replace(/\s+/g, "_");
        if (s === "super_admin" || s === "super_administrator") return "Super Admin";
        if (s === "admin") return "Admin";
        if (s === "customer") return "Customer";
        if (s === "collaborator") return "Collaborator";
        return r || "User";
      };

      const now = new Date();
      let startDate: Date;
      switch (dateRange) {
        case "day":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "7days":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case "30days":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 30);
          break;
        case "month":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case "3months":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 90);
          break;
        case "6months":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 180);
          break;
        case "year":
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 365);
          break;
        default:
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
      }
      const startTime = startDate.getTime();

      const inRange = (d: Date | string | null) => {
        if (!d) return false;
        const t = typeof d === "string" ? new Date(d).getTime() : d.getTime();
        return t >= startTime;
      };

      // Admin list for super_admin folder view (no adminId selected). Only "admin" role – exclude super_admin, customer, collaborator.
      const isAdminOnlyRole = (role: string | null | undefined) => {
        const r = (role ?? "").toLowerCase().replace(/\s+/g, "_");
        return r === "admin";
      };
      let adminList: { id: number; name: string; email?: string | null; role: string }[] = [];
      if (isSuperAdmin && selectedAdminId == null) {
        adminList = allUsers
          .filter((u) => isAdminOnlyRole(u.role))
          .map((u) => ({ id: u.id, name: displayName(u), email: u.email ?? null, role: roleLabel(u.role ?? "") }));
      }

      // Scope: which user IDs to include in analytics (selected admin + their collaborators/customers, or current admin only)
      // When super_admin with no selection: include ALL usage so dashboard shows same data as "all admins" combined.
      const superAdminViewAll = isSuperAdmin && selectedAdminId == null;
      let scopeUserIds: Set<number>;
      if (isSuperAdmin && selectedAdminId != null) {
        const adminProposals = await storage.getProposalsByUserId(selectedAdminId);
        const proposalIds = new Set(adminProposals.map((p) => p.id));
        const collaboratorIds = new Set<number>();
        for (const pid of proposalIds) {
          const collabs = await storage.getCollaborationsByProposalId(pid);
          collabs.forEach((c) => { if (c.userId != null) collaboratorIds.add(c.userId); });
        }
        const ownerIds = new Set(adminProposals.map((p) => p.ownerId).filter((id): id is number => id != null));
        scopeUserIds = new Set([selectedAdminId, ...collaboratorIds, ...ownerIds]);
      } else if (!isSuperAdmin) {
        const adminProposals = await storage.getProposalsByUserId(adminId);
        const proposalIds = new Set(adminProposals.map((p) => p.id));
        const collaboratorIds = new Set<number>();
        for (const pid of proposalIds) {
          const collabs = await storage.getCollaborationsByProposalId(pid);
          collabs.forEach((c) => { if (c.userId != null) collaboratorIds.add(c.userId); });
        }
        const ownerIds = new Set(adminProposals.map((p) => p.ownerId).filter((id): id is number => id != null));
        scopeUserIds = new Set([adminId, ...collaboratorIds, ...ownerIds]);
      } else {
        scopeUserIds = new Set(allUsers.map((u) => u.id));
      }

      const allTx = await storage.getAllCreditTransactions();
      const usageTx = allTx.filter((t) => {
        if (t.type !== "usage" || t.userId == null) return false;
        if (superAdminViewAll) return true;
        return scopeUserIds.size === 0 || scopeUserIds.has(t.userId);
      });
      const usageInRange = usageTx.filter((t) => inRange(t.createdAt));
      const totalCreditsUsed = usageInRange.reduce((s, t) => s + Math.abs(t.amount), 0);

      const allProposals = await storage.getAllProposals();
      if (superAdminViewAll) {
        const fromTx = allTx.filter((t) => t.userId != null).map((t) => t.userId!);
        const fromProposals = allProposals.map((p) => p.ownerId).filter((id): id is number => id != null);
        scopeUserIds = new Set([...scopeUserIds, ...fromTx, ...fromProposals]);
      }
      const proposalsByOwner = new Map<number, number>();
      for (const p of allProposals) {
        if (p.ownerId != null && (scopeUserIds.size === 0 || scopeUserIds.has(p.ownerId) || superAdminViewAll)) {
          proposalsByOwner.set(p.ownerId, (proposalsByOwner.get(p.ownerId) ?? 0) + 1);
        }
      }
      const proposalCountInRange = usageInRange.reduce((set, t) => {
        const m = t.description?.match(/proposal\s*#?(\d+)/i);
        if (m) set.add(parseInt(m[1], 10));
        return set;
      }, new Set<number>()).size;

      const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyByDay = new Map<string, { credits: number; proposals: Set<number> }>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyByDay.set(key, { credits: 0, proposals: new Set() });
      }
      usageInRange.forEach((t) => {
        const key = t.createdAt ? new Date(t.createdAt).toISOString().split("T")[0] : "";
        if (dailyByDay.has(key)) {
          const row = dailyByDay.get(key)!;
          row.credits += Math.abs(t.amount);
          const m = t.description?.match(/proposal\s*#?(\d+)/i);
          if (m) row.proposals.add(parseInt(m[1], 10));
        }
      });
      const dailyUsage = Array.from(dailyByDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([dateStr, v]) => ({
          day: dayLabels[new Date(dateStr).getDay()],
          credits: v.credits,
          proposals: v.proposals.size,
        }));

      const totalUsageAll = usageTx.reduce((s, t) => s + Math.abs(t.amount), 0);
      const featureUsage = totalUsageAll > 0
        ? [{ feature: "Response Generation", usage: Math.round((totalCreditsUsed / totalUsageAll) * 100) || 0, credits: totalCreditsUsed }]
        : [{ feature: "Response Generation", usage: 0, credits: 0 }];

      const byUser = new Map<number, { credits: number; proposals: Set<number> }>();
      usageInRange.forEach((t) => {
        const uid = t.userId!;
        if (!byUser.has(uid)) byUser.set(uid, { credits: 0, proposals: new Set() });
        const row = byUser.get(uid)!;
        row.credits += Math.abs(t.amount);
        const m = t.description?.match(/proposal\s*#?(\d+)/i);
        if (m) row.proposals.add(parseInt(m[1], 10));
      });
      const topUsersRaw = Array.from(byUser.entries()).map(([userId, v]) => {
        const u = userById.get(userId);
        const name = u ? displayName(u) : `User ${userId}`;
        const initials = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
        const proposals = v.proposals.size || (proposalsByOwner.get(userId) ?? 0);
        const credits = v.credits;
        const efficiency = proposals > 0 ? Math.round(credits / proposals) : 0;
        return { name, avatar: initials, credits, proposals, efficiency, userId, role: u?.role ?? "" };
      });
      const topUsers = topUsersRaw
        .filter((r) => (!roleFilter || (r.role || "").toLowerCase() === roleFilter) && (!nameFilter || r.name.toLowerCase().includes(nameFilter) || (userById.get(r.userId)?.email ?? "").toLowerCase().includes(nameFilter)))
        .sort((a, b) => b.credits - a.credits)
        .slice(0, 20)
        .map(({ name, avatar, credits, proposals, efficiency }) => ({ name, avatar, credits, proposals, efficiency }));

      const byHour = new Map<number, number>();
      for (let h = 0; h < 24; h++) byHour.set(h, 0);
      usageInRange.forEach((t) => {
        if (t.createdAt) {
          const h = new Date(t.createdAt).getHours();
          byHour.set(h, (byHour.get(h) ?? 0) + Math.abs(t.amount));
        }
      });
      const maxHourUsage = Math.max(...Array.from(byHour.values()), 1);
      const hourlyPeaks = Array.from(byHour.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([h, usage]) => ({ hour: h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`, usage: Math.round((usage / maxHourUsage) * 100) }));

      const usersInScope: { userId: number; name: string; email?: string | null; role: string; roleLabel: string; credits: number; proposals: number; efficiency: number }[] = topUsersRaw.map((r) => {
        const u = userById.get(r.userId);
        return {
          userId: r.userId,
          name: r.name,
          email: u?.email ?? null,
          role: (u?.role ?? "").toLowerCase(),
          roleLabel: roleLabel(u?.role ?? ""),
          credits: r.credits,
          proposals: r.proposals,
          efficiency: r.proposals > 0 ? Math.round(r.credits / r.proposals) : 0,
        };
      }).filter((r) => (!roleFilter || r.role === roleFilter) && (!nameFilter || r.name.toLowerCase().includes(nameFilter) || (r.email ?? "").toLowerCase().includes(nameFilter)));

      const summaryCards = [
        { label: "Credits Used", value: totalCreditsUsed.toLocaleString(), trend: dateRange === "7days" ? "Last 7 days" : dateRange, trendUp: true, icon: "Sparkles", iconColor: "text-primary", bgColor: "bg-primary/10" },
        { label: "Proposals", value: String(proposalCountInRange), trend: "in range", trendUp: true, icon: "Activity", iconColor: "text-blue-500", bgColor: "bg-blue-500/10" },
        { label: "Avg Credits/Proposal", value: proposalCountInRange > 0 ? String(Math.round(totalCreditsUsed / proposalCountInRange)) : "0", trend: "efficiency", trendUp: true, icon: "Target", iconColor: "text-emerald-500", bgColor: "bg-emerald-500/10" },
        { label: "AI Messages", value: String(usageInRange.length), trend: "usage events", trendUp: true, icon: "Clock", iconColor: "text-amber-500", bgColor: "bg-amber-500/10" },
      ];

      const dateRanges = [
        { value: "day", label: "Today" },
        { value: "7days", label: "Last 7 days" },
        { value: "30days", label: "Last 30 days" },
        { value: "week", label: "This week" },
        { value: "month", label: "This month" },
        { value: "3months", label: "Last 3 months" },
        { value: "6months", label: "Last 6 months" },
        { value: "year", label: "Last 1 year" },
      ];

      res.json({
        adminList,
        summaryCards,
        dailyUsage,
        featureUsage,
        topUsers,
        hourlyPeaks,
        usersInScope,
        selectedAdminId: selectedAdminId ?? null,
        dateRanges,
        pageTitle: "Usage Analytics",
        isSuperAdmin,
        currentUserRole: userRoleRaw,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to fetch usage";
      res.status(500).json({ message });
    }
  });

  // Admin: AI config (aligned with LLM backend: providers, modelsByProvider, selectedProvider, selectedModel, apiKeys)
  const MASKED_KEY = "••••••••••••••••";
  type AIConfigFeatures = { autoSuggest?: boolean; contentFiltering?: boolean; allowBulkGenerate?: boolean; allowToneSelection?: boolean };
  type AIModelItem = { id: string; name: string; speed?: string; quality?: string; cost?: string };
  type AIConfigStore = {
    selectedProvider?: string;
    selectedModel?: string;
    defaultModel?: string;
    defaultTemperature?: number;
    defaultMaxTokens?: number;
    systemPromptDefault?: string;
    features?: AIConfigFeatures;
    apiKeys?: Record<string, string>;
  };
  const defaultModelsByProvider: Record<string, AIModelItem[]> = {
    openai: [
      { id: "gpt-4o", name: "GPT-4o", speed: "Fast", quality: "Highest", cost: "$$$" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", speed: "Medium", quality: "High", cost: "$$" },
    ],
    anthropic: [
      { id: "claude-3-opus", name: "Claude 3 Opus", speed: "Medium", quality: "Highest", cost: "$$$" },
      { id: "claude-3-sonnet", name: "Claude 3 Sonnet", speed: "Fast", quality: "High", cost: "$$" },
    ],
    mistral: [
      { id: "mistral-large", name: "Mistral Large", speed: "Fast", quality: "High", cost: "$$" },
      { id: "mistral-small", name: "Mistral Small", speed: "Fast", quality: "Medium", cost: "$" },
    ],
    ollama: [
      { id: "llama3.2", name: "Llama 3.2", speed: "Medium", quality: "High", cost: "Free" },
      { id: "llama3.1", name: "Llama 3.1", speed: "Medium", quality: "High", cost: "Free" },
      { id: "mistral", name: "Mistral", speed: "Fast", quality: "High", cost: "Free" },
    ],
  };
  const defaultProviders = [
    { id: "openai", name: "OpenAI" },
    { id: "anthropic", name: "Anthropic" },
    { id: "mistral", name: "Mistral" },
    { id: "ollama", name: "Ollama" },
  ];
  const aiConfigStore: AIConfigStore = {
    selectedProvider: "openai",
    selectedModel: "gpt-4o",
    defaultModel: "gpt-4o",
    defaultTemperature: 0.7,
    defaultMaxTokens: 2048,
    systemPromptDefault: "",
    features: { autoSuggest: true, contentFiltering: true, allowBulkGenerate: true, allowToneSelection: true },
    apiKeys: { openai: "", anthropic: "", mistral: "", ollama: "" },
  };
  function getAiConfigResponse() {
    const provider = aiConfigStore.selectedProvider ?? "openai";
    const modelsByProvider = defaultModelsByProvider;
    const models = modelsByProvider[provider] ?? defaultModelsByProvider.openai;
    const aiModels = Object.entries(modelsByProvider).flatMap(([provId, list]) =>
      list.map((m) => ({ ...m, id: m.id, name: m.name, provider: defaultProviders.find((p) => p.id === provId)?.name ?? provId, speed: m.speed, quality: m.quality, cost: m.cost }))
    );
    return {
      selectedProvider: aiConfigStore.selectedProvider,
      selectedModel: aiConfigStore.selectedModel ?? aiConfigStore.defaultModel,
      defaultModel: aiConfigStore.defaultModel ?? aiConfigStore.selectedModel,
      defaultTemperature: aiConfigStore.defaultTemperature ?? 0.7,
      defaultMaxTokens: aiConfigStore.defaultMaxTokens ?? 2048,
      systemPromptDefault: aiConfigStore.systemPromptDefault ?? "",
      creditsUsed: "0",
      providers: defaultProviders,
      modelsByProvider,
      apiKeys: Object.fromEntries(
        Object.entries(aiConfigStore.apiKeys ?? {}).map(([k, v]) => [k, v && v !== MASKED_KEY ? MASKED_KEY : v ?? ""])
      ) as Record<string, string>,
      aiModels,
      qualityMetrics: [
        { label: "Response Accuracy", value: 94.2, target: 95 },
        { label: "Factual Consistency", value: 91.8, target: 90 },
        { label: "Brand Voice Match", value: 88.5, target: 85 },
        { label: "Compliance Adherence", value: 96.1, target: 95 },
      ],
      features: aiConfigStore.features,
    };
  }
  app.get("/api/v1/admin/ai-config", async (_req, res) => {
    try {
      res.json(getAiConfigResponse());
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch AI config" });
    }
  });
  app.patch("/api/v1/admin/ai-config", async (req, res) => {
    try {
      const body = req.body || {};
      if (body.selectedProvider !== undefined) aiConfigStore.selectedProvider = String(body.selectedProvider);
      if (body.selectedModel !== undefined) aiConfigStore.selectedModel = String(body.selectedModel);
      if (body.defaultModel !== undefined) aiConfigStore.defaultModel = String(body.defaultModel);
      if (body.defaultTemperature !== undefined) aiConfigStore.defaultTemperature = Number(body.defaultTemperature);
      if (body.defaultMaxTokens !== undefined) aiConfigStore.defaultMaxTokens = Number(body.defaultMaxTokens);
      if (body.systemPromptDefault !== undefined) aiConfigStore.systemPromptDefault = String(body.systemPromptDefault);
      if (body.apiKeys !== undefined && typeof body.apiKeys === "object") {
        if (!aiConfigStore.apiKeys) aiConfigStore.apiKeys = {};
        for (const [provider, key] of Object.entries(body.apiKeys as Record<string, string>)) {
          if (key && key !== MASKED_KEY) aiConfigStore.apiKeys[provider] = key;
        }
      }
      if (body.features !== undefined && typeof body.features === "object") {
        const f = body.features as Record<string, unknown>;
        aiConfigStore.features = {
          autoSuggest: f.autoSuggest !== undefined ? Boolean(f.autoSuggest) : aiConfigStore.features?.autoSuggest,
          contentFiltering: f.contentFiltering !== undefined ? Boolean(f.contentFiltering) : aiConfigStore.features?.contentFiltering,
          allowBulkGenerate: f.allowBulkGenerate !== undefined ? Boolean(f.allowBulkGenerate) : aiConfigStore.features?.allowBulkGenerate,
          allowToneSelection: f.allowToneSelection !== undefined ? Boolean(f.allowToneSelection) : aiConfigStore.features?.allowToneSelection,
        };
      }
      res.json(getAiConfigResponse());
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

  // Admin: audit logs (stub – returns sample data; supports pagination via limit/offset)
  app.get("/api/v1/admin/audit-logs", async (req, res) => {
    try {
      const type = (req.query.type as string) || "login";
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || 50), 10) || 50));
      const offset = Math.max(0, parseInt(String(req.query.offset || 0), 10) || 0);
      const now = new Date();
      const ts = (d: Date) => d.toISOString();
      const sample: { id: string; type: string; action: string; user: string; ip?: string; location?: string; resource?: string; details?: string; timestamp: string; status: string }[] = [];
      const base = [
        { user: "admin@example.com", ip: "192.168.1.1", location: "San Francisco, US" },
        { user: "jane@example.com", ip: "10.0.0.5", location: "New York, US" },
        { user: "john@example.com", ip: "172.16.0.2", location: "London, UK" },
        { user: "Nitsan Admin", ip: "10.0.0.1", location: "Tel Aviv, IL" },
        { user: "Admin DEMO", ip: "10.0.0.2", location: "London, UK" },
        { user: "manthan kathiriya", ip: "192.168.0.1", location: "Mumbai, IN" },
      ];
      if (type === "login") {
        for (let i = 0; i < 25; i++) {
          const b = base[i % base.length];
          sample.push({
            id: String(i + 1),
            type: "login",
            action: i % 10 === 2 ? "Failed login attempt" : "User logged in",
            user: b.user,
            ip: b.ip,
            location: b.location,
            timestamp: ts(new Date(now.getTime() - i * 3600000)),
            status: i % 10 === 2 ? "failure" : "success",
          });
        }
      } else if (type === "data_access") {
        for (let i = 0; i < 20; i++) {
          const b = base[i % base.length];
          sample.push({
            id: String(100 + i),
            type: "data_access",
            action: i % 2 === 0 ? "Viewed proposal" : "Exported proposal PDF",
            user: b.user,
            resource: `Proposal #${101 + i}`,
            timestamp: ts(new Date(now.getTime() - i * 1800000)),
            status: "success",
          });
        }
      } else if (type === "file") {
        for (let i = 0; i < 15; i++) {
          const b = base[i % base.length];
          sample.push({
            id: String(200 + i),
            type: "file",
            action: i % 2 === 0 ? "Uploaded document" : "Downloaded proposal",
            user: b.user,
            resource: i % 2 === 0 ? "RFP-spec.pdf" : "Proposal #101",
            details: i % 2 === 0 ? "Content Library" : undefined,
            timestamp: ts(new Date(now.getTime() - i * 3600000)),
            status: "success",
          });
        }
      } else if (type === "ai_usage") {
        for (let i = 0; i < 15; i++) {
          const b = base[i % base.length];
          sample.push({
            id: String(300 + i),
            type: "ai_usage",
            action: "AI generation",
            user: b.user,
            resource: `Proposal #${101 + i}`,
            details: "GPT-4, ~1.2k tokens",
            timestamp: ts(new Date(now.getTime() - i * 5400000)),
            status: "success",
          });
        }
      }
      const total = sample.length;
      const entries = sample.slice(offset, offset + limit);
      res.json({ entries, total });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
