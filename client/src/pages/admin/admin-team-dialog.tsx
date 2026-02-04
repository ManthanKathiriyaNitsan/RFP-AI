import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest } from "@/lib/queryClient";

interface TeamCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: any[];
  onSuccess: () => void;
}

export function TeamCreationDialog({ open, onOpenChange, users, onSuccess }: TeamCreationDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    selectedMembers: [] as number[],
  });
  const [submitting, setSubmitting] = useState(false);

  const handleMemberToggle = (userId: number) => {
    setFormData(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.includes(userId)
        ? prev.selectedMembers.filter(id => id !== userId)
        : [...prev.selectedMembers, userId],
    }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a team name.",
        variant: "destructive",
      });
      return;
    }

    if (formData.selectedMembers.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one team member.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/v1/teams", {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        memberIds: formData.selectedMembers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { detail?: string }).detail || res.statusText);
      }
      onSuccess();
      setFormData({ name: "", description: "", selectedMembers: [] });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Failed to create team",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Create New Team</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Create a new team and assign members
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label className="text-xs sm:text-sm">Team Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter team name"
              className="text-sm sm:text-base"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Team description (optional)"
              className="text-sm sm:text-base"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Select Members *</Label>
            <div className="mt-2 space-y-2 max-h-40 sm:max-h-48 overflow-y-auto border rounded-lg p-2">
              {users.length === 0 ? (
                <p className="text-xs sm:text-sm text-muted-foreground py-2">
                  No users available. Load the Users tab first or sign in as admin to see the list.
                </p>
              ) : (
                users.slice(0, 50).map((user) => (
                  <div
                    key={user.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleMemberToggle(user.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleMemberToggle(user.id);
                      }
                    }}
                    className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/60 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <Checkbox
                      id={`member-${user.id}`}
                      checked={formData.selectedMembers.includes(user.id)}
                      onCheckedChange={() => handleMemberToggle(user.id)}
                    />
                    <label htmlFor={`member-${user.id}`} className="text-xs sm:text-sm cursor-pointer truncate flex-1">
                      {user.name} ({user.email})
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => {
            setFormData({ name: "", description: "", selectedMembers: [] });
            onOpenChange(false);
          }} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto text-xs sm:text-sm">
            {submitting ? "Creating…" : "Create Team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
