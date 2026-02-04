import { useState, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft, CheckCircle, X, Lock, Unlock, Filter, Search,
  FileText, MessageSquare, Clock, User
} from "lucide-react";
import { useMyCollaboration, useProposalQuestions, useProposalAnswers } from "@/hooks/use-proposals-api";
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
  questionId: number;
  question: string;
  answer: string;
  status: "approved" | "pending" | "draft" | "rejected";
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
  const { data: myCollaboration } = useMyCollaboration(isCollaborator ? proposalId : null);
  const { data: questions = [] } = useProposalQuestions(proposalId);
  const { data: answersFromApi = [], isLoading: answersLoading } = useProposalAnswers(proposalId);
  const canReview = !isCollaborator || myCollaboration?.canReview === true;
  const canComment = !isCollaborator || myCollaboration?.canComment === true;
  const rfpBase = location.startsWith("/admin/proposals") ? "/admin/proposals" : isCollaborator ? "/collaborator/rfp" : "/rfp";
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [localOverrides, setLocalOverrides] = useState<{
    status: Record<number, "approved" | "rejected">;
    locked: Set<number>;
    comments: Record<number, { id: number; author: string; text: string; createdAt: Date }[]>;
  }>({ status: {}, locked: new Set(), comments: {} });
  const [newComment, setNewComment] = useState<{ [key: number]: string }>({});

  const answers: ReviewAnswerItem[] = useMemo(() => {
    return questions.map((q) => {
      const ans = answersFromApi.find((a) => a.questionId === q.id);
      const key = ans?.id ?? q.id;
      const localStatus = localOverrides.status[key];
      const status = localStatus ?? (ans ? "pending" : "draft");
      return {
        id: key,
        questionId: q.id,
        question: q.question,
        answer: ans?.answer ?? "",
        status: status as "approved" | "pending" | "draft" | "rejected",
        submittedAt: ans?.updatedAt ? new Date(ans.updatedAt) : null,
        locked: localOverrides.locked.has(key),
        comments: localOverrides.comments[key] ?? [],
      };
    });
  }, [questions, answersFromApi, localOverrides]);

  const filteredAnswers = answers.filter((answer) => {
    const matchesSearch = !searchTerm || 
      answer.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      answer.answer.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || answer.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "badge-status-success";
      case "pending":
        return "badge-status-warning";
      case "draft":
        return "badge-status-info";
      case "rejected":
        return "badge-status-error";
      default:
        return "badge-status-neutral";
    }
  };

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

  const handleApprove = (answerId: number) => {
    setLocalOverrides((prev) => ({ ...prev, status: { ...prev.status, [answerId]: "approved" } }));
    toast({ title: "Answer approved", description: "The answer has been approved." });
  };

  const handleReject = (answerId: number) => {
    setLocalOverrides((prev) => ({ ...prev, status: { ...prev.status, [answerId]: "rejected" } }));
    toast({ title: "Answer rejected", description: "The answer has been rejected.", variant: "destructive" });
  };

  const handleLock = (answerId: number) => {
    setLocalOverrides((prev) => {
      const next = new Set(prev.locked);
      if (next.has(answerId)) next.delete(answerId);
      else next.add(answerId);
      return { ...prev, locked: next };
    });
    const item = answers.find((a) => a.id === answerId);
    toast({
      title: item?.locked ? "Unlocked" : "Locked",
      description: `Answer has been ${item?.locked ? "unlocked" : "locked"}.`,
    });
  };

  const handleAddComment = (answerId: number) => {
    const comment = newComment[answerId];
    if (!comment || !comment.trim()) return;
    const answer = answers.find((a) => a.id === answerId);
    if (answer) {
      const newCommentObj = { id: answer.comments.length + 1, author: "You", text: comment.trim(), createdAt: new Date() };
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
  };

  const approvedCount = answers.filter(a => a.status === "approved").length;
  const pendingCount = answers.filter(a => a.status === "pending").length;

  return (
    <div className="space-y-4 sm:space-y-6">
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
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search answers..."
                className="pl-10 text-sm sm:text-base"
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
                    <Badge className={`${getStatusColor(answer.status)} text-[10px] sm:text-xs`}>
                      {getStatusLabel(answer.status)}
                    </Badge>
                    {answer.locked && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs">
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
                      onClick={() => handleLock(answer.id)}
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
                <div className="p-3 sm:p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm whitespace-pre-wrap">{answer.answer}</p>
                </div>
              </div>

              {/* Comments */}
              <div>
                <Label className="text-xs sm:text-sm mb-2 block">Comments</Label>
                <div className="space-y-2 mb-3">
                  {answer.comments.map((comment) => (
                    <div key={comment.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatTimeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm">{comment.text}</p>
                    </div>
                  ))}
                </div>
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
                      className="text-xs sm:text-sm"
                    >
                      <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}
              </div>

              {/* Actions: Approve / Reject — only when canReview */}
              {canReview && answer.status !== "approved" && !answer.locked && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm text-green-600 border-green-600"
                    onClick={() => handleApprove(answer.id)}
                  >
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs sm:text-sm text-red-600 border-red-600"
                    onClick={() => handleReject(answer.id)}
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
