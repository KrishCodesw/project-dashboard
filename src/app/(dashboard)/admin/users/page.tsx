"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getUsers, createUser, toggleUserActive } from "@/server/actions/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, Loader2, UserCheck, UserX } from "lucide-react";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { toast } from "sonner";

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: result, isLoading } = useQuery({
    queryKey: ["admin", "users", roleFilter === "ALL" ? undefined : roleFilter, page, search],
    queryFn: () =>
      getUsers(roleFilter === "ALL" ? undefined : roleFilter, {
        page,
        pageSize,
        search: search || undefined,
      }),
  });

  const users = result?.data ?? [];
  const total = result?.total ?? 0;
  const totalPages = result?.totalPages ?? 0;

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    const fd = new FormData(e.currentTarget);
    try {
      await createUser({
        name: fd.get("name") as string,
        email: fd.get("email") as string,
        role: fd.get("role") as any,
        department: (fd.get("department") as string) || undefined,
        rollNumber: (fd.get("rollNumber") as string) || undefined,
      });
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(userId: string) {
    try {
      await toggleUserActive(userId);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success("User status updated");
    } catch {
      toast.error("Failed to update status");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm">
            Manage all system users
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select name="role" defaultValue="STUDENT">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department (optional)</Label>
                <Input name="department" />
              </div>
              <div className="space-y-2">
                <Label>Roll Number (optional)</Label>
                <Input name="rollNumber" />
              </div>
              <Button type="submit" disabled={creating} className="w-full">
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={(val) => { setRoleFilter(val); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Roles</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="TEACHER">Teacher</SelectItem>
            <SelectItem value="STUDENT">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-lg" />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-xl border bg-card overflow-hidden"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-secondary/30">
                <th className="text-left p-4 font-medium">Name</th>
                <th className="text-left p-4 font-medium">Email</th>
                <th className="text-left p-4 font-medium">Role</th>
                <th className="text-left p-4 font-medium">Department</th>
                <th className="text-left p-4 font-medium">Status</th>
                <th className="text-right p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user: any) => (
                <tr key={user.id} className="hover:bg-secondary/10 transition-colors">
                  <td className="p-4 font-medium">{user.name}</td>
                  <td className="p-4 text-muted-foreground">{user.email}</td>
                  <td className="p-4">
                    <Badge
                      variant="outline"
                      className={
                        user.role === "ADMIN"
                          ? "border-amber-400 text-amber-400"
                          : user.role === "TEACHER"
                          ? "border-emerald-400 text-emerald-400"
                          : "border-indigo-400 text-indigo-400"
                      }
                    >
                      {user.role}
                    </Badge>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {user.department || "—"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`flex items-center gap-1.5 text-xs font-medium ${
                        user.isActive ? "text-emerald-400" : "text-zinc-400"
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          user.isActive ? "bg-emerald-400" : "bg-zinc-500"
                        }`}
                      />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(user.id)}
                    >
                      {user.isActive ? (
                        <UserX className="h-4 w-4 text-destructive" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-emerald-400" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
      {!isLoading && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
