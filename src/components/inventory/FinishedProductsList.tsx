import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Pencil, Trash2, Loader2, Search, Package, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FinishedProductForm {
    product_type: string;
    production_cost: string;
    location: string;
    branch_id: string;
}

const emptyForm: FinishedProductForm = {
    product_type: '', production_cost: '0', location: 'main_warehouse', branch_id: '',
};

const productTypes = [
    'Simple', 'Half glass', 'High roof',
    'Executive', 'Dumu', 'Saitoti',
    'Dragon', 'Tommy', 'Reagan',
    'English coffin', 'Kupa',
    'Custom Order',
];

const FinishedProductsList = () => {
    const { user } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState<FinishedProductForm>(emptyForm);
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: products, isLoading } = useQuery({
        queryKey: ['finished-products-list'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('finished_products')
                .select('*, branches(name)')
                .eq('status', 'completed')
                .order('completed_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => {
            const { data } = await supabase.from('branches').select('id, name').order('name');
            return data || [];
        },
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error('Not authenticated');
            const payload = {
                p_product_type: form.product_type,
                p_production_cost: parseFloat(form.production_cost) || 0,
                p_location: form.location.trim() || 'main_warehouse',
                p_branch_id: form.branch_id || null,
                p_edit_id: editId || null,
            };
            const { error } = await (supabase as any).rpc('inventory_upsert_finished_product', payload);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: editId ? 'Product updated' : 'Product added to inventory' });
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['finished-products-list'] });
        },
        onError: (err: Error) => {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('finished_products').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Product removed' });
            queryClient.invalidateQueries({ queryKey: ['finished-products-list'] });
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

    const startEdit = (product: any) => {
        setForm({
            product_type: product.product_type,
            production_cost: String(product.production_cost),
            location: product.location,
            branch_id: product.branch_id || '',
        });
        setEditId(product.id);
        setShowForm(true);
    };

    const filtered = (products || []).filter(p => {
        const matchesSearch = p.product_type.toLowerCase().includes(search.toLowerCase()) ||
            p.id.toLowerCase().includes(search.toLowerCase());
        const matchesType = !filterType || p.product_type === filterType;
        return matchesSearch && matchesType;
    });

    const formatCurrency = (val: number) => `Ksh ${val.toLocaleString()}`;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</p>
                <Button onClick={() => { resetForm(); setShowForm(!showForm); }} size="lg">
                    {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showForm ? 'Cancel' : 'Add Finished Product'}
                </Button>
            </div>

            {showForm && (
                <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Package className="h-5 w-5 text-primary" />
                            {editId ? 'Edit Product' : 'Add Finished Product'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                            <div className="space-y-2">
                                <Label>Product Type</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {productTypes.map(type => (
                                        <button key={type} type="button" onClick={() => setForm(f => ({ ...f, product_type: type }))}
                                            className={cn("px-3 py-2.5 rounded-xl text-[10px] font-medium border transition-colors text-center",
                                                form.product_type === type ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                                            )}>{type}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Production Cost (Ksh)</Label>
                                    <Input type="number" value={form.production_cost} onChange={(e) => setForm(f => ({ ...f, production_cost: e.target.value }))} className="h-12" min="0" step="0.01" required />
                                </div>
                                <div className="space-y-2">
                                    <Label>Storage Location</Label>
                                    <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Aisle 4, Shelf B" className="h-12" />
                                </div>
                                <div className="space-y-2 sm:col-span-2">
                                    <Label>Branch (if assigned)</Label>
                                    <select
                                        value={form.branch_id}
                                        onChange={(e) => setForm(f => ({ ...f, branch_id: e.target.value }))}
                                        className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm"
                                    >
                                        <option value="">Main Warehouse / Unassigned</option>
                                        {(branches || []).map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <Button type="submit" size="lg" className="w-full" disabled={saveMutation.isPending || !form.product_type}>
                                {saveMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                {editId ? 'Update Product' : 'Add to Inventory'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search inventory..." className="pl-10 h-11" />
                </div>
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm min-w-[100px]"
                >
                    <option value="">All Types</option>
                    {productTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-card rounded-2xl border p-12 text-center">
                    <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No finished products in inventory</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((product) => (
                        <Card key={product.id} className="border">
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground truncate">{product.product_type}</p>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground mt-1">
                                            <span className="flex items-center gap-1"><Package className="h-3 w-3" /> {product.id.slice(0, 8)}</span>
                                            <span>Cost: {formatCurrency(product.production_cost)}</span>
                                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {product.branches?.name || product.location || 'Warehouse'}</span>
                                            <span>Completed: {new Date(product.completed_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 ml-2 shrink-0">
                                        <Button variant="ghost" size="icon" onClick={() => startEdit(product)} className="h-8 w-8">
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => {
                                            if (confirm('Remove this product from inventory?')) deleteMutation.mutate(product.id);
                                        }} className="h-8 w-8 text-destructive hover:text-destructive">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default FinishedProductsList;
