import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { fetchAdminOptions } from "@/api/admin-data";
import { getApiUrl } from "@/lib/api";
import { apiRequest } from "@/lib/queryClient";
import { parseApiError } from "@/lib/utils";
import { isValidEmail } from "@/api/auth";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any;
}

const DEFAULT_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Admin" },
  { value: "customer", label: "Customer" },
  { value: "collaborator", label: "Collaborator" },
];

export function UserDialog({ open, onOpenChange, user }: UserDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentRole } = useAuth();
  const { data: optionsData } = useQuery({
    queryKey: ["admin", "options"],
    queryFn: fetchAdminOptions,
  });
  const roles = useMemo(() => {
    const list = optionsData?.roles ?? DEFAULT_ROLES;
    const r = (currentRole || "").toLowerCase();
    if (r === "super_admin") return list;
    return list.filter((x: { value: string }) => (x.value || "").toLowerCase() !== "super_admin");
  }, [optionsData?.roles, currentRole]);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    email: user?.email || "",
    role: user?.role || "customer",
    company: user?.company || "",
    jobTitle: user?.jobTitle || "",
    password: "",
    newPassword: "", // for reset password when editing
  });

  // Update form data when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        role: user.role || "customer",
        company: user.company || "",
        jobTitle: user.jobTitle || "",
        password: "",
        newPassword: "",
      });
    } else {
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        role: "customer",
        company: "",
        jobTitle: "",
        password: "",
        newPassword: "",
      });
    }
  }, [user, open]);

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      if (user) {
        // Update existing user (RFP backend)
        const response = await apiRequest("PATCH", `/api/v1/users/${user.id}`, data);
        return response.json();
      } else {
        // Create new user via RFP users/register-by-admin
        const bootstrapRes = await fetch(getApiUrl("/api/v1/users/bootstrap-allowed"), {
          credentials: "include",
        });
        let bootstrapAllowed = false;
        try {
          const json = (await bootstrapRes.json()) as { bootstrapAllowed?: boolean };
          bootstrapAllowed = json.bootstrapAllowed === true;
        } catch {
          // If bootstrap check fails, assume authenticated flow
          bootstrapAllowed = false;
        }
        const password = (data.password || "").trim();
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters");
        }
        const payload = {
          email: (data.email || "").trim().toLowerCase(),
          password,
          confirmPassword: password,
          firstName: (data.firstName || "").trim() || "First",
          lastName: (data.lastName || "").trim() || "Last",
          companyName: (data.company || "").trim() || undefined,
          jobTitle: (data.jobTitle || "").trim() || undefined,
          role: data.role || "customer",
        };
        const response = bootstrapAllowed
          ? await apiRequest("POST", "/api/v1/users/register-by-admin", payload, { skipAuth: true })
          : await apiRequest("POST", "/api/v1/users/register-by-admin", payload);
        return response.json();
      }
    },
    onSuccess: (data: { message?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/v1/users"] });
      toast({
        title: user ? "User updated" : "User created",
        description: user
          ? `${formData.firstName} ${formData.lastName} has been updated successfully.`
          : (data?.message ?? `${formData.firstName} ${formData.lastName} has been created. A verification email has been sent to their email address.`),
      });
      onOpenChange(false);
      setFormData({
        firstName: "",
        lastName: "",
        email: "",
        role: "customer",
        company: "",
        jobTitle: "",
        password: "",
        newPassword: "",
      });
    },
    onError: (error) => {
      const { message: desc } = parseApiError(error);
      toast({
        title: "Error",
        description: desc || (user ? "Failed to update user. Please try again." : "Failed to create user. Please try again."),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    const trimmedEmail = (formData.email || "").trim();
    if (!formData.firstName || !formData.lastName || !trimmedEmail) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (!user && !isValidEmail(trimmedEmail)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }
    if (!user && !formData.password) {
      toast({
        title: "Validation Error",
        description: "Password is required for new users.",
        variant: "destructive",
      });
      return;
    }

    const submitData: any = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      role: formData.role,
      company: formData.company || null,
      jobTitle: formData.jobTitle || null,
    };

    if (!user) {
      submitData.username = formData.email.split("@")[0];
      submitData.password = formData.password || "temp123";
    } else if (formData.newPassword.trim()) {
      submitData.password = formData.newPassword;
    }

    createUserMutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">{user ? "Edit User" : "Create New User"}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {user ? "Update user information" : "Add a new user. A verification link will be sent to their email; they must verify before signing in."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs sm:text-sm">First Name *</Label>
            <Input
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="John"
              className="text-sm sm:text-base"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Last Name *</Label>
            <Input
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="Doe"
              className="text-sm sm:text-base"
            />
          </div>
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
              className="text-sm sm:text-base"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Role *</Label>
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
              <SelectTrigger className="text-sm sm:text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((opt: { value: string; label: string }) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!user ? (
            <div>
              <Label className="text-xs sm:text-sm">Password *</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password"
                className="text-sm sm:text-base"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs sm:text-sm">Reset password (optional)</Label>
              <Input
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                placeholder="New password (leave blank to keep current)"
                className="text-sm sm:text-base"
              />
            </div>
          )}
          <div>
            <Label className="text-xs sm:text-sm">Company</Label>
            <Input
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="Company Name"
              className="text-sm sm:text-base"
            />
          </div>
          <div>
            <Label className="text-xs sm:text-sm">Job Title</Label>
            <Input
              value={formData.jobTitle}
              onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
              placeholder="Job Title"
              className="text-sm sm:text-base"
            />
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto text-xs sm:text-sm">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createUserMutation.isPending} className="w-full sm:w-auto text-xs sm:text-sm">
            {createUserMutation.isPending ? "Creating..." : user ? "Update" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
