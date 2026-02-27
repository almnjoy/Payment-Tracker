import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdminMemberships } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminUserManagement() {
  const queryClient = useQueryClient();
  const { data: memberships = [], isLoading } = useAdminMemberships();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"admin" | "client">("admin");

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/memberships/invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error("Failed to invite user");
      return res.json();
    },
    onSuccess: () => {
      setUserId("");
      queryClient.invalidateQueries({ queryKey: ["admin", "memberships", "admins"] });
      toast.success("Membership invited/updated");
    },
    onError: (error: any) => toast.error(error.message || "Failed to invite"),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ targetUserId, nextRole }: { targetUserId: string; nextRole: "owner" | "admin" | "client" }) => {
      const res = await fetch(`/api/admin/memberships/${targetUserId}/role`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "memberships", "admins"] });
      toast.success("Role updated");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await fetch(`/api/admin/memberships/${targetUserId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });
      if (!res.ok) throw new Error("Failed to deactivate membership");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "memberships", "admins"] });
      toast.success("Membership deactivated");
    },
  });

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Admin User Management</h2>
          <p className="text-gray-500">Manage organization admin memberships and access roles.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invite / Add Membership</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>User ID</Label>
                <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="replit-user-id" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(val: "admin" | "client") => setRole(val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="client">Client</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => inviteMutation.mutate()} disabled={!userId || inviteMutation.isPending}>
                  Save Membership
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Admins</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-gray-500">Loading memberships...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberships.map((membership) => (
                    <TableRow key={membership.id}>
                      <TableCell>{membership.userId}</TableCell>
                      <TableCell className="capitalize">{membership.role}</TableCell>
                      <TableCell>{new Date(membership.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {membership.role !== "owner" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateRoleMutation.mutate({ targetUserId: membership.userId, nextRole: "admin" })}>Make Admin</Button>
                            <Button size="sm" variant="outline" onClick={() => updateRoleMutation.mutate({ targetUserId: membership.userId, nextRole: "client" })}>Make Client</Button>
                          </>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => deactivateMutation.mutate(membership.userId)}>Deactivate</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
