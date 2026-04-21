import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, CheckCircle, Loader2, Plus, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const serviceCategories = ['Transport', 'Decoration', 'Ceremony', 'Embalming', 'Cleaning', 'Other'];

const emptyForm = { name: '', category: '', base_price: '0' };

const ServiceManagement = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(emptyForm);

    // All services in catalogue
    const { data: masterServices, isLoading } = useQuery({
        queryKey: ['inventory-services-master'],
        queryFn: async () => {
            const { data, error } = await supabase.from('inventory_services').select('id, name, category, base_price').order('name');
            if (error) throw error;
            return (data || []) as any[];
        },
    });

    // This sales officer's active services
    const { data: myServices } = useQuery({
        queryKey: ['my-available-services', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales_agent_services' as any)
                .select('*')
                .eq('sales_officer_id', user!.id);
            if (error) throw error;
            return (data || []) as any[];
        },
        enabled: !!user,
    });

    // Add a new service to the master catalogue + auto-enable for this officer
    const addServiceMutation = useMutation({
        mutationFn: async () => {
            if (!form.name.trim() || !form.category) throw new Error('Name and category are required');
            const payload = {
                name: form.name.trim(),
                category: form.category,
                base_price: parseFloat(form.base_price) || 0,
                quantity: 1,
                condition: 'good',
            };
            const { data, error } = await supabase.from('inventory_services').insert(payload).select('id, name').single();
            if (error) throw error;
            // Auto-enable for this officer
            if (data) {
                await supabase.from('sales_agent_services' as any).insert({
                    sales_officer_id: user!.id,
                    service_name: data.name,
                    is_active: true,
                });
            }
        },
        onSuccess: () => {
            toast({ title: 'Service added and activated!' });
            setForm(emptyForm);
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['inventory-services-master'] });
            queryClient.invalidateQueries({ queryKey: ['my-available-services'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    // Toggle a service on/off in the officer's POS
    const toggleServiceMutation = useMutation({
        mutationFn: async ({ name, active }: { name: string; active: boolean }) => {
            const existing = (myServices as any[])?.find(s => s.service_name === name);
            if (existing) {
                const { error } = await supabase
                    .from('sales_agent_services' as any)
                    .update({ is_active: !active })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sales_agent_services' as any)
                    .insert({ sales_officer_id: user!.id, service_name: name, is_active: true });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-available-services'] });
            toast({ title: 'Service updated' });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    // Delete a service from the master catalogue
    const deleteServiceMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('inventory_services').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Service removed from catalogue' });
            queryClient.invalidateQueries({ queryKey: ['inventory-services-master'] });
            queryClient.invalidateQueries({ queryKey: ['my-available-services'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    if (isLoading) return <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" /> My Services
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Add services and toggle which ones appear in your POS</p>
                </div>
                <Button size="sm" onClick={() => { setForm(emptyForm); setShowForm(v => !v); }}>
                    {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showForm ? 'Cancel' : 'Add Service'}
                </Button>
            </div>

            {/* Add Service Form */}
            {showForm && (
                <Card className="border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-primary" /> New Service
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={(e) => { e.preventDefault(); addServiceMutation.mutate(); }} className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Service Name *</Label>
                                <Input
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Embalming, Hearse Hire"
                                    className="h-10 text-sm"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Category *</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {serviceCategories.map(cat => (
                                        <button key={cat} type="button"
                                            onClick={() => setForm(f => ({ ...f, category: cat }))}
                                            className={cn(
                                                'px-3 py-1 rounded-lg text-xs font-medium border transition-colors',
                                                form.category === cat
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-card text-foreground border-border hover:bg-accent'
                                            )}>
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Base Price (Ksh)</Label>
                                <Input
                                    type="number"
                                    value={form.base_price}
                                    onChange={e => setForm(f => ({ ...f, base_price: e.target.value }))}
                                    className="h-10 text-sm"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                            <Button type="submit" size="sm" className="w-full"
                                disabled={addServiceMutation.isPending || !form.name || !form.category}>
                                {addServiceMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                                Add & Activate Service
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Service List */}
            <div className="grid grid-cols-1 gap-2">
                {(masterServices || []).map(serviceItem => {
                    const s = (myServices as any[])?.find(ms => ms.service_name === serviceItem.name);
                    const isActive = s ? s.is_active : false;
                    return (
                        <Card key={serviceItem.id}
                            className={cn('border transition-all', isActive && 'border-primary bg-primary/5')}>
                            <CardContent className="p-3 flex items-center justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{serviceItem.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{serviceItem.category} · Ksh {serviceItem.base_price?.toLocaleString() || 0}</p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <Button
                                        size="sm"
                                        variant={isActive ? 'default' : 'outline'}
                                        className="h-7 text-[10px] px-2"
                                        onClick={() => toggleServiceMutation.mutate({ name: serviceItem.name, active: isActive })}
                                        disabled={toggleServiceMutation.isPending}
                                    >
                                        {isActive ? <><CheckCircle className="h-3 w-3 mr-1" />On</> : 'Off'}
                                    </Button>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={() => {
                                            if (confirm(`Delete "${serviceItem.name}" from the catalogue?`)) {
                                                deleteServiceMutation.mutate(serviceItem.id);
                                            }
                                        }}
                                        disabled={deleteServiceMutation.isPending}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
                {(masterServices || []).length === 0 && (
                    <div className="p-8 text-center border border-dashed rounded-xl">
                        <Briefcase className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No services yet. Add one above to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ServiceManagement;
