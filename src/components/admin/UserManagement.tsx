import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, UserPlus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Role = 'inventory_officer' | 'workshop_worker' | 'sales_officer';

const roleLabels: Record<Role, string> = {
  inventory_officer: 'Inventory Officer',
  workshop_worker: 'Workshop Worker',
  sales_officer: 'Sales Officer',
};

const UserManagement = () => {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', role: '' as Role | '', password: '',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const { data: roles } = await supabase.from('user_roles').select('*');
      return (profiles || []).map(p => ({
        ...p,
        role: roles?.find(r => r.user_id === p.user_id)?.role || 'No role',
      }));
    },
  });

  const createUser = useMutation({
    mutationFn: async () => {
      // Use edge function to create user (admin-only)
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-user', {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
        },
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'User created successfully' });
      setShowForm(false);
      setForm({ full_name: '', email: '', phone: '', role: '', password: '' });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage staff accounts and roles</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add User'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5 text-primary" />
              Create New User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => { e.preventDefault(); createUser.mutate(); }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="John Doe"
                    className="h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="john@example.com"
                    className="h-12"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+254 700 000 000"
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 6 characters"
                    className="h-12"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(roleLabels) as [Role, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, role: key }))}
                      className={cn(
                        "px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                        form.role === key
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:bg-accent"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={createUser.isPending || !form.role}>
                {createUser.isPending ? <Loader2 className="animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create User
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />
          ))
        ) : (
          users?.map((user) => (
            <Card key={user.id} className="border">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-bold text-sm">
                    {user.full_name?.charAt(0) || '?'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{user.full_name}</p>
                  <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                </div>
                <span className={cn(
                  "text-xs font-medium px-3 py-1 rounded-full",
                  user.role === 'admin' ? "bg-primary/10 text-primary" :
                  user.role === 'inventory_officer' ? "bg-warning/10 text-warning" :
                  user.role === 'workshop_worker' ? "bg-success/10 text-success" :
                  user.role === 'sales_officer' ? "bg-accent text-accent-foreground" :
                  "bg-muted text-muted-foreground"
                )}>
                  {user.role === 'admin' ? 'Admin' :
                   user.role === 'inventory_officer' ? 'Inventory' :
                   user.role === 'workshop_worker' ? 'Workshop' :
                   user.role === 'sales_officer' ? 'Sales' : user.role}
                </span>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default UserManagement;
