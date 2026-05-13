import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Building2, Pencil, Search, MapPin, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const BranchManagementPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', location: '', address: '', phone: '', manager_id: '' });
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: branches, isLoading } = useQuery({
    queryKey: ['branches-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-list'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name');
      return data || [];
    },
  });

  const getManagerName = (managerId: string | null) => {
    if (!managerId) return null;
    return profiles?.find((p: any) => p.user_id === managerId)?.full_name || null;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error('Branch name is required');
      const payload: any = {
        name: form.name.trim(),
        location: form.location.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        manager_id: form.manager_id || null,
        updated_at: new Date().toISOString(),
      };
      if (editId) {
        const { error } = await supabase.from('branches').update(payload).eq('id', editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches').insert({
          name: payload.name,
          location: payload.location,
          address: payload.address,
          phone: payload.phone,
          manager_id: payload.manager_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editId ? 'Branch updated' : 'Branch created' });
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['branches-settings'] });
      queryClient.invalidateQueries({ queryKey: ['branches-list'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const resetForm = () => {
    setForm({ name: '', location: '', address: '', phone: '', manager_id: '' });
    setEditId(null);
    setShowForm(false);
  };

  const startEdit = (b: any) => {
    setForm({
      name: b.name,
      location: b.location || '',
      address: b.address || '',
      phone: b.phone || '',
      manager_id: b.manager_id || '',
    });
    setEditId(b.id);
    setShowForm(true);
  };

  const filtered = (branches || []).filter((b: any) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    (b.location || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Branches</h2>
          <p className="text-sm text-muted-foreground">Manage branch locations and details</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'Add Branch'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {editId ? 'Edit Branch' : 'New Branch'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Branch Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Nairobi Main" className="h-12" required />
                </div>
                <div className="space-y-2">
                  <Label>Location</Label>
                  <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Mombasa Road" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Full address" className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+254 ..." className="h-12" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Branch Manager</Label>
                  <select value={form.manager_id} onChange={(e) => setForm(f => ({ ...f, manager_id: e.target.value }))}
                    className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm">
                    <option value="">No manager assigned</option>
                    {(profiles || []).map((p: any) => <option key={p.user_id} value={p.user_id}>{p.full_name}</option>)}
                  </select>
                </div>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.name.trim()}>
                {saveMutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {editId ? 'Update Branch' : 'Create Branch'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search branches..." className="pl-10 h-11" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border"><CardContent className="p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No branches found</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((b: any) => (
            <Card key={b.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Building2 className="h-4 w-4 text-primary shrink-0" />
                      <p className="font-medium text-foreground truncate">{b.name}</p>
                    </div>
                    <div className="space-y-0.5 text-xs text-muted-foreground">
                      {b.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.location}</span>}
                      {b.address && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.address}</span>}
                      {b.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{b.phone}</span>}
                      {getManagerName(b.manager_id) && <span className="flex items-center gap-1"><User className="h-3 w-3" />{getManagerName(b.manager_id)}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => startEdit(b)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BranchManagementPage;
