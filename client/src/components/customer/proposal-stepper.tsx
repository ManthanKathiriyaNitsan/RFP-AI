import { Link } from "wouter";
import { FileText, Link2, Sparkles, Check } from "lucide-react";

const steps = [
  { id: 1, label: "Create proposal", shortLabel: "Create", icon: FileText, path: "/proposals/new" as const },
  { id: 2, label: "Questions & share link", shortLabel: "Questions", icon: Link2, path: (id: number, base: string) => `${base}/${id}/questions` },
  { id: 3, label: "Generate document", shortLabel: "Generate", icon: Sparkles, path: (id: number, base: string) => `${base}/${id}/generate` },
] as const;

interface ProposalStepperProps {
  currentStep: 1 | 2 | 3;
  proposalId?: number | null;
  /** Base path for RFP routes (e.g. "/rfp" or "/collaborator/rfp"). Default "/rfp". */
  rfpBase?: string;
  /** When false, step 3 (Generate) is shown as disabled (e.g. for view-only collaborators). */
  canGenerateAi?: boolean;
}

export function ProposalStepper({ currentStep, proposalId, rfpBase = "/rfp", canGenerateAi = true }: ProposalStepperProps) {
  const progressPercent = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="w-full mb-6">
      <div className="flex items-center justify-between relative px-2 sm:px-4">
        {/* Background connector line */}
        <div
          className="absolute left-5 right-5 top-5 h-0.5 bg-border -translate-y-1/2 rounded-full overflow-hidden"
          style={{ zIndex: 0 }}
          aria-hidden
        />
        {/* Progress fill (completed segment) */}
        <div
          className="absolute left-5 top-5 h-0.5 bg-emerald-500/60 dark:bg-emerald-400/50 -translate-y-1/2 rounded-l-full transition-all duration-300"
          style={{ zIndex: 1, width: `${progressPercent}%` }}
          aria-hidden
        />
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep;
          const isCurrent = step.id === currentStep;
          const isUpcoming = step.id > currentStep;
          const stepPath = typeof step.path === "function" ? (proposalId ? step.path(proposalId, rfpBase) : "#") : step.path;
          const stepDisabled = step.id === 3 && !canGenerateAi;
          const canNavigate = !stepDisabled && isCompleted && (step.id === 1 || (step.id > 1 && proposalId));
          const StepIcon = step.icon;

          return (
            <div
              key={step.id}
              className="relative z-10 flex flex-col items-center flex-1"
            >
              <div className="flex flex-col items-center gap-2">
                {canNavigate ? (
                  <Link
                    href={stepPath}
                    className="flex flex-col items-center gap-2 group no-underline focus:outline-none"
                  >
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500"
                          : isCurrent
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/25 ring-4 ring-primary/20"
                          : "bg-muted/50 border-border text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium text-center max-w-[80px] sm:max-w-none ${
                        isCurrent
                          ? "text-primary"
                          : isCompleted
                          ? "text-emerald-600 dark:text-emerald-400 group-hover:underline"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.shortLabel}
                    </span>
                  </Link>
                ) : (
                  <div
                    className={`flex flex-col items-center gap-2 ${stepDisabled ? "opacity-60" : ""}`}
                    title={stepDisabled ? "You don't have permission to generate AI content" : undefined}
                  >
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                        stepDisabled
                          ? "bg-muted/50 border-border text-muted-foreground cursor-not-allowed"
                          : isCompleted
                          ? "bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500"
                          : isCurrent
                          ? "bg-primary border-primary text-white shadow-lg shadow-primary/25 ring-4 ring-primary/20"
                          : "bg-muted/50 border-border text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-5 h-5" strokeWidth={2.5} />
                      ) : (
                        <StepIcon className="w-5 h-5" />
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium text-center max-w-[80px] sm:max-w-none ${
                        isCurrent
                          ? "text-primary"
                          : isCompleted
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.shortLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
