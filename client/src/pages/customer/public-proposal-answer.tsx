import { useState } from "react";
import { useParams } from "wouter";
import { usePublicProposalByToken, useSubmitPublicAnswers } from "@/hooks/use-proposals-api";
import { FileText, Send, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { CopyrightFooter } from "@/components/shared/copyright-footer";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function PublicProposalAnswer() {
  const params = useParams();
  const token = params?.token ?? null;
  const { data, isLoading, isError, error, refetch } = usePublicProposalByToken(token);
  const submitMutation = useSubmitPublicAnswers();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const proposal = data?.proposal;
  const questions = data?.questions ?? [];

  const handleChange = (questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = () => {
    if (!proposal || !token?.trim()) return;
    const answersList = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({ questionId: q.id, answer: answers[q.id]!.trim() }));
    if (answersList.length === 0) return;
    submitMutation.mutate(
      { token, answers: answersList },
      {
        onSuccess: () => setSubmitted(true),
        onError: () => {},
      }
    );
  };

  const saving = submitMutation.isPending;

  if (!token) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Invalid or missing link.</p>
            </CardContent>
          </Card>
        </div>
        <CopyrightFooter />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">Loading...</p>
            </CardContent>
          </Card>
        </div>
        <CopyrightFooter />
      </div>
    );
  }
  if (isError || !proposal) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6">
              {isError ? (
                <QueryErrorState
                  refetch={refetch}
                  error={error instanceof Error ? error : undefined}
                  message={error instanceof Error ? error.message : "Unable to load this proposal."}
                />
              ) : (
                <p className="text-muted-foreground text-center">This share link is invalid or has expired.</p>
              )}
            </CardContent>
          </Card>
        </div>
        <CopyrightFooter />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-muted/30">
        <div className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Thank you</h2>
              <p className="text-muted-foreground">Your answers have been submitted successfully.</p>
            </CardContent>
          </Card>
        </div>
        <CopyrightFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="border shadow-sm mb-6">
          <CardHeader className="border-b bg-muted/50">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {proposal.title}
            </CardTitle>
            {proposal.description && (
              <CardDescription className="mt-1">{proposal.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm text-muted-foreground mb-6">
              Please answer the questions below. Your responses will be saved when you submit.
            </p>
            <div className="space-y-6">
              {questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label className="text-sm font-medium">{q.question}</Label>
                  <Textarea
                    placeholder="Your answer..."
                    value={answers[q.id] ?? ""}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
              ))}
            </div>
            {questions.length === 0 && (
              <p className="text-sm text-muted-foreground">There are no questions to answer yet.</p>
            )}
            {questions.length > 0 && (
              <Button
                onClick={handleSubmit}
                disabled={saving}
                className="mt-6 w-full sm:w-auto gap-2 theme-gradient-bg text-white hover:opacity-95"
              >
                <Send className="w-4 h-4" />
                {saving ? "Saving..." : "Submit answers"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
      <CopyrightFooter />
    </div>
  );
}
