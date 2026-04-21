import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Pencil, Trash2, Loader2, Search, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ServiceForm {
    name: string;
    category: string;
    base_price: string;
}

const emptyForm: ServiceForm = { name: '', category: '', base_price: '0' };

const serviceCategories = ['Transport', 'Decoration', 'Ceremony', 'Embalming', 'Cleaning', 'Other'];

const ServiceCatalogueManager = () => {
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<ServiceForm>(emptyForm);
    const [search, setSearch] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: services, isLoading } = useQuery({
        queryKey: ['inventory-services'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('inventory_services')
                .select('*')
                .order('name');
            if (error) throw error;
            return data || [];
        },
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!form.name.trim() || !form.category) throw new Error('Name and category are required');
            const payload = {
                name: form.name.trim(),
                category: form.category,
                base_price: parseFloat(form.base_price) || 0,
                // retain other fields at defaults for new entries
                quantity: 1,
                condition: 'good',
            };
            if (editId) {
                const { error } = await supabase.from('inventory_services').update(payload).eq('id', editId);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('inventory_services').insert(payload);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast({ title: editId ? 'Service updated' : 'Service added' });
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['inventory-services'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-services-types'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-services-overview'] });
        },
        onError: (err: Error) => {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('inventory_services').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Service deleted' });
            queryClient.invalidateQueries({ queryKey: ['inventory-services'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-services-types'] });
            queryClient.invalidateQueries({ queryKey: ['inventory-services-overview'] });
        },
        onError: (err: Error) => {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        },
    });

    const resetForm = () => {
        setForm(emptyForm);
        setEditId(null);
        setShowForm(false);
    };

    const startEdit = (svc: any) => {
        setForm({
            name: svc.name,
            category: svc.category || '',
            base_price: String(svc.base_price || 0),
        });
        setEditId(svc.id);
        setShowForm(true);
    };

    const filtered = (services || []).filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.category || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-display text-base font-semibold text-foreground">Service Catalogue</h3>
                <p className="text-xs text-muted-foreground">Add services here before they can be sold. A service can be sold repeatedly.</p>
            </div>

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filtered.length} service{filtered.length !== 1 ? 's' : ''}</p>
                <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
                    {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showForm ? 'Cancel' : 'Add Service'}
                </Button>
            </div>

            {showForm && (
                <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-primary" />
                            {editId ? 'Edit Service' : 'Add New Service'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }}
                            className="space-y-4"
                        >
                            <div className="space-y-2">
                                <Label>Service Name *</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Embalming, Hearse Hire"
                                    className="h-12"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Category *</Label>
                                <div className="flex flex-wrap gap-1.5">
                                    {serviceCategories.map(cat => (
                                        <button
                                            key={cat}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, category: cat }))}
                                            className={cn(
                                                'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                                                form.category === cat
                                                    ? 'bg-primary text-primary-foreground border-primary'
                                                    : 'bg-card text-foreground border-border hover:bg-accent'
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Base Price (Ksh)</Label>
                                <Input
                                    type="number"
                                    value={form.base_price}
                                    onChange={(e) => setForm(f => ({ ...f, base_price: e.target.value }))}
                                    placeholder="0"
                                    className="h-12"
                                    min="0"
                                    step="0.01"
                                />
                            </div>

                            <Button
                                type="submit"
                                size="lg"
                                className="w-full"
                                disabled={saveMutation.isPending || !form.name || !form.category}
                            >
                                {saveMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                                {editId ? 'Update Service' : 'Add Service'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search services..."
                    className="pl-10 h-11"
                />
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-16" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-card rounded-2xl border p-12 text-center">
                    <Briefcase className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No services in catalogue</p>
                    <p className="text-xs text-muted-foreground mt-1">Add a service above before recording a sale</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((svc) => (
                        <Card key={svc.id} className="border">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
                                    <Briefcase className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{svc.name}</p>
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-0.5">
                                        <span className="bg-secondary px-2 py-0.5 rounded-md">{svc.category}</span>
                                        <span>Ksh {svc.base_price?.toLocaleString() || 0}</span>
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <Button variant="ghost" size="icon" onClick={() => startEdit(svc)} className="h-8 w-8">
                                        <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            if (confirm('Delete this service? It will no longer be available for sale.')) {
                                                deleteMutation.mutate(svc.id);
                                            }
                                        }}
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
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

export default ServiceCatalogueManager;
