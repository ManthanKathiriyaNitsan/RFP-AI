import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueries } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  useProposal,
  useProposalQuestions,
  useProposalAnswers,
  useDraft,
  useSaveDraft,
  useCreateQuestion,
  useDeleteQuestion,
  useSetAnswer,
  useGetOrCreateShareToken,
  useGenerateProposalQuestions,
  useMyCollaboration,
  useAddAnswerComment,
  useProposalSuggestions,
  useUpdateSuggestionStatus,
  useCreateSuggestion,
  proposalKeys,
} from "@/hooks/use-proposals-api";
import { fetchAnswerComments } from "@/api/proposals";
import type { AnswerComment as ApiAnswerComment, AnswerSuggestion } from "@/api/proposals";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  X,
  Link2,
  Copy,
  FileText,
  Check,
  MessageSquare,
  Reply,
  Lightbulb,
  PenLine,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProposalStepper } from "@/components/customer/proposal-stepper";
import { cn } from "@/lib/utils";
import type { Question as ApiQuestion } from "@/api/proposals";

export default function ProposalQuestions() {
  const params = useParams();
  const [location] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const { user, currentRole } = useAuth();
  const fromAdmin = location.startsWith("/admin/proposals");
  const isCollaborator = location.startsWith("/collaborator");
  const rfpBase = fromAdmin ? "/admin/proposals" : isCollaborator ? "/collaborator/rfp" : "/rfp";
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [newQuestion, setNewQuestion] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AnswerSuggestion | null>(null);

  const { data: proposal, isLoading: proposalLoading } = useProposal(id);
  const { data: draft, isLoading: draftLoading } = useDraft(id);
  const { data: questionsData = [], isLoading: questionsLoading } = useProposalQuestions(id);
  const { data: answersData = [] } = useProposalAnswers(id);
  const { data: myCollaboration } = useMyCollaboration(isCollaborator ? id : null);
  const questions = questionsData;
  const createQuestionMutation = useCreateQuestion(id ?? 0);
  const deleteQuestionMutation = useDeleteQuestion(id ?? 0);
  const setAnswerMutation = useSetAnswer(id ?? 0);
  const saveDraftMutation = useSaveDraft(id ?? 0);
  const getShareTokenMutation = useGetOrCreateShareToken(id ?? 0);
  const generateQuestionsMutation = useGenerateProposalQuestions(id ?? 0);

  const answerByQuestionId = useMemo(() => {
    const map: Record<number, string> = {};
    answersData.forEach((a) => {
      map[a.questionId] = a.answer;
    });
    return map;
  }, [answersData]);

  const isOwner = user && proposal && proposal.ownerId === user.id;
  const canEditAnswers = isOwner || (isCollaborator && myCollaboration?.canEdit === true);
  const canGenerateQuestions = isOwner || (isCollaborator && myCollaboration?.canGenerateAi === true);
  const canGenerateAi = isOwner || (isCollaborator && myCollaboration?.canGenerateAi === true);
  const canAcceptRejectSuggestions = isOwner || fromAdmin;
  const canComment = true;
  const canSuggest = true;

  const answerIds = useMemo(() => {
    const ids: number[] = [];
    questions.forEach((q: ApiQuestion) => {
      const ans = answersData.find((a: { questionId: number }) => a.questionId === q.id);
      if (ans && (ans as { id?: number }).id) ids.push((ans as { id: number }).id);
    });
    return ids;
  }, [questions, answersData]);

  const commentQueries = useQueries({
    queries: (id != null ? answerIds : []).map((answerId: number) => ({
      queryKey: proposalKeys.answerComments(id!, answerId),
      queryFn: () => fetchAnswerComments(id!, answerId),
      enabled: !!id && !!answerId,
    })),
  });

  const apiCommentsByAnswerId = useMemo(() => {
    const map: Record<number, ApiAnswerComment[]> = {};
    commentQueries.forEach((q, i: number) => {
      const answerId = answerIds[i];
      if (answerId == null) return;
      const raw = q.data;
      const list: ApiAnswerComment[] = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === "object" && Array.isArray((raw as { comments?: ApiAnswerComment[] }).comments))
          ? (raw as { comments: ApiAnswerComment[] }).comments
          : [];
      const flat: ApiAnswerComment[] = [];
      list.forEach((c) => {
        flat.push(c);
        const replies = (c as ApiAnswerComment & { replies?: ApiAnswerComment[] }).replies ?? [];
        replies.forEach((r) => flat.push(r));
      });
      flat.sort((a, b) => new Date((a.createdAt ?? 0) as string).getTime() - new Date((b.createdAt ?? 0) as string).getTime());
      map[answerId] = flat;
    });
    return map;
  }, [commentQueries, answerIds]);

  const { data: suggestionsData } = useProposalSuggestions(id);
  const suggestionsList = useMemo(() => {
    const raw = suggestionsData ?? null;
    if (Array.isArray(raw)) return raw as AnswerSuggestion[];
    if (raw && typeof raw === "object" && Array.isArray((raw as { suggestions?: AnswerSuggestion[] }).suggestions))
      return (raw as { suggestions: AnswerSuggestion[] }).suggestions;
    return [];
  }, [suggestionsData]);
  const pendingSuggestions = useMemo(() => suggestionsList.filter((s) => s.status === "pending"), [suggestionsList]);
  const updateSuggestionMutation = useUpdateSuggestionStatus(id ?? 0);
  const createSuggestionMutation = useCreateSuggestion(id ?? 0);
  const addCommentMutation = useAddAnswerComment(id ?? 0);

  const [newComment, setNewComment] = useState<Record<number, string>>({});
  const [replyTo, setReplyTo] = useState<{ answerId: number; commentId: number } | null>(null);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [suggestOpenForAnswerId, setSuggestOpenForAnswerId] = useState<number | null>(null);
  const [suggestText, setSuggestText] = useState("");
  const answersSyncKeyRef = useRef<string>("");
  const answersHadDataRef = useRef(false);

  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const past = new Date(date);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleAddComment = (answerId: number, message: string, parentId?: number | null) => {
    if (!message?.trim() || !id) return;
    addCommentMutation.mutate(
      { answerId, message: message.trim(), parentId: parentId ?? undefined },
      {
        onSuccess: () => {
          if (parentId != null) {
            setReplyTo(null);
            setReplyText((prev) => ({ ...prev, [answerId]: "" }));
          } else {
            setNewComment((prev) => ({ ...prev, [answerId]: "" }));
          }
          toast({ title: parentId != null ? "Reply added" : "Comment added" });
        },
        onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
      }
    );
  };

  const handleAcceptSuggestion = (suggestionId: number) => {
    updateSuggestionMutation.mutate(
      { suggestionId, status: "accepted" },
      { onSuccess: () => toast({ title: "Suggestion accepted" }), onError: () => toast({ title: "Failed", variant: "destructive" }) }
    );
  };
  const handleRejectSuggestion = (suggestionId: number) => {
    updateSuggestionMutation.mutate(
      { suggestionId, status: "rejected" },
      { onSuccess: () => toast({ title: "Suggestion rejected" }), onError: () => toast({ title: "Failed", variant: "destructive" }) }
    );
  };

  const handleSubmitSuggestion = () => {
    if (suggestOpenForAnswerId == null || !suggestText.trim() || !id) return;
    createSuggestionMutation.mutate(
      { answerId: suggestOpenForAnswerId, suggestedText: suggestText.trim() },
      {
        onSuccess: () => {
          setSuggestOpenForAnswerId(null);
          setSuggestText("");
          toast({ title: "Suggestion sent", description: "The owner can accept or reject it." });
        },
        onError: () => toast({ title: "Failed to submit suggestion", variant: "destructive" }),
      }
    );
  };

  // Rehydrate answers from backend only when proposal/question list changes or when draft/answers first load.
  // Do not overwrite when answers refetch after save—that was wiping what the user was typing.
  const questionsKey = id != null ? `${id}:${questions.map((q: ApiQuestion) => q.id).sort((a, b) => a - b).join(",")}` : "";
  useEffect(() => {
    if (!questions.length || !questionsKey) return;
    const map: Record<number, string> = {};
    if (draft?.answers?.length) {
      draft.answers.forEach((a) => {
        map[a.questionId] = a.answer ?? "";
      });
    } else {
      questions.forEach((q: ApiQuestion) => {
        const a = answerByQuestionId[q.id];
        if (a?.trim()) map[q.id] = a;
      });
    }
    const hasData = !!draft?.answers?.length || Object.values(map).some((v) => (v ?? "").trim() !== "");
    const keyChanged = answersSyncKeyRef.current !== questionsKey;
    if (keyChanged) {
      answersSyncKeyRef.current = questionsKey;
      answersHadDataRef.current = hasData;
      setAnswers(map);
      return;
    }
    if (!answersHadDataRef.current && hasData) {
      answersHadDataRef.current = true;
      setAnswers(map);
    }
  }, [questionsKey, questions, draft?.answers, answerByQuestionId]);

  const handleSaveDraft = () => {
    if (!id || !questions.length) return;
    const answersPayload = questions.map((q) => ({
      questionId: q.id,
      answer: answers[q.id] ?? "",
    }));
    saveDraftMutation.mutate(
      { answers: answersPayload },
      {
        onSuccess: () => toast({ title: "Draft saved", description: "Your answers have been saved." }),
        onError: (e) =>
          toast({ title: "Error saving draft", description: e instanceof Error ? e.message : "Failed", variant: "destructive" }),
      }
    );
  };

  const handleGenerateAiQuestions = async () => {
    if (!id || !proposal) return;
    setGenerating(true);
    try {
      await generateQuestionsMutation.mutateAsync();
      toast({ title: "AI questions generated", description: "You can add more or edit them." });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to generate questions",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleAddQuestion = () => {
    if (!id || !newQuestion.trim()) return;
    createQuestionMutation.mutate(
      { question: newQuestion.trim(), source: "user" },
      {
        onSuccess: () => {
          setNewQuestion("");
          toast({ title: "Question added" });
        },
        onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
      }
    );
  };

  const handleRemoveQuestion = (questionId: number) => {
    if (!id) return;
    deleteQuestionMutation.mutate(questionId, {
      onSuccess: () => {
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        toast({ title: "Question removed" });
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const handleSaveAnswer = (questionId: number, answer: string) => {
    if (!id) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setAnswerMutation.mutate(
      { questionId, answer },
      { onError: (e) => toast({ title: "Error saving answer", description: e.message, variant: "destructive" }) }
    );
  };

  const handleGetShareLink = () => {
    if (!id) return;
    getShareTokenMutation.mutate(undefined, {
      onSuccess: (st) => {
        const base = window.location.origin;
        setShareLink(`${base}/p/${st.token}`);
        toast({ title: "Share link ready", description: "Copy and share this link for others to answer." });
      },
      onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareLink);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareLink;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      toast({ title: "Copied!", description: "Link copied to clipboard." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Could not copy to clipboard. You can select and copy the link manually.", variant: "destructive" });
    }
  };

  const getHomeRoute = () => {
    if (currentRole === "admin") return "/admin/proposals";
    if (currentRole === "collaborator") return "/collaborator";
    return "/rfp-projects";
  };

  if (proposalLoading || (id && questionsLoading && !proposal) || (id && draftLoading && !draft && !questions.length)) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }
  if (!id || !proposal) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">Proposal not found.</p>
        <Link href={getHomeRoute()}>
          <Button variant="outline" className="mt-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in px-4 sm:px-6 overflow-x-hidden">
      <div className="mb-4 sm:mb-6">
        <Link href={id ? (fromAdmin || isCollaborator ? `${rfpBase}/${id}` : `/proposals/new?edit=${id}`) : fromAdmin ? "/admin/proposals" : isCollaborator ? "/collaborator" : "/proposals/new"}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-3 sm:mb-4">
            <ArrowLeft className="w-4 h-4" />
            {fromAdmin ? "Back to proposal" : isCollaborator ? "Back to proposal" : "Back to step 1"}
          </Button>
        </Link>
        <ProposalStepper currentStep={2} proposalId={id} rfpBase={rfpBase} canGenerateAi={canGenerateAi} />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Questions & Share Link</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Add questions and get a shareable link.
        </p>
      </div>

      <div className="w-full">
        <div className="min-w-0 w-full max-w-4xl">
      {/* Share link card – only for owner (collaborators cannot export/share full project) */}
      {!isCollaborator && (
      <Card className="border shadow-sm mb-4 sm:mb-6">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Link2 className="w-4 h-4 text-primary" />
                Public share link
              </CardTitle>
              <CardDescription>
                Share this link so anyone can answer the questions (no login required).
              </CardDescription>
            </div>
            {!shareLink && (
              <Button
                onClick={handleGetShareLink}
                className="gap-2 shrink-0 theme-gradient-bg text-white border-0 hover:opacity-95"
              >
                <Link2 className="w-4 h-4" />
                Generate unique share link
              </Button>
            )}
          </div>
        </CardHeader>
        {shareLink && (
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input readOnly value={shareLink} className="font-mono text-sm" />
              <Button onClick={handleCopyLink} variant="outline" className="shrink-0">
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
      )}

      {/* Questions */}
      <Card className="border shadow-sm mb-4 sm:mb-6">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Questions & answers
              </CardTitle>
              <CardDescription>AI-generated and your own. Answer here or share the link. Comment below each question. Open suggestions with the button below.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0 items-center">
              {isOwner && (
                <Button
                  variant="outline"
                  size="default"
                  className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/30"
                  onClick={() => setSuggestionsOpen(true)}
                >
                  <Lightbulb className="w-4 h-4" />
                  Suggestions
                  {pendingSuggestions.length > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                      {pendingSuggestions.length}
                    </Badge>
                  )}
                </Button>
              )}
              {questions.length > 0 && canEditAnswers && (
                <Button
                  onClick={handleSaveDraft}
                  disabled={saveDraftMutation.isPending}
                  variant="outline"
                  className="gap-2"
                >
                  {saveDraftMutation.isPending ? "Saving..." : "Save draft"}
                </Button>
              )}
              {canGenerateQuestions && (
              <Button
                onClick={handleGenerateAiQuestions}
                disabled={generating || generateQuestionsMutation.isPending || questions.length > 0}
                className="gap-2 theme-gradient-bg text-white border-0 hover:opacity-95 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {generating || generateQuestionsMutation.isPending ? "Generating..." : "Generate AI questions"}
              </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          {questions.length === 0 && !generating && (
            <p className="text-sm text-muted-foreground">No questions yet. Generate AI questions or add your own.</p>
          )}
          {questions.map((q: ApiQuestion) => {
            const answerRow = answersData.find((a: { questionId: number }) => a.questionId === q.id) as { id: number; questionId: number } | undefined;
            const answerId = answerRow?.id;
            return (
              <div key={q.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">{q.question}</span>
                      <Badge variant="secondary" className="text-xs">
                        {q.source}
                      </Badge>
                    </div>
                    {canEditAnswers && (
                      <Textarea
                        placeholder="Your answer (or leave for respondents via share link)"
                        value={answers[q.id] ?? ""}
                        onChange={(e) => handleSaveAnswer(q.id, e.target.value)}
                        onBlur={(e) => handleSaveAnswer(q.id, e.target.value)}
                        className="mt-2 min-h-[80px] max-h-48 overflow-y-auto text-sm resize-y"
                      />
                    )}
                    {!canEditAnswers && (
                      <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{answers[q.id] || "—"}</p>
                      </div>
                    )}
                  </div>
                  {(canSuggest && answerId != null) || canEditAnswers ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label="Question actions"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {canSuggest && answerId != null && (
                          <DropdownMenuItem
                            onClick={() => setSuggestOpenForAnswerId(answerId)}
                            className="gap-2 text-foreground focus:text-foreground"
                          >
                            <PenLine className="w-3.5 h-3.5" />
                            Suggest edit
                          </DropdownMenuItem>
                        )}
                        {canEditAnswers && (
                          <DropdownMenuItem
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete question
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </div>
                {/* Comments – always visible under every question */}
                <div className="mt-3 pt-3 border-t border-border">
                  <Label className="text-xs font-medium mb-2 block flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comments ({answerId != null ? (apiCommentsByAnswerId[answerId]?.length ?? 0) : 0})
                  </Label>
                  <div className="space-y-2 mb-2 max-h-32 overflow-y-auto">
                    {answerId != null && (apiCommentsByAnswerId[answerId] ?? []).map((c) => (
                      <div key={c.id} className="p-2 rounded-md border bg-muted/30 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-xs">
                            {(c as ApiAnswerComment & { authorName?: string }).authorName ?? `User ${c.authorId}`}
                          </span>
                          <span className="text-muted-foreground text-[10px]">{c.createdAt ? formatTimeAgo(c.createdAt) : ""}</span>
                        </div>
                        <p className="mt-1 text-xs">{(c as ApiAnswerComment & { text?: string }).text ?? c.message}</p>
                        {canComment && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-6 px-1.5 text-xs text-muted-foreground"
                            onClick={() => setReplyTo({ answerId, commentId: c.id })}
                          >
                            <Reply className="w-3 h-3 mr-1" />
                            Reply
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canComment && answerId != null && replyTo?.answerId === answerId && replyTo && (
                    <div className="flex gap-2 mb-2">
                      <Input
                        placeholder="Write a reply..."
                        value={replyText[answerId as number] ?? ""}
                        onChange={(e) => setReplyText((prev) => ({ ...prev, [answerId as number]: e.target.value }))}
                        className="flex-1 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddComment(answerId, replyText[answerId as number] ?? "", replyTo.commentId)}
                        disabled={addCommentMutation.isPending || !(replyText[answerId as number] ?? "").trim()}
                        className="shrink-0"
                      >
                        Reply
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText((prev) => ({ ...prev, [answerId as number]: "" })); }}>
                        Cancel
                      </Button>
                    </div>
                  )}
                    {canComment && (
                      <div className="flex gap-2">
                        <Input
                          placeholder={answerId != null ? "Add a comment..." : "Save draft to add comments"}
                          value={answerId != null ? (newComment[answerId as number] ?? "") : ""}
                          onChange={(e) => answerId != null && setNewComment((prev) => ({ ...prev, [answerId as number]: e.target.value }))}
                          onKeyDown={(e) => e.key === "Enter" && answerId != null && handleAddComment(answerId, newComment[answerId as number] ?? "")}
                          className="flex-1 text-sm"
                          disabled={answerId == null}
                        />
                        <Button
                          size="sm"
                          onClick={() => answerId != null && handleAddComment(answerId, newComment[answerId] ?? "")}
                          disabled={answerId == null || addCommentMutation.isPending || !(newComment[answerId] ?? "").trim()}
                          className="shrink-0"
                        >
                          <Reply className="w-3.5 h-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    )}
                  </div>
              </div>
            );
          })}
          {canEditAnswers && (
            <div className="flex gap-2 pt-2">
              <Input
                placeholder="Add a question..."
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddQuestion()}
                className="flex-1"
              />
              <Button onClick={handleAddQuestion} disabled={!newQuestion.trim()} variant="outline" className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

        </div>

        {/* Suggest edit modal – opened by pen icon */}
        <Dialog open={suggestOpenForAnswerId != null} onOpenChange={(open) => { if (!open) { setSuggestOpenForAnswerId(null); setSuggestText(""); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Write suggestion</DialogTitle>
              <DialogDescription>Suggest a change to this answer. The owner can accept or reject it.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="suggest-text">Your suggested text</Label>
                <Textarea
                  id="suggest-text"
                  placeholder="Enter your suggested answer text..."
                  value={suggestText}
                  onChange={(e) => setSuggestText(e.target.value)}
                  className="min-h-[100px] text-sm resize-y"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setSuggestOpenForAnswerId(null); setSuggestText(""); }}>
                Cancel
              </Button>
              <Button onClick={handleSubmitSuggestion} disabled={createSuggestionMutation.isPending || !suggestText.trim()}>
                Submit suggestion
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Suggestions – visible to all roles; accept/reject only for owner or admin */}
        <Sheet open={suggestionsOpen} onOpenChange={setSuggestionsOpen}>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" />Suggested changes</SheetTitle>
              <SheetDescription>{pendingSuggestions.length > 0 ? (canAcceptRejectSuggestions ? "Accept or reject suggestions below." : "Pending suggestions. Owner or admin can accept or reject.") : "Anyone can suggest edits below each answer. Pending suggestions will appear here."}</SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-3">
                {pendingSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No pending suggestions.</p>
              ) : pendingSuggestions.map((s) => {
                const ans = answersData.find((a: { id: number }) => a.id === s.answerId) as { questionId?: number } | undefined;
                const qu = questions.find((q: ApiQuestion) => q.id === ans?.questionId) as ApiQuestion | undefined;
                const questionLabel = qu?.question?.slice(0, 60) ?? `Answer #${s.answerId}`;
                return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  className="p-3 rounded-lg border bg-muted/30 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                  onClick={() => setSelectedSuggestion(s)}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedSuggestion(s)}
                >
                  <p className="text-xs text-muted-foreground line-clamp-2">{questionLabel}</p>
                  <p className="text-sm line-clamp-3">{(s.suggestedText ?? "").slice(0, 200)}{(s.suggestedText?.length ?? 0) > 200 ? "..." : ""}</p>
                  {(s as AnswerSuggestion & { suggestedByName?: string }).suggestedByName && (
                    <p className="text-[10px] text-muted-foreground">By {(s as AnswerSuggestion & { suggestedByName?: string }).suggestedByName}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">Click to view full suggestion</p>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleAcceptSuggestion(s.id)} disabled={updateSuggestionMutation.isPending}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleRejectSuggestion(s.id)} disabled={updateSuggestionMutation.isPending}>
                      Reject
                    </Button>
                  </div>
                </div>
              ); })}
            </div>
          </SheetContent>
        </Sheet>

        {/* Suggestion detail modal – full suggestion when clicking a suggestion */}
        <Dialog open={!!selectedSuggestion} onOpenChange={(open) => !open && setSelectedSuggestion(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {selectedSuggestion && (() => {
              const ans = answersData.find((a: { id: number }) => a.id === selectedSuggestion.answerId) as { questionId?: number } | undefined;
              const qu = questions.find((q: ApiQuestion) => q.id === ans?.questionId) as ApiQuestion | undefined;
              const questionText = qu?.question ?? `Answer #${selectedSuggestion.answerId}`;
              const suggestedByName = (selectedSuggestion as AnswerSuggestion & { suggestedByName?: string }).suggestedByName;
              const message = (selectedSuggestion as AnswerSuggestion & { message?: string }).message;
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      Suggested change
                    </DialogTitle>
                    <DialogDescription>Full suggestion details. Accept to apply or reject to dismiss.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Question</Label>
                      <p className="mt-1 text-sm font-medium text-foreground">{questionText}</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Suggested text</Label>
                      <div className="mt-1 p-3 rounded-md border bg-muted/30 text-sm whitespace-pre-wrap break-words max-h-60 overflow-y-auto">
                        {selectedSuggestion.suggestedText ?? ""}
                      </div>
                    </div>
                    {suggestedByName && (
                      <p className="text-xs text-muted-foreground">By {suggestedByName}</p>
                    )}
                    {message && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Note from suggester</Label>
                        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="text-green-600 border-green-600"
                        onClick={() => {
                          handleAcceptSuggestion(selectedSuggestion.id);
                          setSelectedSuggestion(null);
                        }}
                        disabled={updateSuggestionMutation.isPending}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-600"
                        onClick={() => {
                          handleRejectSuggestion(selectedSuggestion.id);
                          setSelectedSuggestion(null);
                        }}
                        disabled={updateSuggestionMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <Button variant="outline" className="gap-2" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <Link href={id ? `${rfpBase}/${id}/generate` : "#"}>
          <Button className="gap-2 theme-gradient-bg text-white hover:opacity-95">
            Continue to Step 3
            <ArrowLeft className="w-4 h-4 rotate-180" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
