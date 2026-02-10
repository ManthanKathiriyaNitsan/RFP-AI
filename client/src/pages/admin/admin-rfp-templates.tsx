import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/use-confirm";
import {
  fetchAdminRfpTemplates,
  createAdminRfpTemplate,
  updateAdminRfpTemplate,
  deleteAdminRfpTemplate,
  type RfpTemplateItem,
  type RfpTemplateQuestion,
} from "@/api/admin-data";
import { FileText, Plus, Pencil, Trash2, Lock, Unlock, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/shared/query-error-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AdminRfpTemplates() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin", "rfp-templates"],
    queryFn: fetchAdminRfpTemplates,
  });

  const templates = data?.templates ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<RfpTemplateItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mandatorySections, setMandatorySections] = useState<string[]>([]);
  const [questionSet, setQuestionSet] = useState<RfpTemplateQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setName("");
    setDescription("");
    setMandatorySections([""]);
    setQuestionSet([{ question: "", order: 0 }]);
    setEditTemplate(null);
    setCreateOpen(true);
  };

  const openEdit = (t: RfpTemplateItem) => {
    setEditTemplate(t);
    setName(t.name);
    setDescription(t.description ?? "");
    setMandatorySections(t.mandatorySections?.length ? t.mandatorySections : [""]);
    setQuestionSet(t.questionSet?.length ? t.questionSet : [{ question: "", order: 0 }]);
    setCreateOpen(false);
  };

  const closeEdit = () => {
    setEditTemplate(null);
    setName("");
    setDescription("");
    setMandatorySections([]);
    setQuestionSet([]);
  };

  const addMandatorySection = () => setMandatorySections((prev) => [...prev, ""]);
  const setMandatorySectionAt = (i: number, v: string) => {
    setMandatorySections((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  };
  const removeMandatorySection = (i: number) => {
    setMandatorySections((prev) => prev.filter((_, idx) => idx !== i));
  };

  const addQuestion = () => setQuestionSet((prev) => [...prev, { question: "", order: prev.length }]);
  const setQuestionAt = (i: number, q: string) => {
    setQuestionSet((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], question: q };
      return next;
    });
  };
  const removeQuestion = (i: number) => {
    setQuestionSet((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    const sections = mandatorySections.map((s) => s.trim()).filter(Boolean);
    const questions = questionSet.map((q, i) => ({ question: q.question.trim(), order: i })).filter((q) => q.question);

    setSaving(true);
    if (editTemplate) {
      const updated = await updateAdminRfpTemplate(editTemplate.id, {
        name: trimmedName,
        description: description.trim() || undefined,
        mandatorySections: sections,
        questionSet: questions,
      });
      setSaving(false);
      if (updated) {
        qc.invalidateQueries({ queryKey: ["admin", "rfp-templates"] });
        closeEdit();
        toast({ title: "Template updated", description: trimmedName });
      } else {
        toast({ title: "Failed to update template", variant: "destructive" });
      }
    } else {
      const created = await createAdminRfpTemplate({
        name: trimmedName,
        description: description.trim() || undefined,
        mandatorySections: sections,
        questionSet: questions,
      });
      setSaving(false);
      if (created) {
        qc.invalidateQueries({ queryKey: ["admin", "rfp-templates"] });
        setCreateOpen(false);
        toast({ title: "Template created", description: trimmedName });
      } else {
        toast({ title: "Failed to create template", variant: "destructive" });
      }
    }
  };

  const handleLockToggle = async (t: RfpTemplateItem) => {
    const updated = await updateAdminRfpTemplate(t.id, { locked: !t.locked });
    if (updated) {
      qc.invalidateQueries({ queryKey: ["admin", "rfp-templates"] });
      toast({ title: t.locked ? "Template unlocked" : "Template locked" });
    } else {
      toast({ title: "Failed to update lock", variant: "destructive" });
    }
  };

  const handleDelete = async (t: RfpTemplateItem) => {
    if (t.locked) {
      toast({ title: "Unlock the template first", variant: "destructive" });
      return;
    }
    const ok = await confirm({ title: "Delete template?", description: `Remove "${t.name}"? This cannot be undone.` });
    if (!ok) return;
    const deleted = await deleteAdminRfpTemplate(t.id);
    if (deleted) {
      qc.invalidateQueries({ queryKey: ["admin", "rfp-templates"] });
      toast({ title: "Template deleted", variant: "destructive" });
    } else {
      toast({ title: "Failed to delete template", variant: "destructive" });
    }
  };

  if (isError) {
    return (
      <div className="p-4">
        <QueryErrorState refetch={refetch} error={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">RFP Templates</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Global RFP templates, default question sets, and mandatory sections. Lock templates to prevent edits.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Create template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </CardTitle>
          <CardDescription>Use these templates as defaults for new RFPs. Locked templates cannot be edited or deleted.</CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No templates yet. Create one to define default question sets and mandatory sections.</p>
          ) : (
            <div className="space-y-3">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.name}</span>
                      {t.locked && <Badge variant="secondary" className="text-[10px]">Locked</Badge>}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {t.mandatorySections?.length ?? 0} mandatory sections • {t.questionSet?.length ?? 0} questions
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleLockToggle(t)} title={t.locked ? "Unlock" : "Lock"}>
                      {t.locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(t)} disabled={t.locked}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDelete(t)} disabled={t.locked}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create RFP template</DialogTitle>
            <DialogDescription>Define name, mandatory sections, and default question set for new RFPs.</DialogDescription>
          </DialogHeader>
          <TemplateForm
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            mandatorySections={mandatorySections}
            addMandatorySection={addMandatorySection}
            setMandatorySectionAt={setMandatorySectionAt}
            removeMandatorySection={removeMandatorySection}
            questionSet={questionSet}
            addQuestion={addQuestion}
            setQuestionAt={setQuestionAt}
            removeQuestion={removeQuestion}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTemplate} onOpenChange={(open) => !open && closeEdit()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit RFP template</DialogTitle>
            <DialogDescription>Update mandatory sections and question set. Template must be unlocked to edit.</DialogDescription>
          </DialogHeader>
          <TemplateForm
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            mandatorySections={mandatorySections}
            addMandatorySection={addMandatorySection}
            setMandatorySectionAt={setMandatorySectionAt}
            removeMandatorySection={removeMandatorySection}
            questionSet={questionSet}
            addQuestion={addQuestion}
            setQuestionAt={setQuestionAt}
            removeQuestion={removeQuestion}
          />
          <DialogFooter>
            <Button variant="outline" onClick={closeEdit}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog />
    </div>
  );
}

function TemplateForm({
  name,
  setName,
  description,
  setDescription,
  mandatorySections,
  addMandatorySection,
  setMandatorySectionAt,
  removeMandatorySection,
  questionSet,
  addQuestion,
  setQuestionAt,
  removeQuestion,
}: {
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  mandatorySections: string[];
  addMandatorySection: () => void;
  setMandatorySectionAt: (i: number, v: string) => void;
  removeMandatorySection: (i: number) => void;
  questionSet: RfpTemplateQuestion[];
  addQuestion: () => void;
  setQuestionAt: (i: number, v: string) => void;
  removeQuestion: (i: number) => void;
}) {
  return (
    <div className="space-y-4 py-4">
      <div>
        <Label>Name</Label>
        <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard RFP" />
      </div>
      <div>
        <Label>Description (optional)</Label>
        <Textarea className="mt-1.5" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief description" />
      </div>
      <div>
        <Label>Mandatory sections</Label>
        <p className="text-xs text-muted-foreground mb-1">Section titles that must appear in every RFP using this template.</p>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {mandatorySections.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input value={s} onChange={(e) => setMandatorySectionAt(i, e.target.value)} placeholder="Section title" />
              <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeMandatorySection(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addMandatorySection}>
            <Plus className="w-4 h-4 mr-1" /> Add section
          </Button>
        </div>
      </div>
      <div>
        <Label>Default question set</Label>
        <p className="text-xs text-muted-foreground mb-1">Default questions for proposals created from this template.</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {questionSet.map((q, i) => (
            <div key={i} className="flex gap-2">
              <Input value={q.question} onChange={(e) => setQuestionAt(i, e.target.value)} placeholder={`Question ${i + 1}`} />
              <Button type="button" variant="ghost" size="icon" className="text-destructive shrink-0" onClick={() => removeQuestion(i)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="w-4 h-4 mr-1" /> Add question
          </Button>
        </div>
      </div>
    </div>
  );
}
