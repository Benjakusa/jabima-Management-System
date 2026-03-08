import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { Loader2, UserPlus, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserWithRole } from './UserManagement';

type Role = 'inventory_officer' | 'workshop_worker' | 'sales_officer';

const roleLabels: Record<Role, string> = {
  inventory_officer: 'Inventory Officer',
  workshop_worker: 'Workshop Worker',
  sales_officer: 'Sales Officer',
};

interface Props {
  editUser: UserWithRole | null;
  branches: { id: string; name: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}

const UserForm = ({ editUser, branches, onSuccess, onCancel }: Props) => {
  const isEdit = !!editUser;
  const [form, setForm] = useState({
    full_name: editUser?.full_name || '',
    email: editUser?.email || '',
    phone: editUser?.phone || '',
    role: (editUser?.role as Role) || ('' as Role | ''),
    branch_id: editUser?.branch_id || '',
    password: '',
  });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        const body: any = { action: 'update', user_id: editUser.user_id };
        if (form.full_name !== editUser.full_name) body.full_name = form.full_name;
        if (form.email !== editUser.email) body.email = form.email;
        if (form.phone !== (editUser.phone || '')) body.phone = form.phone || null;
        if (form.role && form.role !== editUser.role) body.role = form.role;
        if (form.branch_id !== (editUser.branch_id || '')) body.branch_id = form.branch_id || null;
        if (form.password) body.password = form.password;
        const res = await supabase.functions.invoke('manage-user', { body });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
      } else {
        if (!form.role || !form.password) throw new Error('Role and password are required');
        const res = await supabase.functions.invoke('create-user', {
          body: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone || undefined,
            role: form.role,
          },
        });
        if (res.error) throw new Error(res.error.message);
        if (res.data?.error) throw new Error(res.data.error);
        // Update branch if selected
        if (form.branch_id && res.data?.user_id) {
          await supabase.from('profiles').update({ branch_id: form.branch_id } as any).eq('user_id', res.data.user_id);
        }
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? 'User updated' : 'User created successfully' });
      onSuccess();
    },
    onError: (err: Error) => {
      const msg = err.message.includes('already been registered')
        ? 'A user with this email already exists. Please use a different email.'
        : err.message;
      toast({ variant: 'destructive', title: 'Error', description: msg });
    },
  });

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          {isEdit ? <Save className="h-5 w-5 text-primary" /> : <UserPlus className="h-5 w-5 text-primary" />}
          {isEdit ? 'Edit User' : 'Create New User'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 700 000 000" className="h-12" />
            </div>
            <div className="space-y-2">
              <Label>{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} placeholder={isEdit ? '••••••' : 'Min 6 characters'} className="h-12" {...(!isEdit ? { required: true, minLength: 6 } : {})} />
            </div>
            <div className="space-y-2">
              <Label>Branch</Label>
              <select value={form.branch_id} onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))}
                className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                <option value="">No branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role *</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(roleLabels) as [Role, string][]).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setForm(f => ({ ...f, role: key }))}
                  className={cn(
                    "px-4 py-3 rounded-xl border text-sm font-medium transition-colors",
                    form.role === key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                  )}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending || !form.role}>
            {mutation.isPending ? <Loader2 className="animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {isEdit ? 'Save Changes' : 'Create User'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default UserForm;
