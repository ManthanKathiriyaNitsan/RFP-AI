import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation, Link } from "wouter";
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
} from "@/hooks/use-proposals-api";
import {
  ArrowLeft,
  Sparkles,
  Plus,
  X,
  Link2,
  Copy,
  FileText,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { ProposalStepper } from "@/components/customer/proposal-stepper";
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

  // Rehydrate answers from backend (draft or answers list). Backend overrides empty frontend state.
  useEffect(() => {
    if (!questions.length) return;
    const map: Record<number, string> = {};
    if (draft?.answers?.length) {
      draft.answers.forEach((a) => {
        map[a.questionId] = a.answer ?? "";
      });
    } else {
      questions.forEach((q) => {
        const a = answerByQuestionId[q.id];
        if (a?.trim()) map[q.id] = a;
      });
    }
    setAnswers(map);
  }, [questions, draft?.answers, answerByQuestionId]);

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
      <div className="max-w-4xl mx-auto px-4 py-8">
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
              <CardDescription>AI-generated and your own. Answer here or share the link.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
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
          {questions.map((q: ApiQuestion) => (
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
                      className="mt-2 min-h-[80px] text-sm"
                    />
                  )}
                  {!canEditAnswers && (
                    <p className="text-sm text-muted-foreground mt-1">{answers[q.id] || "—"}</p>
                  )}
                </div>
                {canEditAnswers && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveQuestion(q.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
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

      <div className="flex flex-wrap items-center justify-between gap-3">
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
