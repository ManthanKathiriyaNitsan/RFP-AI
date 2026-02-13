import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Bot, Send, MessageSquare, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fetchChatMessages } from "@/api/proposals";
import { useProposalsList } from "@/hooks/use-proposals-api";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/api";
import { parseApiError } from "@/lib/utils";
import { authStorage } from "@/lib/auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AiChatConfig } from "@/config/ai-chat.types";

/** Minimal default when backend does not return config; all data should come from backend. */
const defaultAiChatConfig: AiChatConfig = {
  page: { title: "AI Chat Assistant", subtitle: "Refine your proposals with intelligent suggestions" },
  headerActions: [
    { id: "home", label: "Home", icon: "home", href: "" },
    { id: "newProposal", label: "New Proposal", icon: "fileText", href: "/proposals/new" },
    { id: "settings", label: "Settings", icon: "settings", href: "/account-settings" },
  ],
  chat: { title: "RFP AI Assistant", statusText: "Online • Ready to help", inputPlaceholder: "Type your message..." },
  sidebar: {
    quickSuggestionsTitle: "Quick Suggestions",
    recentChatsTitle: "Recent Chats",
    recentChatsToastTitle: "Chat history",
    recentChatsToastDescriptionPrefix: "Loading chat:",
  },
  quickSuggestions: [],
  recentChats: [],
  initialMessages: [
    { id: 1, isAi: true, message: "Hello! How may I help you today? I'm here to assist with your RFP—whether you need help with timelines, budget, risks, or vendor criteria. Type a message or pick a suggestion to get started." },
  ],
};

async function fetchAiChatConfig(): Promise<AiChatConfig> {
  const token = authStorage.getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(getApiUrl("/api/v1/customer/ai-chat-config"), {
    credentials: "include",
    headers,
  });
  if (res.ok) return res.json() as Promise<AiChatConfig>;
  return defaultAiChatConfig;
}

const DEFAULT_WELCOME_MESSAGE = {
  id: 1,
  isAi: true as const,
  message: "Hello! How may I help you today? I'm here to assist with your RFP—whether you need help with timelines, budget, risks, or vendor criteria. Type a message or pick a suggestion to get started.",
};

function initialMessagesFromConfig(config: AiChatConfig): Array<{ id: number; isAi: boolean; message: string; timestamp: Date }> {
  const list = config.initialMessages ?? [];
  const now = Date.now();
  const out = list.length
    ? list.map((m, i) => ({
      id: Number(m.id) || i + 1,
      isAi: m.isAi,
      message: m.message,
      timestamp: new Date(now - (list.length - 1 - i) * 60 * 1000),
    }))
    : [{ ...DEFAULT_WELCOME_MESSAGE, timestamp: new Date(now) }];
  return out;
}

const NO_PROPOSAL_MESSAGE = "Select a proposal above to get answers based on your knowledge base, or open a proposal and use the chat there.";
const NO_AI_RESPONSE_FALLBACK = "Sorry, I couldn't generate a response. Please try again.";

export default function AIChat() {
  const { currentRole, user, updateUser } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search && search.startsWith("?") ? search.slice(1) : search || ""), [search]);
  const proposalIdFromUrl = useMemo(() => {
    const id = searchParams.get("proposalId");
    if (id == null || id === "") return null;
    const n = parseInt(id, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [searchParams]);
  const [proposalIdState, setProposalIdState] = useState<number | null>(null);
  const proposalId = proposalIdFromUrl ?? proposalIdState;
  const [, setLocation] = useLocation();
  const { data: proposalsList = [] } = useProposalsList();
  const proposals = useMemo(() => proposalsList as { id: number; title: string }[], [proposalsList]);
  const credits = user?.credits ?? 0;
  const noCredits = credits <= 0;
  const isAdmin = (currentRole || "").toLowerCase() === "admin" || (currentRole || "").toLowerCase() === "super_admin";
  const noCreditsMessage = noCredits
    ? isAdmin
      ? "Buy new credits to continue generating content."
      : "Contact your admin for more credits."
    : null;
  const noCreditsActionHref = isAdmin ? "/admin/credits" : "/dashboard";

  const { data: configData } = useQuery({
    queryKey: ["ai-chat-config"],
    queryFn: fetchAiChatConfig,
  });
  const config = configData ?? defaultAiChatConfig;

  const [messages, setMessages] = useState(() => initialMessagesFromConfig(config));
  const [inputMessage, setInputMessage] = useState("");
  const [isAiThinking, setIsAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // When config loads from API with initial messages, show them (only if we haven't started chatting yet)
  useEffect(() => {
    const list = config.initialMessages ?? [];
    if (list.length > 0 && messages.length <= 1) {
      setMessages(initialMessagesFromConfig(config));
    }
  }, [config.initialMessages, config.page?.title]);

  const { data: chatMessages = [] } = useQuery<any[]>({
    queryKey: ["/api/chat", proposalId],
    queryFn: () => fetchChatMessages(proposalId!),
    enabled: !!proposalId,
  });

  useEffect(() => {
    if ((chatMessages as any[]).length > 0) {
      setMessages((chatMessages as any[]).map((msg: any) => ({
        id: msg.id,
        isAi: msg.isAi,
        message: msg.message,
        timestamp: new Date(msg.createdAt),
      })));
    }
  }, [chatMessages]);

  const PROPOSAL_NONE_VALUE = "__none__";
  const onProposalSelect = (value: string) => {
    if (value === PROPOSAL_NONE_VALUE) {
      setProposalIdState(null);
      setLocation("/ai-chat");
      return;
    }
    const id = parseInt(value, 10);
    if (Number.isFinite(id)) {
      setProposalIdState(id);
      setLocation(`/ai-chat?proposalId=${id}`);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiThinking]);

  const sendMessageMutation = useMutation({
    mutationFn: async (messageText: string) => {
      if (!user || !proposalId) {
        return { id: Date.now(), message: messageText, isAi: false };
      }
      const response = await apiRequest("POST", "/api/chat", {
        proposalId,
        userId: user.id,
        message: messageText,
        isAi: false,
      });
      return response.json();
    },
    onSuccess: (data: { id?: number; message?: string; aiMessage?: { id: number; isAi: boolean; message: string; createdAt?: string }; credits?: number }) => {
      const newMessage = {
        id: data.id ?? messages.length + 1,
        isAi: false,
        message: data.message ?? inputMessage,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      setInputMessage("");
      setIsAiThinking(false);
      if (typeof data.credits === "number") {
        updateUser({ credits: data.credits });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["customer", "sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["collaborator", "sidebar"] });
      const aiMessage = data.aiMessage;
      if (aiMessage) {
        setMessages(prev => [
          ...prev,
          {
            id: aiMessage.id,
            isAi: true,
            message: aiMessage.message,
            timestamp: aiMessage.createdAt ? new Date(aiMessage.createdAt) : new Date(),
          },
        ]);
      } else {
        setTimeout(() => {
          setMessages(prev => [
            ...prev,
            {
              id: messages.length + 2,
              isAi: true,
              message: NO_AI_RESPONSE_FALLBACK,
              timestamp: new Date(),
            },
          ]);
        }, 500);
      }
    },
    onError: (error: unknown) => {
      setIsAiThinking(false);
      const { message } = parseApiError(error);
      const is402 = error instanceof Error && /^402:/.test(error.message);
      const creditMsg = isAdmin
        ? "Buy new credits to continue."
        : "Contact your admin for more credits.";
      const creditHref = isAdmin ? "/admin/credits" : "/dashboard";
      toast({
        title: is402 ? "Insufficient credits" : "Error",
        description: is402 ? (message ? `${message} ${creditMsg}` : creditMsg) : message || "Failed to send message. Please try again.",
        variant: "destructive",
        action: is402 ? (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = creditHref}>
            {isAdmin ? "Buy credits" : "Go to Dashboard"}
          </Button>
        ) : undefined,
      });
    },
  });

  const handleSendMessage = (message?: string) => {
    const messageText = message || inputMessage;
    if (!messageText.trim()) return;
    if (noCredits) {
      toast({
        title: "No credits",
        description: noCreditsMessage ?? "You need credits to generate content.",
        variant: "destructive",
        action: isAdmin ? (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = "/admin/credits"}>
            Buy credits
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = "/dashboard"}>
            Dashboard
          </Button>
        ),
      });
      return;
    }
    setIsAiThinking(true);
    if (proposalId && user) {
      sendMessageMutation.mutate(messageText);
    } else {
      const newMessage = {
        id: messages.length + 1,
        isAi: false,
        message: messageText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, newMessage]);
      setInputMessage("");
      setIsAiThinking(false);
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          {
            id: messages.length + 2,
            isAi: true,
            message: NO_PROPOSAL_MESSAGE,
            timestamp: new Date(),
          },
        ]);
      }, 400);
    }
  };

  const formatTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const { page, chat, sidebar } = config;

  return (
    <div className="space-y-4 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">{page.title}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">{page.subtitle}</p>
      </div>

      {/* Proposal selector: RAG uses knowledge base scoped to a proposal */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Proposal (for knowledge-base answers):</span>
        <Select
          value={proposalId != null ? String(proposalId) : PROPOSAL_NONE_VALUE}
          onValueChange={onProposalSelect}
        >
          <SelectTrigger className="w-[220px] sm:w-[280px]">
            <SelectValue placeholder="Select a proposal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PROPOSAL_NONE_VALUE}>None</SelectItem>
            {proposals.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                <span className="truncate block max-w-[200px] sm:max-w-[240px]" title={p.title}>{p.title || `Proposal #${p.id}`}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {proposalId != null && (
          <Link href={`/rfp/${proposalId}`}>
            <Button variant="outline" size="sm" className="gap-1">
              <FileText className="w-3.5 h-3.5" />
              Open proposal
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Chat Interface */}
        <div className="lg:col-span-2">
          <Card className="h-[500px] sm:h-[600px] flex flex-col">
            <CardHeader className="border-b p-3 sm:p-6">
              <div className="flex items-center space-x-2 sm:space-x-3">
                <div className="w-8 h-8 sm:w-10 sm:h-10 ai-gradient rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm sm:text-base lg:text-lg truncate">{chat.title}</CardTitle>
                  <div className="flex items-center space-x-1 sm:space-x-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full shrink-0" />
                    <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground truncate">{chat.statusText}</p>
                  </div>
                </div>
              </div>
            </CardHeader>

            <div className="flex-1 p-3 sm:p-4 overflow-y-auto">
              <div className="space-y-3 sm:space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start ${message.isAi ? "space-x-2 sm:space-x-3" : "flex-row-reverse space-x-reverse space-x-2 sm:space-x-3"}`}
                  >
                    {message.isAi && (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 ai-gradient rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                      </div>
                    )}
                    <div className="flex flex-col max-w-[75%] sm:max-w-xs lg:max-w-md">
                      <div
                        className={`rounded-lg p-2 sm:p-3 text-xs sm:text-sm ${message.isAi ? "bg-muted" : "bg-primary text-primary-foreground"
                          }`}
                      >
                        <p className="whitespace-pre-line break-words">{message.message}</p>
                      </div>
                      <span
                        className={`text-[10px] sm:text-xs text-muted-foreground mt-1 ${message.isAi ? "self-start" : "self-end"}`}
                      >
                        {formatTime(message.timestamp)}
                      </span>
                    </div>
                  </div>
                ))}
                {isAiThinking && (
                  <div className="flex items-start space-x-2 sm:space-x-3">
                    <div className="w-6 h-6 sm:w-8 sm:h-8 ai-gradient rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="rounded-lg px-4 py-3 bg-muted min-w-[3rem]" aria-label="AI is thinking">
                      <div className="chat-typing-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="p-3 sm:p-4 border-t">
              {noCredits && (
                <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">
                  {noCreditsMessage}
                  {noCreditsActionHref && (
                    <Button variant="link" className="h-auto p-0 ml-1 text-xs underline" onClick={() => window.location.href = noCreditsActionHref}>
                      {isAdmin ? "Buy credits" : "Go to Dashboard"}
                    </Button>
                  )}
                </p>
              )}
              <div className="flex gap-2 sm:gap-3">
                <Input
                  placeholder={noCredits ? (isAdmin ? "Buy credits to continue" : "Contact your admin for credits") : chat.inputPlaceholder}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && !noCredits && handleSendMessage()}
                  className="flex-1 text-xs sm:text-sm"
                  disabled={noCredits}
                />
                <Button onClick={() => handleSendMessage()} size="icon" className="shrink-0" disabled={noCredits}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base lg:text-lg">{sidebar.quickSuggestionsTitle}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
              {config.quickSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full text-left p-3 sm:p-4 h-auto flex flex-col items-start space-y-1"
                  onClick={() => handleSendMessage(suggestion.prompt)}
                  disabled={noCredits}
                >
                  <div className="font-medium text-xs sm:text-sm">{suggestion.title}</div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground">{suggestion.description}</div>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-sm sm:text-base lg:text-lg flex items-center space-x-2">
                <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>{sidebar.recentChatsTitle}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
              {config.recentChats.map((chatItem) => (
                <Button
                  key={chatItem.id}
                  variant="ghost"
                  className="w-full text-left p-2 sm:p-3 h-auto flex flex-col items-start space-y-1"
                  onClick={() => {
                    toast({
                      title: sidebar.recentChatsToastTitle,
                      description: `${sidebar.recentChatsToastDescriptionPrefix} ${chatItem.title}`,
                    });
                  }}
                >
                  <div className="font-medium text-xs sm:text-sm">{chatItem.title}</div>
                  <div className="flex items-center space-x-1 text-[10px] sm:text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{chatItem.time}</span>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
