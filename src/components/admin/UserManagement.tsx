import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, UserPlus, X, Search, Edit, Ban, Trash2, Eye, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import WorkerProfileView from '@/components/admin/WorkerProfileView';
import UserForm from '@/components/admin/UserForm';

type Role = 'inventory_officer' | 'workshop_worker' | 'sales_officer';

export const roleLabels: Record<string, string> = {
  admin: 'Admin',
  inventory_officer: 'Inventory Officer',
  workshop_worker: 'Workshop Worker',
  sales_officer: 'Sales Officer',
};

export type UserWithRole = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  branch_id: string | null;
  is_muted: boolean;
  role: string;
};

const UserManagement = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [viewingUser, setViewingUser] = useState<UserWithRole | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');
      return (profiles || []).map(p => ({
        ...p,
        is_muted: (p as any).is_muted ?? false,
        branch_id: (p as any).branch_id ?? null,
        role: roles?.find(r => r.user_id === p.user_id)?.role || 'No role',
      })) as UserWithRole[];
    },
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*');
      return data || [];
    },
  });

  const muteMutation = useMutation({
    mutationFn: async ({ user_id, is_muted }: { user_id: string; is_muted: boolean }) => {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'mute', user_id, is_muted },
      });
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: (_, { is_muted }) => {
      toast({ title: is_muted ? 'User suspended' : 'User reactivated' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const res = await supabase.functions.invoke('manage-user', {
        body: { action: 'delete', user_id },
      });
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      toast({ title: 'User deleted' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const filtered = (users || []).filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  if (viewingUser) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setViewingUser(null)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Users
        </Button>
        <WorkerProfileView user={viewingUser} branches={branches || []} />
      </div>
    );
  }

  if (showForm || editingUser) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => { setShowForm(false); setEditingUser(null); }} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Users
        </Button>
        <UserForm
          editUser={editingUser}
          branches={branches || []}
          onSuccess={() => {
            setShowForm(false);
            setEditingUser(null);
            queryClient.invalidateQueries({ queryKey: ['admin-users'] });
          }}
          onCancel={() => { setShowForm(false); setEditingUser(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage staff accounts and roles</p>
        </div>
        <Button onClick={() => setShowForm(true)} size="lg">
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="pl-10 h-11" />
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
          ))
        ) : filtered.length === 0 ? (
          <Card className="border"><CardContent className="p-12 text-center"><p className="text-muted-foreground">No users found</p></CardContent></Card>
        ) : (
          filtered.map((user) => (
            <Card key={user.id} className={cn("border", user.is_muted && "opacity-60 border-destructive/30")}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-primary font-bold text-sm">
                    {user.full_name?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{user.full_name}</p>
                    {user.is_muted && <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full">Suspended</span>}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <span className={cn(
                  "text-xs font-medium px-3 py-1 rounded-full hidden sm:inline-block",
                  user.role === 'admin' ? "bg-primary/10 text-primary" :
                  user.role === 'inventory_officer' ? "bg-warning/10 text-warning" :
                  user.role === 'workshop_worker' ? "bg-success/10 text-success" :
                  user.role === 'sales_officer' ? "bg-accent text-accent-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {roleLabels[user.role] || user.role}
                </span>
                {user.role !== 'admin' && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewingUser(user)} title="View profile">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingUser(user)} title="Edit">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => muteMutation.mutate({ user_id: user.user_id, is_muted: !user.is_muted })}
                      title={user.is_muted ? 'Reactivate' : 'Suspend'}
                      disabled={muteMutation.isPending}>
                      <Ban className={cn("h-3.5 w-3.5", user.is_muted ? "text-success" : "text-warning")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => { if (confirm('Delete this user? Activity records will be preserved.')) deleteMutation.mutate(user.user_id); }}
                      disabled={deleteMutation.isPending} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default UserManagement;
