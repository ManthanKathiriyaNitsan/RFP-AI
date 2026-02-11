import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: text("role").notNull().default("customer"), // customer, admin, collaborator
  company: text("company"),
  jobTitle: text("job_title"),
  bio: text("bio"),
  credits: integer("credits").default(0),
  avatar: text("avatar"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const proposals = pgTable("proposals", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  industry: text("industry"),
  budgetRange: text("budget_range"),
  timeline: text("timeline"),
  status: text("status").notNull().default("draft"), // draft, in_progress, completed
  content: jsonb("content"),
  ownerId: integer("owner_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const collaborations = pgTable("collaborations", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").references(() => proposals.id),
  userId: integer("user_id").references(() => users.id),
  role: text("role").notNull(), // editor, reviewer, viewer
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").references(() => proposals.id),
  userId: integer("user_id").references(() => users.id),
  message: text("message").notNull(),
  isAi: boolean("is_ai").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // purchase, usage, refund
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProposalSchema = createInsertSchema(proposals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCollaborationSchema = createInsertSchema(collaborations).omit({
  id: true,
  createdAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;
export type Collaboration = typeof collaborations.$inferSelect;
export type InsertCollaboration = z.infer<typeof insertCollaborationSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
