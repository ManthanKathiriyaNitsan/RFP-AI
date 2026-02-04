/**
 * AI Chat page configuration types.
 * Same JSON shape can be returned by backend GET /api/v1/customer/ai-chat-config.
 */

export interface HeaderAction {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface QuickSuggestion {
  title: string;
  description: string;
  prompt: string;
}

export interface RecentChatItem {
  id: number | string;
  title: string;
  time: string;
}

export interface AiChatConfig {
  page: {
    title: string;
    subtitle: string;
  };
  headerActions: HeaderAction[];
  chat: {
    title: string;
    statusText: string;
    inputPlaceholder: string;
  };
  sidebar: {
    quickSuggestionsTitle: string;
    recentChatsTitle: string;
    recentChatsToastTitle: string;
    recentChatsToastDescriptionPrefix: string;
  };
  quickSuggestions: QuickSuggestion[];
  recentChats: RecentChatItem[];
  /** Optional: initial/welcome messages when no proposalId (id, isAi, message). Backend can override. */
  initialMessages?: Array<{ id: number; isAi: boolean; message: string }>;
}
