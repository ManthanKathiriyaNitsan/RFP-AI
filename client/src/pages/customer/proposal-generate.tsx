import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useProposal, useProposalQuestions, useGenerateProposalContent, useUpdateProposal, useMyCollaboration } from "@/hooks/use-proposals-api";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { ArrowLeft, FileText, Sparkles, Coins, CheckCircle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProposalStepper } from "@/components/customer/proposal-stepper";

const LOTTIE_WRITING_URL = "https://lottie.host/0e224e47-c1e5-48fb-8185-8f5de15c7dac/FUxEgboKT4.lottie";

export default function ProposalGenerate() {
  const params = useParams();
  const [location] = useLocation();
  const id = params?.id ? parseInt(params.id, 10) : null;
  const fromAdmin = location.startsWith("/admin/proposals");
  const isCollaborator = location.startsWith("/collaborator");
  const { currentRole, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const rfpBase = fromAdmin ? "/admin/proposals" : isCollaborator ? "/collaborator/rfp" : "/rfp";
  const [generatedContent, setGeneratedContent] = useState<Record<string, unknown> | null>(null);
  const [lastCreditsUsed, setLastCreditsUsed] = useState<number | null>(null);

  const credits = user?.credits ?? 0;
  const noCredits = credits <= 0;
  const isAdmin = (currentRole || "").toLowerCase() === "admin" || (currentRole || "").toLowerCase() === "super_admin";
  const noCreditsMessage = noCredits ? (isAdmin ? "Buy new credits to generate content." : "Contact your admin for more credits.") : null;
  const noCreditsHref = isAdmin ? "/admin/credits" : (currentRole === "collaborator" ? "/collaborator" : "/rfp-projects");

  const { data: proposal, isLoading: proposalLoading, isError: proposalError, error: proposalErrorObj, refetch: refetchProposal } = useProposal(id);
  const { data: myCollaboration } = useMyCollaboration(isCollaborator ? id : null);
  const { data: questionsData = [] } = useProposalQuestions(id);
  const generateMutation = useGenerateProposalContent(id ?? 0);
  const updateProposalMutation = useUpdateProposal(id ?? 0);
  const generatingDoc = generateMutation.isPending;
  const canGenerateAi = !isCollaborator || myCollaboration?.canGenerateAi === true;

  const getHomeRoute = () => {
    if (currentRole === "admin") return "/admin/proposals";
    if (currentRole === "collaborator") return "/collaborator";
    return "/rfp-projects";
  };

  const handleGenerateDocument = () => {
    if (!id || !proposal) return;
    if (noCredits) {
      toast({
        title: "No credits",
        description: noCreditsMessage ?? "You need credits to generate content.",
        variant: "destructive",
        action: (
          <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = noCreditsHref}>
            {isAdmin ? "Buy new credits" : "Go to Dashboard"}
          </Button>
        ),
      });
      return;
    }
    setGeneratedContent(null);
    generateMutation.mutate({ userId: user?.id }, {
      onSuccess: (data) => {
        const content =
          data && typeof data === "object" && (data as { content?: unknown }).content != null
            ? (data as { content: Record<string, unknown> }).content
            : (data as Record<string, unknown>);
        const creditsUsed = data && typeof (data as { creditsUsed?: number }).creditsUsed === "number" ? (data as { creditsUsed: number }).creditsUsed : null;
        if (content && typeof content === "object") {
          if (creditsUsed != null) setLastCreditsUsed(creditsUsed);
          toast({
            title: creditsUsed != null ? `AI document generated • ${creditsUsed} credit(s) used` : "AI document generated",
            description: "Your document is ready. Saving to proposal...",
          });
          queryClient.invalidateQueries({ queryKey: ["customer", "sidebar"] });
          queryClient.invalidateQueries({ queryKey: ["collaborator", "sidebar"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "sidebar"] });
          queryClient.invalidateQueries({ queryKey: ["admin", "credits"] });
          queryClient.invalidateQueries({ queryKey: ["customer", "credits", "usage"] });
          queryClient.invalidateQueries({ queryKey: ["collaborator", "credits", "usage"] });
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
          setGeneratedContent(content);
          updateProposalMutation.mutate(
            { content },
            {
              onSuccess: () => {
                const desc = creditsUsed != null
                  ? `${creditsUsed} credit(s) used for this generation. Click View Document to open it in the Content tab.`
                  : "Click View Document to open it in the Content tab.";
                toast({ title: "Document saved", description: desc });
              },
              onError: () => {
                toast({ title: "Document generated", description: "Saving to proposal failed. You can copy from below.", variant: "destructive" });
              },
            }
          );
        }
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : "Generation failed";
        const is402 = e instanceof Error && /^402:/.test(e.message);
        const creditMsg = isAdmin ? "Buy new credits to continue." : "Contact your admin for more credits.";
        toast({
          title: is402 ? "Insufficient credits" : "Error",
          description: is402 ? (message ? `${message} ${creditMsg}` : creditMsg) : message,
          variant: "destructive",
          action: is402 ? (
            <Button variant="outline" size="sm" className="bg-white text-destructive border-white/20 hover:bg-white/90" onClick={() => window.location.href = noCreditsHref}>
              {isAdmin ? "Buy new credits" : "Go to Dashboard"}
            </Button>
          ) : undefined,
        });
      },
    });
  };

  const fullDocument =
    generatedContent && typeof (generatedContent as { fullDocument?: string }).fullDocument === "string"
      ? (generatedContent as { fullDocument: string }).fullDocument
      : (generatedContent && typeof (generatedContent as { full_document?: string }).full_document === "string"
        ? (generatedContent as { full_document: string }).full_document
        : null);
  const documentLines = fullDocument ? fullDocument.split("\n") : [];

  if (proposalLoading || (!proposal && id)) {
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
        <Link href={`${rfpBase}/${id}/questions`}>
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground mb-3 sm:mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Step 2
          </Button>
        </Link>
        <ProposalStepper currentStep={3} proposalId={id} rfpBase={rfpBase} canGenerateAi={canGenerateAi} />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Generate Proposal Document</h1>
        <p className="text-muted-foreground text-sm sm:text-base mt-1">
          Create an AI-driven document from your proposal and the questions/answers.
        </p>
      </div>

      <Card className="border shadow-sm mb-4 sm:mb-6">
        <CardHeader className="border-b bg-muted/50">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Step 3 — Generate document
          </CardTitle>
          <CardDescription>
            This will build a proposal document using the details from Step 1 and the questions/answers from Step 2.
            You can view and edit it in the proposal’s Content tab after generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium text-foreground">{proposal.title}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {questionsData.length} questions · answers will be included in the document
              </p>
            </div>
            {canGenerateAi ? (
              <Button
                onClick={handleGenerateDocument}
                disabled={generatingDoc || noCredits}
                className="theme-gradient-bg text-white hover:opacity-95 gap-2 shrink-0"
                title={noCredits ? (noCreditsMessage ?? undefined) : undefined}
              >
                {generatingDoc ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Generating...
                  </>
                ) : noCredits ? (
                  <>
                    <Coins className="w-4 h-4" />
                    {isAdmin ? "No credits — buy credits" : "No credits — contact admin"}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate document
                  </>
                )}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground shrink-0">
                You don&apos;t have permission to generate AI content for this proposal.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Content-is-generating: compact status + document-style placeholder */}
      {generatingDoc && (
        <div className="animate-fade-in mb-4 sm:mb-6 rounded-xl border border-border/80 bg-card/50 shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-border/60 bg-muted/30">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">Writing your document...</p>
              <p className="text-xs text-muted-foreground mt-0.5">This usually takes a few seconds</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="inline-block h-2 w-2 rounded-full bg-primary/70 animate-pulse" style={{ animationDelay: "0.2s" }} />
              <span className="inline-block h-2 w-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 sm:p-5 min-h-[180px] flex items-center justify-center">
              <div className="w-full max-w-[280px] h-[200px]">
                <DotLottieReact
                  src={LOTTIE_WRITING_URL}
                  loop
                  autoplay
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document content shown all at once (no line-by-line animation) */}
      {!generatingDoc && generatedContent && fullDocument && documentLines.length > 0 && (
        <Card className="border shadow-sm mb-4 sm:mb-6 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-b from-emerald-50/80 to-background dark:from-emerald-950/20 dark:to-background border-b px-4 py-3 flex flex-wrap items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium text-emerald-800 dark:text-emerald-200">Your document is ready</span>
            {lastCreditsUsed != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 dark:bg-primary/20 text-primary px-2.5 py-1 text-sm font-medium border border-primary/20 ml-auto">
                <Coins className="w-3.5 h-3.5 shrink-0" />
                {lastCreditsUsed} credit{lastCreditsUsed !== 1 ? "s" : ""} used
              </span>
            )}
          </div>
          <CardContent className="p-4 sm:p-6">
            <div className="prose prose-sm sm:prose-base max-w-none text-foreground dark:prose-invert">
              <div className="space-y-0.5 font-normal text-[15px] leading-relaxed">
                {documentLines.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap">
                    {line || "\u00A0"}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback when content is structured (no fullDocument) */}
      {!generatingDoc && generatedContent && !fullDocument && (
        <Card className="border shadow-sm mb-4 sm:mb-6 overflow-hidden animate-fade-in">
          <div className="bg-gradient-to-b from-emerald-50/80 to-background dark:from-emerald-950/20 dark:to-background border-b px-4 py-3 flex flex-wrap items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-medium text-emerald-800 dark:text-emerald-200">Document generated</span>
            {lastCreditsUsed != null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/12 dark:bg-primary/20 text-primary px-2.5 py-1 text-sm font-medium border border-primary/20 ml-auto">
                <Coins className="w-3.5 h-3.5 shrink-0" />
                {lastCreditsUsed} credit{lastCreditsUsed !== 1 ? "s" : ""} used
              </span>
            )}
          </div>
          <CardContent className="p-4 sm:p-6">
            <p className="text-muted-foreground text-sm">View and edit your proposal in the Content tab.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row justify-end gap-2">
        {generatedContent && (
          <Link href={`${rfpBase}/${id}#content`}>
            <Button className="gap-2 theme-gradient-bg text-white hover:opacity-95">
              <ExternalLink className="w-4 h-4" />
              View Document
            </Button>
          </Link>
        )}
        <Link href={`${rfpBase}/${id}`}>
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            View proposal
          </Button>
        </Link>
      </div>
    </div>
  );
}
