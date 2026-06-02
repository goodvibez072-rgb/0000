import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Users, ArrowLeft, Search, Edit, Trash2, Crown,
  Mail, Calendar, MapPin, User, Save, X, Shield,
  Star, Wrench, AlertTriangle, Ban, CheckCircle, Clock
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface UserData {
  id: string;
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  profilePicture?: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  isAdmin: boolean;
  role?: 'user' | 'premium' | 'staff' | 'admin' | 'owner';
  isBanned?: string;
  banReason?: string;
  bannedAt?: string;
  banExpiresAt?: string;
}

interface Warning {
  id: string;
  userId: string;
  issuedBy: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notes?: string;
  isActive: string;
  createdAt: string;
  adminUsername?: string;
  adminEmail?: string;
}

export default function UserManagement() {
  const { isAdmin, isAuthenticated, user: currentUser, isOwner, isStaff } = useAuth();
  const [, navigate] = useLocation();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserData>>({});
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  
  // Warning and Ban state
  const [warningUser, setWarningUser] = useState<UserData | null>(null);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [warningForm, setWarningForm] = useState({
    reason: "",
    severity: "low" as 'low' | 'medium' | 'high' | 'critical',
    notes: "",
  });
  const [viewingWarnings, setViewingWarnings] = useState<UserData | null>(null);
  const [loadingWarnings, setLoadingWarnings] = useState(false);
  
  const [banUser, setBanUser] = useState<UserData | null>(null);
  const [banForm, setBanForm] = useState({
    banReason: "",
    duration: 0, // 0 = permanent
  });
  
  // Filter state
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterBanStatus, setFilterBanStatus] = useState<string>("all");

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/users", {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUsers(userData);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEditUser = (user: UserData) => {
    setEditingUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      country: user.country,
    });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "User updated successfully",
        });
        setEditingUser(null);
        setEditForm({});
        fetchUsers(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to update user",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "error",
      });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "User deleted successfully",
        });
        setDeleteUserId(null);
        fetchUsers(); // Refresh the list
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to delete user",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "error",
      });
    }
  };

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: 'user' | 'premium' | 'staff' | 'admin' | 'owner') => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(user => 
          user.id === userId 
            ? { ...user, role: newRole, isAdmin: newRole === 'admin' || newRole === 'owner' }
            : user
        ));
        toast({
          title: "Success",
          description: `User role changed to ${newRole}.`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update role");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update user role. Please try again.",
        variant: "error",
      });
    }
  };

  // ========== WARNING FUNCTIONS ==========
  
  const fetchWarnings = async (userId: string) => {
    try {
      setLoadingWarnings(true);
      const response = await fetch(`/api/admin/users/${userId}/warnings`, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setWarnings(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch warnings",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch warnings",
        variant: "error",
      });
    } finally {
      setLoadingWarnings(false);
    }
  };

  const handleWarnUser = async () => {
    if (!warningUser) return;
    
    if (!warningForm.reason.trim()) {
      toast({
        title: "Error",
        description: "Warning reason is required",
        variant: "error",
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/users/${warningUser.id}/warn`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(warningForm),
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Warning issued successfully",
        });
        setWarningUser(null);
        setWarningForm({ reason: "", severity: "low", notes: "" });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to issue warning",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to issue warning",
        variant: "error",
      });
    }
  };

  const handleDeleteWarning = async (warningId: string) => {
    try {
      const response = await fetch(`/api/admin/warnings/${warningId}`, {
        method: "DELETE",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      
      if (response.ok) {
        toast({
          title: "Success",
          description: "Warning deleted successfully",
        });
        if (viewingWarnings) {
          fetchWarnings(viewingWarnings.id);
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to delete warning",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete warning",
        variant: "error",
      });
    }
  };

  // ========== BAN FUNCTIONS ==========
  
  const handleBanUserAction = async () => {
    if (!banUser) return;
    
    if (!banForm.banReason.trim()) {
      toast({
        title: "Error",
        description: "Ban reason is required",
        variant: "error",
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/users/${banUser.id}/ban`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(banForm),
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === banUser.id ? updatedUser : u));
        toast({
          title: "Success",
          description: "User banned successfully",
        });
        setBanUser(null);
        setBanForm({ banReason: "", duration: 0 });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to ban user",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to ban user",
        variant: "error",
      });
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/unban`, {
        method: "POST",
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(u => u.id === userId ? updatedUser : u));
        toast({
          title: "Success",
          description: "User unbanned successfully",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to unban user",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to unban user",
        variant: "error",
      });
    }
  };

  // Get role badge component
  const getRoleBadge = (role?: 'user' | 'premium' | 'staff' | 'admin' | 'owner', isAdmin?: boolean) => {
    // Fallback to isAdmin if role is not set (backward compatibility)
    const effectiveRole = role || (isAdmin ? 'admin' : 'user');
    
    switch (effectiveRole) {
      case 'owner':
        return (
          <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-2 border-yellow-300 shadow-lg">
            <Crown className="w-3 h-3 mr-1 fill-current" />
            Owner
          </Badge>
        );
      case 'admin':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
            <Crown className="w-3 h-3 mr-1" />
            Admin
          </Badge>
        );
      case 'staff':
        return (
          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
            <Shield className="w-3 h-3 mr-1" />
            Staff
          </Badge>
        );
      case 'premium':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            <Star className="w-3 h-3 mr-1" />
            Premium
          </Badge>
        );
      case 'user':
      default:
        return (
          <Badge variant="secondary">
            <User className="w-3 h-3 mr-1" />
            User
          </Badge>
        );
    }
  };

  // Filter users based on search query, role, and ban status
  const filteredUsers = users.filter(user => {
    // Search filter
    const matchesSearch = 
      user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Role filter
    const matchesRole = filterRole === "all" || 
      (user.role || (user.isAdmin ? 'admin' : 'user')) === filterRole;
    
    // Ban status filter
    const matchesBanStatus = filterBanStatus === "all" ||
      (filterBanStatus === "banned" && user.isBanned === "true") ||
      (filterBanStatus === "active" && user.isBanned !== "true");
    
    return matchesSearch && matchesRole && matchesBanStatus;
  });

  // Show auth gate if not admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Access Required</CardTitle>
            <CardDescription className="mt-2">
              You need admin privileges to access user management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate("/")}
              className="w-full"
            >
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/95 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin Panel
              </Button>
            </Link>
            <div className="flex items-center space-x-2">
              <Users className="w-8 h-8 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary via-accent to-purple-400 bg-clip-text text-transparent">
                User Management
              </h1>
            </div>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-3">
            <Card className="bg-card/80 backdrop-blur-md border-border/50">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users by username, email, or name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-background/50"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterRole} onValueChange={setFilterRole}>
                      <SelectTrigger className="w-32 bg-background/50">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Roles</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterBanStatus} onValueChange={setFilterBanStatus}>
                      <SelectTrigger className="w-32 bg-background/50">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="bg-card/80 backdrop-blur-md border-border/50">
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users List */}
        <Card className="bg-card/80 backdrop-blur-md border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>All Users</span>
              {isStaff && !isOwner && !isAdmin && (
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-500 text-xs">
                  Read-only (Staff)
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {isStaff && !isOwner && !isAdmin 
                ? "View user information (Staff have read-only access)" 
                : "Manage user accounts and permissions"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  {searchQuery ? "No users found matching your search." : "No users found."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border/50"
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.profileImageUrl || user.profilePicture || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {(user.firstName?.[0] || user.username?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 flex-wrap">
                          <p className="font-medium truncate">
                            {user.firstName && user.lastName 
                              ? `${user.firstName} ${user.lastName}`
                              : user.username || "No name"}
                          </p>
                          {getRoleBadge(user.role, user.isAdmin)}
                          {user.isBanned === "true" && (
                            <Badge variant="destructive" className="text-xs">
                              <Ban className="w-3 h-3 mr-1" />
                              Banned
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                          {user.username && (
                            <div className="flex items-center space-x-1">
                              <User className="w-3 h-3" />
                              <span>{user.username}</span>
                            </div>
                          )}
                          {user.email && (
                            <div className="flex items-center space-x-1">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-48">{user.email}</span>
                            </div>
                          )}
                          {user.country && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{user.country}</span>
                            </div>
                          )}
                          {user.createdAt && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Role Selection - Only owner can modify roles */}
                      <Select
                        value={user.role || (user.isAdmin ? 'admin' : 'user')}
                        disabled={!isOwner}
                        onValueChange={(newRole: 'user' | 'premium' | 'staff' | 'admin' | 'owner') => {
                          // Owner role restrictions
                          if (newRole === 'owner') {
                            // Only existing owner can assign owner role
                            if (currentUser?.role !== 'owner') {
                              toast({
                                title: "Access Denied",
                                description: "Only the current owner can assign owner privileges.",
                                variant: "error",
                              });
                              return;
                            }
                            // Check if there's already an owner
                            const existingOwner = users.find(u => u.role === 'owner' && u.id !== user.id);
                            if (existingOwner) {
                              toast({
                                title: "Error",
                                description: "Only one owner can exist at a time. Please demote the current owner first.",
                                variant: "error",
                              });
                              return;
                            }
                          }
                          
                          // Prevent owner from demoting themselves
                          if (currentUser?.id === user.id && currentUser?.role === 'owner' && newRole !== 'owner') {
                            toast({
                              title: "Access Denied",
                              description: "Owners cannot demote themselves. Transfer ownership to another user first.",
                              variant: "error",
                            });
                            return;
                          }
                          
                          handleRoleChange(user.id, newRole);
                        }}
                      >
                        <SelectTrigger className="w-24 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="premium">Premium</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          {/* Only show owner option to current owner */}
                          {currentUser?.role === 'owner' && (
                            <SelectItem value="owner">Owner</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleEditUser(user)}
                            disabled={isStaff && !isOwner && !isAdmin}
                            title={isStaff && !isOwner && !isAdmin ? "Staff have read-only access" : "Edit user"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] sm:max-w-[525px]">
                          <DialogHeader>
                            <DialogTitle>Edit User</DialogTitle>
                            <DialogDescription>
                              Update user information and settings.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">First Name</Label>
                                <Input
                                  id="firstName"
                                  value={editForm.firstName || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                                  className="bg-background/50"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name</Label>
                                <Input
                                  id="lastName"
                                  value={editForm.lastName || ""}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                                  className="bg-background/50"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="username">Username</Label>
                              <Input
                                id="username"
                                value={editForm.username || ""}
                                onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                                className="bg-background/50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="email">Email</Label>
                              <Input
                                id="email"
                                type="email"
                                value={editForm.email || ""}
                                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                                className="bg-background/50"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="country">Country</Label>
                              <Input
                                id="country"
                                value={editForm.country || ""}
                                onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))}
                                className="bg-background/50"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setEditingUser(null)}>
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                            <Button onClick={handleSaveUser}>
                              <Save className="w-4 h-4 mr-2" />
                              Save Changes
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Warning Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWarningUser(user)}
                        disabled={isStaff && !isOwner && !isAdmin}
                        title="Issue warning"
                        className="text-yellow-500 hover:text-yellow-600"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </Button>
                      
                      {/* Ban/Unban Button */}
                      {user.isBanned === "true" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnbanUser(user.id)}
                          disabled={isStaff && !isOwner && !isAdmin}
                          title="Unban user"
                          className="text-green-500 hover:text-green-600"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setBanUser(user);
                            setBanForm({ banReason: "", duration: 0 });
                          }}
                          disabled={isStaff && !isOwner && !isAdmin}
                          title="Ban user"
                          className="text-red-500 hover:text-red-600"
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                      
                      {!user.isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteUserId(user.id)}
                          className="text-destructive hover:text-destructive"
                          disabled={isStaff && !isOwner && !isAdmin}
                          title={isStaff && !isOwner && !isAdmin ? "Staff have read-only access" : "Delete user"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete User</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteUserId && handleDeleteUser(deleteUserId)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete User
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Warning Dialog */}
        <Dialog open={!!warningUser} onOpenChange={() => {
          setWarningUser(null);
          setWarningForm({ reason: "", severity: "low", notes: "" });
        }}>
          <DialogContent className="w-[95vw] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span>Issue Warning</span>
              </DialogTitle>
              <DialogDescription>
                Issue a warning to {warningUser?.username || "this user"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="warning-reason">Reason *</Label>
                <Input
                  id="warning-reason"
                  placeholder="Enter warning reason..."
                  value={warningForm.reason}
                  onChange={(e) => setWarningForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warning-severity">Severity</Label>
                <Select
                  value={warningForm.severity}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => 
                    setWarningForm(prev => ({ ...prev, severity: value }))
                  }
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="warning-notes">Additional Notes (Optional)</Label>
                <Input
                  id="warning-notes"
                  placeholder="Additional context..."
                  value={warningForm.notes}
                  onChange={(e) => setWarningForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setWarningUser(null);
                setWarningForm({ reason: "", severity: "low", notes: "" });
              }}>
                Cancel
              </Button>
              <Button onClick={handleWarnUser} className="bg-yellow-500 hover:bg-yellow-600">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Issue Warning
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Ban User Dialog */}
        <Dialog open={!!banUser} onOpenChange={() => {
          setBanUser(null);
          setBanForm({ banReason: "", duration: 0 });
        }}>
          <DialogContent className="w-[95vw] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Ban className="w-5 h-5 text-red-500" />
                <span>Ban User</span>
              </DialogTitle>
              <DialogDescription>
                Ban {banUser?.username || "this user"} from accessing the platform
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ban-reason">Ban Reason *</Label>
                <Input
                  id="ban-reason"
                  placeholder="Enter ban reason..."
                  value={banForm.banReason}
                  onChange={(e) => setBanForm(prev => ({ ...prev, banReason: e.target.value }))}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ban-duration">Ban Duration</Label>
                <Select
                  value={banForm.duration.toString()}
                  onValueChange={(value) => setBanForm(prev => ({ ...prev, duration: parseInt(value) }))}
                >
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Permanent</SelectItem>
                    <SelectItem value="1">1 Day</SelectItem>
                    <SelectItem value="3">3 Days</SelectItem>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {banForm.duration > 0 && (
                <div className="flex items-center space-x-2 text-sm text-muted-foreground bg-blue-500/10 p-3 rounded-md">
                  <Clock className="w-4 h-4" />
                  <span>Ban will expire in {banForm.duration} day{banForm.duration !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
                setBanUser(null);
                setBanForm({ banReason: "", duration: 0 });
              }}>
                Cancel
              </Button>
              <Button onClick={handleBanUserAction} variant="destructive">
                <Ban className="w-4 h-4 mr-2" />
                Ban User
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}