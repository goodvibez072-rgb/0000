import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Plus, Edit, Trash2, Users, Loader2, Crown, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { fetchWithCsrf } from "@/lib/csrf";

// Types
interface Role {
  id: string;
  name: string;
  description: string | null;
  hierarchyLevel: number;
  color: string | null;
  isSystem: string;
  createdAt: string;
  updatedAt: string;
  permissions: RolePermissions;
}

interface RolePermissions {
  id?: string;
  roleId: string;
  manageUsers: string;
  viewUsers: string;
  banUsers: string;
  warnUsers: string;
  assignRoles: string;
  manageSeries: string;
  manageChapters: string;
  moderateComments: string;
  manageAds: string;
  viewAdAnalytics: string;
  viewAnalytics: string;
  viewDetailedAnalytics: string;
  configureRoles: string;
  manageSettings: string;
  viewLogs: string;
  handleDmca: string;
  manageSubscriptions: string;
  manageCurrency: string;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
}

// Permission definitions for UI
const permissionGroups = [
  {
    name: "User Management",
    permissions: [
      { key: "manageUsers", label: "Manage Users", description: "Create, edit, and delete users" },
      { key: "viewUsers", label: "View Users", description: "View user list and details" },
      { key: "banUsers", label: "Ban Users", description: "Ban and unban users" },
      { key: "warnUsers", label: "Warn Users", description: "Issue warnings to users" },
      { key: "assignRoles", label: "Assign Roles", description: "Assign roles to users" },
    ],
  },
  {
    name: "Content Management",
    permissions: [
      { key: "manageSeries", label: "Manage Series", description: "Create, edit, delete manga/manhwa" },
      { key: "manageChapters", label: "Manage Chapters", description: "Upload, edit, delete chapters" },
      { key: "moderateComments", label: "Moderate Comments", description: "Delete and moderate user comments" },
    ],
  },
  {
    name: "Advertisement & Analytics",
    permissions: [
      { key: "manageAds", label: "Manage Ads", description: "Create, edit, delete advertisements" },
      { key: "viewAdAnalytics", label: "View Ad Analytics", description: "View ad performance metrics" },
      { key: "viewAnalytics", label: "View Analytics", description: "View analytics dashboard" },
      { key: "viewDetailedAnalytics", label: "View Detailed Analytics", description: "View detailed analytics reports" },
    ],
  },
  {
    name: "System Configuration",
    permissions: [
      { key: "configureRoles", label: "Configure Roles", description: "Create, edit, delete roles & permissions" },
      { key: "manageSettings", label: "Manage Settings", description: "Change system settings" },
      { key: "viewLogs", label: "View Logs", description: "View admin activity logs" },
    ],
  },
  {
    name: "Business Operations",
    permissions: [
      { key: "handleDmca", label: "Handle DMCA", description: "Manage DMCA notices" },
      { key: "manageSubscriptions", label: "Manage Subscriptions", description: "Manage subscription plans" },
      { key: "manageCurrency", label: "Manage Currency", description: "Adjust user currency balances" },
    ],
  },
];

// Fetch all roles
async function fetchRoles() {
  const response = await fetch("/api/roles", {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!response.ok) throw new Error("Failed to fetch roles");
  return response.json();
}

// Fetch all users
async function fetchUsers() {
  const response = await fetch("/api/admin/users", {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });
  if (!response.ok) throw new Error("Failed to fetch users");
  return response.json();
}

export default function RoleAuthority() {
  const { isAuthenticated, isOwner } = useAuth();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // State for role dialogs
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false);
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false);
  const [isDeleteRoleOpen, setIsDeleteRoleOpen] = useState(false);
  const [isEditPermissionsOpen, setIsEditPermissionsOpen] = useState(false);
  const [isAssignRoleOpen, setIsAssignRoleOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Form state for new/edit role
  const [roleName, setRoleName] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [roleHierarchy, setRoleHierarchy] = useState(10);
  const [roleColor, setRoleColor] = useState("#6366f1");

  // Permission state
  const [permissions, setPermissions] = useState<Partial<RolePermissions>>({});

  // Fetch roles and users
  const { data: roles, isLoading: isLoadingRoles } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: fetchRoles,
    enabled: isOwner && isAuthenticated,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: fetchUsers,
    enabled: isOwner && isAuthenticated,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData: any) => {
      const response = await fetchWithCsrf("/api/roles", {
        method: "POST",
        body: JSON.stringify(roleData),
      });
      if (!response.ok) throw new Error("Failed to create role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Success", description: "Role created successfully!", variant: "success" });
      setIsCreateRoleOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "error" });
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetchWithCsrf(`/api/roles/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Success", description: "Role updated successfully!", variant: "success" });
      setIsEditRoleOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "error" });
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetchWithCsrf(`/api/roles/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Success", description: "Role deleted successfully!", variant: "success" });
      setIsDeleteRoleOpen(false);
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "error" });
    },
  });

  // Update permissions mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissions }: { roleId: string; permissions: any }) => {
      const response = await fetchWithCsrf(`/api/roles/${roleId}/permissions`, {
        method: "PUT",
        body: JSON.stringify(permissions),
      });
      if (!response.ok) throw new Error("Failed to update permissions");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      toast({ title: "Success", description: "Permissions updated successfully!", variant: "success" });
      setIsEditPermissionsOpen(false);
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "error" });
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleName }: { userId: string; roleName: string }) => {
      const response = await fetchWithCsrf(`/api/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ roleName }),
      });
      if (!response.ok) throw new Error("Failed to assign role");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({ title: "Success", description: "Role assigned successfully!", variant: "success" });
      setIsAssignRoleOpen(false);
      setSelectedUserId("");
      setSelectedRole(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "error" });
    },
  });

  // Reset form
  const resetForm = () => {
    setRoleName("");
    setRoleDescription("");
    setRoleHierarchy(10);
    setRoleColor("#6366f1");
    setPermissions({});
  };

  // Handle create role
  const handleCreateRole = () => {
    if (!roleName.trim()) {
      toast({ title: "Error", description: "Role name is required", variant: "error" });
      return;
    }
    createRoleMutation.mutate({
      name: roleName,
      description: roleDescription || null,
      hierarchyLevel: roleHierarchy,
      color: roleColor,
      isSystem: "false",
    });
  };

  // Handle edit role
  const handleEditRole = () => {
    if (!selectedRole) return;
    updateRoleMutation.mutate({
      id: selectedRole.id,
      data: {
        name: roleName,
        description: roleDescription || null,
        hierarchyLevel: roleHierarchy,
        color: roleColor,
      },
    });
  };

  // Handle delete role
  const handleDeleteRole = () => {
    if (!selectedRole) return;
    deleteRoleMutation.mutate(selectedRole.id);
  };

  // Handle update permissions
  const handleUpdatePermissions = () => {
    if (!selectedRole) return;
    updatePermissionsMutation.mutate({
      roleId: selectedRole.id,
      permissions,
    });
  };

  // Handle assign role
  const handleAssignRole = () => {
    if (!selectedUserId || !selectedRole) {
      toast({ title: "Error", description: "Please select a user and role", variant: "error" });
      return;
    }
    assignRoleMutation.mutate({
      userId: selectedUserId,
      roleName: selectedRole.name,
    });
  };

  // Open edit dialog
  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || "");
    setRoleHierarchy(role.hierarchyLevel);
    setRoleColor(role.color || "#6366f1");
    setIsEditRoleOpen(true);
  };

  // Open permissions dialog
  const openPermissionsDialog = (role: Role) => {
    setSelectedRole(role);
    setPermissions(role.permissions);
    setIsEditPermissionsOpen(true);
  };

  // Toggle permission
  const togglePermission = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: prev[key as keyof typeof prev] === "true" ? "false" : "true",
    }));
  };

  // Owner-only access check
  if (!isAuthenticated || !isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <Crown className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Owner Access Required</CardTitle>
            <CardDescription className="mt-2">
              {!isAuthenticated
                ? "Please log in with an owner account to access role management."
                : "Only the owner can manage roles and permissions."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => navigate(!isAuthenticated ? "/login" : "/")} className="w-full">
              {!isAuthenticated ? "Go to Login" : "Return to Home"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingRoles) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="w-full sm:w-fit text-muted-foreground hover:text-primary mb-4 min-h-11 justify-start"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Role Authority Management</h1>
              <p className="text-muted-foreground">Configure roles and permissions for your platform</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Button onClick={() => setIsCreateRoleOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Role
          </Button>
          <Button onClick={() => setIsAssignRoleOpen(true)} variant="outline" className="gap-2">
            <Users className="w-4 h-4" />
            Assign Roles to Users
          </Button>
        </div>

        {/* Roles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles?.map((role) => (
            <Card key={role.id} className="bg-card/50 backdrop-blur-sm border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${role.color || '#6366f1'}20`, color: role.color || '#6366f1' }}
                    >
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl flex items-center gap-2">
                        {role.name}
                        {role.isSystem === "true" && (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            Protected
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">Level {role.hierarchyLevel}</p>
                    </div>
                  </div>
                </div>
                <CardDescription className="mt-3">{role.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(role)}
                    disabled={role.isSystem === "true"}
                    className="flex-1 gap-2"
                    title={role.isSystem === "true" ? "System roles cannot be renamed or deleted (but permissions can be edited)" : "Edit role name and details"}
                  >
                    <Edit className="w-3 h-3" />
                    {role.isSystem === "true" ? "Locked" : "Edit"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRole(role);
                      setIsDeleteRoleOpen(true);
                    }}
                    disabled={role.isSystem === "true"}
                    className="flex-1 gap-2 text-destructive hover:text-destructive"
                    title={role.isSystem === "true" ? "System roles are protected and cannot be deleted" : "Delete this role"}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={() => openPermissionsDialog(role)}
                  className="w-full gap-2"
                  variant="default"
                >
                  <Shield className="w-3 h-3" />
                  Manage Permissions
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create Role Dialog */}
        <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>Define a new role with custom hierarchy level and appearance.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Role Name *</Label>
                <Input
                  id="name"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g., Moderator"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Role description..."
                />
              </div>
              <div>
                <Label htmlFor="hierarchy">Hierarchy Level (0-100)</Label>
                <Input
                  id="hierarchy"
                  type="number"
                  min="0"
                  max="100"
                  value={roleHierarchy}
                  onChange={(e) => setRoleHierarchy(parseInt(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground mt-1">Higher = more authority</p>
              </div>
              <div>
                <Label htmlFor="color">Role Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="color"
                    type="color"
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    className="w-20"
                  />
                  <Input value={roleColor} onChange={(e) => setRoleColor(e.target.value)} placeholder="#6366f1" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateRoleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRole} disabled={createRoleMutation.isPending}>
                {createRoleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>Update role information and hierarchy.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Role Name *</Label>
                <Input id="edit-name" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input id="edit-description" value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-hierarchy">Hierarchy Level (0-100)</Label>
                <Input
                  id="edit-hierarchy"
                  type="number"
                  min="0"
                  max="100"
                  value={roleHierarchy}
                  onChange={(e) => setRoleHierarchy(parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label htmlFor="edit-color">Role Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="edit-color"
                    type="color"
                    value={roleColor}
                    onChange={(e) => setRoleColor(e.target.value)}
                    className="w-20"
                  />
                  <Input value={roleColor} onChange={(e) => setRoleColor(e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditRoleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditRole} disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Role Dialog */}
        <Dialog open={isDeleteRoleOpen} onOpenChange={setIsDeleteRoleOpen}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Delete Role</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete the role "{selectedRole?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <p className="text-sm">System roles cannot be deleted, and roles assigned to users cannot be removed.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteRoleOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteRole} disabled={deleteRoleMutation.isPending}>
                {deleteRoleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Permissions Dialog */}
        <Dialog open={isEditPermissionsOpen} onOpenChange={setIsEditPermissionsOpen}>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Permissions: {selectedRole?.name}</DialogTitle>
              <DialogDescription>Configure what this role can do within the platform.</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {permissionGroups.map((group) => (
                <div key={group.name}>
                  <h3 className="font-semibold mb-3">{group.name}</h3>
                  <div className="space-y-3 pl-4">
                    {group.permissions.map((perm) => (
                      <div key={perm.key} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{perm.label}</div>
                          <div className="text-sm text-muted-foreground">{perm.description}</div>
                        </div>
                        <Switch
                          checked={permissions[perm.key as keyof typeof permissions] === "true"}
                          onCheckedChange={() => togglePermission(perm.key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditPermissionsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePermissions} disabled={updatePermissionsMutation.isPending}>
                {updatePermissionsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Permissions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Role Dialog */}
        <Dialog open={isAssignRoleOpen} onOpenChange={setIsAssignRoleOpen}>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Role to User</DialogTitle>
              <DialogDescription>Select a user and assign them a role.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user-select">Select User</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.username} ({user.email}) - Current: {user.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="role-select">Select Role</Label>
                <Select value={selectedRole?.id || ""} onValueChange={(id) => setSelectedRole(roles?.find((r) => r.id === id) || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name} (Level {role.hierarchyLevel})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAssignRoleOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAssignRole} disabled={assignRoleMutation.isPending}>
                {assignRoleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
