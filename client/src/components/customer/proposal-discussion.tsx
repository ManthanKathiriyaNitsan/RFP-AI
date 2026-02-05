import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { MessageSquare, Send, AtSign, Link2, Reply, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { useProposalComments, useAddAnswerComment, useProposalChat, useAddProposalChatMessage } from "@/hooks/use-proposals-api";
import type { AnswerComment } from "@/api/proposals";
import { QueryErrorState } from "@/components/shared/query-error-state";
import type { ProposalCommentsGroup, ProposalChatMessage } from "@/api/proposals";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Unified feed item: team message or reply-on-answer */
type FeedItem =
  | { type: "team"; id: string; createdAt: string; authorId: number; authorName: string; text: string }
  | {
      type: "reply";
      id: string;
      createdAt: string;
      authorId: number;
      authorName: string;
      text: string;
      answerId: number;
      questionText: string;
      parentId: number | null;
    };

/** Stable color from name for avatar background */
function avatarColor(name: string): string {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  const hues = ["primary", "emerald", "violet", "amber", "rose", "sky"];
  const idx = n % hues.length;
  return hues[idx];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

interface ProposalDiscussionTabProps {
  proposalId: number;
  canComment: boolean;
  /** Base path for "Questions" link e.g. /rfp, /collaborator/rfp, /admin/proposals */
  questionsHref?: string;
}

export function ProposalDiscussionTab({ proposalId, canComment, questionsHref }: ProposalDiscussionTabProps) {
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const { data: groups = [], isLoading: commentsLoading, isError: commentsError, error: commentsErrorObj, refetch: refetchComments } = useProposalComments(proposalId);
  const { data: chatMessages = [], isLoading: chatLoading, isError: chatError, error: chatErrorObj, refetch: refetchChat } = useProposalChat(proposalId);
  const addCommentMutation = useAddAnswerComment(proposalId);
  const addChatMutation = useAddProposalChatMessage(proposalId);
  const { toast } = useToast();
  const [replyingTo, setReplyingTo] = useState<{
    answerId: number;
    questionText: string;
    parentId: number | null;
  } | null>(null);
  const [messageText, setMessageText] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const unifiedFeed = useMemo((): FeedItem[] => {
    const items: FeedItem[] = [];
    chatMessages.forEach((m) => {
      items.push({
        type: "team",
        id: `team-${m.id}`,
        createdAt: m.createdAt,
        authorId: m.authorId,
        authorName: m.authorName,
        text: m.text,
      });
    });
    groups.forEach((g: ProposalCommentsGroup) => {
      const pushComment = (c: AnswerComment) => {
        items.push({
          type: "reply",
          id: `reply-${c.id}`,
          createdAt: c.createdAt,
          authorId: c.authorId,
          authorName: c.authorName,
          text: c.text,
          answerId: g.answerId,
          questionText: g.questionText,
          parentId: c.parentId ?? null,
        });
        (c.replies ?? []).forEach(pushComment);
      };
      g.comments.forEach(pushComment);
    });
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return items;
  }, [chatMessages, groups]);

  const handleSend = () => {
    const text = messageText.trim();
    if (!text) return;
    if (replyingTo) {
      addCommentMutation.mutate(
        { answerId: replyingTo.answerId, text, parentId: replyingTo.parentId ?? undefined },
        {
          onSuccess: () => {
            setMessageText("");
            setReplyingTo(null);
            toast({ title: "Reply sent", description: "Your reply has been posted." });
          },
          onError: (e) =>
            toast({ title: "Failed to send reply", description: e instanceof Error ? e.message : "Error", variant: "destructive" }),
        }
      );
    } else {
      addChatMutation.mutate(
        { text },
        {
          onSuccess: () => {
            setMessageText("");
            toast({ title: "Message sent", description: "Visible to everyone on this proposal." });
          },
          onError: (e) =>
            toast({ title: "Failed to send", description: e instanceof Error ? e.message : "Error", variant: "destructive" }),
        }
      );
    }
  };

  useEffect(() => {
    if (unifiedFeed.length > 0 && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [unifiedFeed.length]);

  const renderBubble = (item: FeedItem) => {
    const isOwn = currentUserId != null && Number(item.authorId) === Number(currentUserId);
    const colorClass = avatarColor(item.authorName);
    const isReply = item.type === "reply";
    return (
      <div
        key={item.id}
        className={cn("flex gap-3 w-full", isOwn && "flex-row-reverse justify-end")}
      >
        <Avatar
          className={cn(
            "h-8 w-8 shrink-0 ring-2 ring-background",
            colorClass === "primary" && "bg-primary/20 text-primary",
            colorClass === "emerald" && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
            colorClass === "violet" && "bg-violet-500/20 text-violet-600 dark:text-violet-400",
            colorClass === "amber" && "bg-amber-500/20 text-amber-600 dark:text-amber-400",
            colorClass === "rose" && "bg-rose-500/20 text-rose-600 dark:text-rose-400",
            colorClass === "sky" && "bg-sky-500/20 text-sky-600 dark:text-sky-400"
          )}
        >
          <AvatarFallback className="text-xs font-semibold">{initials(item.authorName)}</AvatarFallback>
        </Avatar>
        <div className={cn("flex-1 min-w-0 group", isOwn && "flex justify-end")}>
          <div
            className={cn(
              "inline-flex flex-col max-w-[85%] sm:max-w-[75%]",
              isOwn && "items-end"
            )}
          >
            <p className="text-xs font-semibold text-foreground mb-1">{item.authorName}</p>
            <div
              className={cn(
                "rounded-2xl px-4 py-2.5 border shadow-sm transition-colors",
                isOwn
                  ? "rounded-tr-md bg-primary/15 dark:bg-primary/20 border-primary/30"
                  : "rounded-tl-md bg-muted/80 dark:bg-muted/50 border-border/50 hover:bg-muted/90 dark:hover:bg-muted/60"
              )}
            >
              {isReply && (
                <div
                  className={cn(
                    "text-xs text-muted-foreground mb-2 pb-2 border-b border-border/50",
                    isOwn ? "border-primary/20" : "border-border/40"
                  )}
                  title={item.questionText}
                >
                  <span className="font-medium text-foreground/80">Re:</span>{" "}
                  {item.questionText.length > 60 ? `${item.questionText.slice(0, 60)}…` : item.questionText}
                </div>
              )}
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{item.text}</p>
            </div>
            <div className={cn("flex items-center gap-2 mt-1.5", isOwn && "flex-row-reverse")}>
              <span className="text-[10px] text-muted-foreground">
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
              </span>
              {canComment && isReply && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs opacity-70 group-hover:opacity-100 transition-opacity -ml-1"
                  onClick={() =>
                    setReplyingTo({
                      answerId: item.answerId,
                      questionText: item.questionText,
                      parentId: parseInt(item.id.replace("reply-", ""), 10) || null,
                    })
                  }
                >
                  <Reply className="w-3 h-3 mr-1" />
                  Reply
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isLoading = chatLoading || commentsLoading;
  const hasError = commentsError || chatError;
  const discussionError = commentsError ? commentsErrorObj : chatErrorObj;
  const refetchDiscussion = () => {
    refetchComments();
    refetchChat();
  };

  if (hasError) {
    return (
      <Card className="overflow-hidden border shadow-xl shadow-black/5 dark:shadow-none bg-card rounded-2xl">
        <CardHeader className="pb-4 pt-5 px-5 border-b bg-gradient-to-b from-muted/30 to-transparent">
          <CardTitle className="text-lg font-semibold">Chat</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">Team messages and replies on answers.</CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <QueryErrorState refetch={refetchDiscussion} error={discussionError} className="py-4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border shadow-xl shadow-black/5 dark:shadow-none bg-card rounded-2xl">
      <CardHeader className="pb-4 pt-5 px-5 border-b bg-gradient-to-b from-muted/30 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-inner">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold tracking-tight">Chat</CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-0.5 text-muted-foreground/90">
                Team messages and replies on answers — all in one place. Reply to a specific answer using Reply.
              </CardDescription>
            </div>
          </div>
          {questionsHref && (
            <Button variant="outline" size="sm" className="shrink-0 rounded-lg border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50" asChild>
              <Link href={`${questionsHref}/${proposalId}/questions`} className="inline-flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" />
                Open Questions & Answers
              </Link>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex flex-col">
        <div className="px-5 pt-4 pb-4 flex flex-col flex-1 min-h-0">
          <div className="rounded-2xl border border-border/60 bg-muted/5 dark:bg-muted/10 overflow-hidden flex flex-col flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              </div>
            ) : (
              <div
                ref={feedRef}
                className="flex flex-col gap-3 p-4 min-h-[200px] max-h-[380px] overflow-y-auto scroll-smooth"
              >
                {unifiedFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="rounded-full bg-muted/50 p-3 mb-2">
                      <AtSign className="w-6 h-6 text-muted-foreground/70" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Send a message below or reply to an answer from Questions.</p>
                    {questionsHref && (
                      <Button variant="outline" size="sm" className="mt-4 rounded-lg" asChild>
                        <Link href={`${questionsHref}/${proposalId}/questions`}>Go to Questions</Link>
                      </Button>
                    )}
                  </div>
                ) : (
                  unifiedFeed.map(renderBubble)
                )}
              </div>
            )}
            {canComment && (
              <div className="p-3 border-t border-border/50 bg-background/80 dark:bg-muted/5">
                {replyingTo && (
                  <div className="flex items-center justify-between gap-2 mb-2 py-1.5 px-2 rounded-lg bg-primary/10 dark:bg-primary/15 border border-primary/20">
                    <p className="text-xs text-foreground truncate flex-1">
                      Replying to: {replyingTo.questionText.slice(0, 60)}{replyingTo.questionText.length > 60 ? "…" : ""}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => setReplyingTo(null)}
                      title="Cancel reply"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2 items-center rounded-xl border border-border/70 bg-background px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-colors">
                  <Input
                    placeholder={replyingTo ? "Write a reply…" : "Message everyone…"}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
                    className="flex-1 border-0 bg-transparent text-sm py-2 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/70"
                  />
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={!messageText.trim() || addChatMutation.isPending || addCommentMutation.isPending}
                    className="rounded-lg theme-gradient-bg text-white shadow-md shrink-0 h-8 px-3"
                  >
                    <Send className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline text-xs">Send</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
