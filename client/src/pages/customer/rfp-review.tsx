import { useState, useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft, CheckCircle, X, Lock, Unlock, Filter, Search,
  FileText, MessageSquare, Clock, User, Reply
} from "lucide-react";
import { useProposal, useMyCollaboration, useProposalQuestions, useProposalAnswers, useAddAnswerComment, useProposalSuggestions, useUpdateSuggestionStatus, proposalKeys } from "@/hooks/use-proposals-api";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { fetchAnswerComments, patchAnswerStatus, type AnswerStatus } from "@/api/proposals";
import type { AnswerComment } from "@/api/proposals";
import type { AnswerSuggestion } from "@/api/proposals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { getAnswerStatusBadgeClass, answerStatusBadgeClasses } from "@/lib/badge-classes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type ReviewAnswerItem = {
  id: number;
  answerId: number | null; // API answer id (null when no answer saved yet)
  questionId: number;
  question: string;
  answer: string;
  status: "approved" | "pending" | "draft" | "rejected" | "locked";
  submittedAt: Date | null;
  locked: boolean;
  comments: { id: number; author: string; text: string; createdAt: Date }[];
};

export default function RFPReview() {
  const params = useParams();
  const [location] = useLocation();
  const rfpId = params.id;
  const proposalId = rfpId ? parseInt(rfpId, 10) : null;
  const isCollaborator = location.startsWith("/collaborator");
  const { data: proposal, isError: proposalError, error: proposalErrorObj, refetch: refetchProposal } = useProposal(proposalId);
  const { data: myCollaboration } = useMyCollaboration(isCollaborator ? proposalId : null);
  const { data: questions = [] } = useProposalQuestions(proposalId);
  const { data: answersFromApi = [], isLoading: answersLoading } = useProposalAnswers(proposalId);
  const canReview = !isCollaborator || myCollaboration?.canReview === true;
  const canComment = true;
  const rfpBase = location.startsWith("/admin/proposals") ? "/admin/proposals" : isCollaborator ? "/collaborator/rfp" : "/rfp";
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localOverrides, setLocalOverrides] = useState<{
    comments: Record<number, { id: number; author: string; text: string; createdAt: Date }[]>;
  }>({ comments: {} });
  const [newComment, setNewComment] = useState<{ [key: number]: string }>({});
  const [replyTo, setReplyTo] = useState<{ answerId: number; commentId: number } | null>(null);
  const [replyText, setReplyText] = useState<{ [key: number]: string }>({});
  const queryClient = useQueryClient();
  const statusMutation = useMutation({
    mutationFn: ({ answerId, status }: { answerId: number; status: AnswerStatus }) =>
      patchAnswerStatus(proposalId!, answerId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: proposalKeys.answers(proposalId!) });
      toast({ title: "Status updated" });
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const answerIds = useMemo(() => questions.map((q) => {
    const ans = answersFromApi.find((a) => a.questionId === q.id);
    return ans?.id ?? q.id;
  }), [questions, answersFromApi]);
  const commentQueries = useQueries({
    queries: (proposalId != null ? answerIds : []).map((answerId: number) => ({
      queryKey: proposalKeys.answerComments(proposalId!, answerId),
      queryFn: () => fetchAnswerComments(proposalId!, answerId),
      enabled: !!proposalId && !!answerId,
    })),
  });
  const apiCommentsByAnswerId = useMemo(() => {
    const map: Record<number, AnswerComment[]> = {};
    commentQueries.forEach((q, i: number) => {
      const aid = answerIds[i];
      if (aid == null) return;
      const raw = q.data;
      const listRaw = Array.isArray(raw)
        ? raw
        : (raw && typeof raw === "object" && (raw as { comments?: unknown }).comments != null)
          ? (raw as { comments: unknown }).comments
          : [];
      const list: AnswerComment[] = Array.isArray(listRaw) ? listRaw : [];
      const flat: AnswerComment[] = [];
      list.forEach((c: AnswerComment) => {
        flat.push(c);
        const repliesRaw = (c as AnswerComment & { replies?: unknown }).replies;
        const replies: AnswerComment[] = Array.isArray(repliesRaw) ? repliesRaw : [];
        replies.forEach((r: AnswerComment) => flat.push(r));
      });
      flat.sort((a, b) => new Date((a as AnswerComment & { createdAt?: string }).createdAt ?? 0).getTime() - new Date((b as AnswerComment & { createdAt?: string }).createdAt ?? 0).getTime());
      map[aid] = flat;
    });
    return map;
  }, [commentQueries, answerIds]);

  const answers: ReviewAnswerItem[] = useMemo(() => {
    return questions.map((q) => {
      const ans = answersFromApi.find((a) => a.questionId === q.id);
      const key = ans?.id ?? q.id;
      const apiStatus = (ans?.status ?? "draft") as AnswerStatus;
      const displayStatus =
        apiStatus === "locked"
          ? "locked"
          : apiStatus === "submitted"
            ? "pending"
            : (apiStatus as "approved" | "draft" | "rejected");
      return {
        id: key,
        answerId: ans?.id ?? null,
        questionId: q.id,
        question: q.question,
        answer: ans?.answer ?? "",
        status: displayStatus,
        submittedAt: ans?.updatedAt != null ? new Date(ans.updatedAt) : null,
        locked: apiStatus === "locked",
        comments: (apiCommentsByAnswerId[key] ?? []).map((c) => ({
          id: c.id,
          author: c.authorName ?? "Unknown",
          text: c.text ?? c.message ?? "",
          createdAt: new Date(c.createdAt ?? ""),
        })).concat(localOverrides.comments[key] ?? []),
      };
    });
  }, [questions, answersFromApi, localOverrides.comments, apiCommentsByAnswerId]);

  const filteredAnswers = answers.filter((answer) => {
    const matchesSearch = !searchTerm || 
      answer.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      answer.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || answer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => getAnswerStatusBadgeClass(status);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Approved";
      case "pending":
        return "Pending Review";
      case "draft":
        return "Draft";
      case "rejected":
        return "Rejected";
      case "locked":
        return "Locked";
      default:
        return status;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const past = new Date(date);
    const diffInHours = Math.floor((now.getTime() - past.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return "Less than an hour ago";
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const handleApprove = (answer: ReviewAnswerItem) => {
    if (answer.answerId == null || proposalId == null) return;
    statusMutation.mutate({ answerId: answer.answerId, status: "approved" });
  };

  const handleReject = (answer: ReviewAnswerItem) => {
    if (answer.answerId == null || proposalId == null) return;
    statusMutation.mutate({ answerId: answer.answerId, status: "rejected" });
  };

  const handleLock = (answer: ReviewAnswerItem) => {
    if (answer.answerId == null || proposalId == null) return;
    statusMutation.mutate({
      answerId: answer.answerId,
      status: answer.locked ? "submitted" : "locked",
    });
  };

  const addCommentMutation = useAddAnswerComment(proposalId ?? 0);

  const handleAddComment = (answerId: number, parentId?: number | null) => {
    const text = parentId != null ? replyText[answerId] : newComment[answerId];
    if (!text || !text.trim()) return;
    if (proposalId != null) {
      addCommentMutation.mutate(
        { answerId, text: text.trim(), parentId: parentId ?? null },
        {
          onSuccess: () => {
            if (parentId != null) {
              setReplyTo(null);
              setReplyText((prev) => ({ ...prev, [answerId]: "" }));
            } else {
              setNewComment((prev) => ({ ...prev, [answerId]: "" }));
            }
            toast({ title: "Comment added", description: "Your comment has been added." });
          },
          onError: (e) => {
            const answer = answers.find((a) => a.id === answerId);
            const newCommentObj = { id: (answer?.comments.length ?? 0) + 1, author: "You", text: text.trim(), createdAt: new Date() };
            setLocalOverrides((prev) => ({
              ...prev,
              comments: {
                ...prev.comments,
                [answerId]: [...(prev.comments[answerId] ?? []), newCommentObj],
              },
            }));
            if (parentId != null) setReplyTo(null);
            setNewComment((prev) => ({ ...prev, [answerId]: "" }));
            setReplyText((prev) => ({ ...prev, [answerId]: "" }));
            toast({ title: "Comment saved locally", description: "Backend may not be available; comment saved locally.", variant: "destructive" });
          },
        }
      );
    } else {
      const answer = answers.find((a) => a.id === answerId);
      if (answer) {
        const newCommentObj = { id: answer.comments.length + 1, author: "You", text: text.trim(), createdAt: new Date() };
        setLocalOverrides((prev) => ({
          ...prev,
          comments: {
            ...prev.comments,
            [answerId]: [...(prev.comments[answerId] ?? []), newCommentObj],
          },
        }));
        setNewComment((prev) => ({ ...prev, [answerId]: "" }));
        toast({ title: "Comment added", description: "Your comment has been added." });
      }
    }
  };

  const approvedCount = answers.filter(a => a.status === "approved").length;
  const pendingCount = answers.filter(a => a.status === "pending").length;

  const { data: suggestionsData } = useProposalSuggestions(proposalId);
  const suggestionsList = useMemo(() => {
    const raw = suggestionsData ?? null;
    if (Array.isArray(raw)) return raw as AnswerSuggestion[];
    if (raw && typeof raw === "object" && Array.isArray((raw as { suggestions?: AnswerSuggestion[] }).suggestions)) {
      return (raw as { suggestions: AnswerSuggestion[] }).suggestions;
    }
    return [];
  }, [suggestionsData]);
  const updateSuggestionMutation = useUpdateSuggestionStatus(proposalId ?? 0);
  const pendingSuggestions = useMemo(() => suggestionsList.filter((s) => s.status === "pending"), [suggestionsList]);
  const isOwner = !isCollaborator;

  const handleAcceptSuggestion = (suggestionId: number) => {
    updateSuggestionMutation.mutate(
      { suggestionId, status: "accepted" },
      { onSuccess: () => toast({ title: "Suggestion accepted" }), onError: () => toast({ title: "Failed to accept", variant: "destructive" }) }
    );
  };
  const handleRejectSuggestion = (suggestionId: number) => {
    updateSuggestionMutation.mutate(
      { suggestionId, status: "rejected" },
      { onSuccess: () => toast({ title: "Suggestion rejected" }), onError: () => toast({ title: "Failed to reject", variant: "destructive" }) }
    );
  };

  if (proposalId && proposalError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetchProposal} error={proposalErrorObj} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <Link href={rfpId ? `${rfpBase}/${rfpId}` : "#"}>
            <Button variant="ghost" size="sm" className="mb-2 text-xs sm:text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to RFP
            </Button>
          </Link>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">
            Review & Approval
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {isCollaborator && !canReview && !canComment
              ? "You have view-only access to this review page."
              : "Review and approve answers for your RFP"}
          </p>
        </div>
      </div>

      {/* Suggested changes (owner only) */}
      {isOwner && pendingSuggestions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Suggested changes</CardTitle>
            <p className="text-xs text-muted-foreground">Collaborators have suggested edits. Accept to apply or reject.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingSuggestions.map((s) => {
              const answerRow = answers.find((a) => a.id === s.answerId || a.questionId === s.answerId);
              const questionLabel = answerRow?.question ?? questions.find((q) => q.id === s.answerId)?.question ?? `Answer #${s.answerId}`;
              return (
                <div key={s.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{questionLabel.slice(0, 80)}...</p>
                  <p className="text-sm">{(s.suggestedText ?? "").slice(0, 200)}{(s.suggestedText?.length ?? 0) > 200 ? "..." : ""}</p>
                  {(s as AnswerSuggestion & { message?: string }).message ? <p className="text-xs text-muted-foreground">Note: {(s as AnswerSuggestion & { message?: string }).message}</p> : null}
                  <p className="text-xs text-muted-foreground">By {String((s as AnswerSuggestion & { suggestedByName?: string }).suggestedByName ?? "Unknown")}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleAcceptSuggestion(s.id)} disabled={updateSuggestionMutation.isPending}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleRejectSuggestion(s.id)} disabled={updateSuggestionMutation.isPending}>
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{answers.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {answers.reduce((sum, a) => sum + a.comments.length, 0)}
                </p>
                <p className="text-xs text-muted-foreground">Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="search-box flex-1">
              <Search className="search-box-icon" />
              <Input
                placeholder="Search answers..."
                className="text-sm sm:text-base"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40 text-sm sm:text-base">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Answers List */}
      <div className="space-y-4">
        {filteredAnswers.map((answer) => (
          <Card key={answer.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 sm:gap-3 mb-2">
                    <Badge variant="outline" className={`${getStatusColor(answer.status)} text-[10px] sm:text-xs`}>
                      {getStatusLabel(answer.status)}
                    </Badge>
                    {answer.locked && (
                      <Badge variant="outline" className={`${answerStatusBadgeClasses.locked} text-[10px] sm:text-xs`}>
                        <Lock className="w-3 h-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base mb-2">
                    Question {answer.questionId}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">{answer.question}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {answer.submittedAt && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          <span>Submitted</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(answer.submittedAt)}</span>
                        </div>
                      </>
                    )}
                    {answer.status === "approved" && (
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3" />
                        <span>Approved by you</span>
                      </div>
                    )}
                  </div>
                </div>
                {canReview && (
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleLock(answer)}
                      disabled={answer.answerId == null || statusMutation.isPending}
                      title={answer.answerId == null ? "Save answer first to lock" : answer.locked ? "Unlock" : "Lock"}
                    >
                      {answer.locked ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
              <div>
                <Label className="text-xs sm:text-sm mb-2 block">Answer</Label>
                <div className="p-3 sm:p-4 rounded-lg border bg-muted/30 max-h-48 sm:max-h-64 overflow-y-auto">
                  <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
                </div>
              </div>

              {/* Comments (with reply threads) */}
              <div>
                <Label className="text-xs sm:text-sm mb-2 block">Comments</Label>
                <div className="space-y-2 mb-3 max-h-48 sm:max-h-64 overflow-y-auto">
                  {answer.comments.map((comment) => (
                    <div key={comment.id} className={cn("p-3 rounded-lg border bg-muted/30", (apiCommentsByAnswerId[answer.id]?.some((c) => c.id === comment.id) || apiCommentsByAnswerId[answer.id]?.some((c) => (c.replies ?? []).some((r: import("@/api/proposals").AnswerComment) => r.id === comment.id))) ? "" : "border-l-4 border-l-primary/50")}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                      {canComment && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 text-xs text-muted-foreground"
                          onClick={() => setReplyTo({ answerId: answer.id, commentId: comment.id })}
                        >
                          <Reply className="w-3 h-3 mr-1" />
                          Reply
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {canComment && replyTo?.answerId === answer.id && (
                  <div className="flex gap-2 mb-2">
                    <Textarea
                      placeholder="Write a reply..."
                      value={replyText[answer.id] || ""}
                      onChange={(e) => setReplyText({ ...replyText, [answer.id]: e.target.value })}
                      className="flex-1 text-sm min-h-[60px]"
                    />
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        onClick={() => handleAddComment(answer.id, replyTo.commentId)}
                        disabled={addCommentMutation.isPending || !(replyText[answer.id] ?? "").trim()}
                        className="text-xs sm:text-sm"
                      >
                        Reply
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setReplyText((prev) => ({ ...prev, [answer.id]: "" })); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
                {canComment && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={newComment[answer.id] || ""}
                      onChange={(e) => setNewComment({ ...newComment, [answer.id]: e.target.value })}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(answer.id);
                        }
                      }}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddComment(answer.id)}
                      disabled={addCommentMutation.isPending}
                      className="text-xs sm:text-sm"
                    >
                      <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Actions: Approve / Reject — only when canReview and answer is saved */}
              {canReview && answer.status !== "approved" && !answer.locked && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm text-green-600 border-green-600"
                    onClick={() => handleApprove(answer)}
                    disabled={answer.answerId == null || statusMutation.isPending}
                    title={answer.answerId == null ? "Save answer first to approve" : "Approve"}
                  >
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm text-red-600 border-red-600"
                    onClick={() => handleReject(answer)}
                    disabled={answer.answerId == null || statusMutation.isPending}
                    title={answer.answerId == null ? "Save answer first to reject" : "Reject"}
                  >
                    <X className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
