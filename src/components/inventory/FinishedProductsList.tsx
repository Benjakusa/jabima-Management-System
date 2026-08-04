import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Pencil, Trash2, Loader2, Search, Package, MapPin, ShoppingCart, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type SourceMode = 'workshop' | 'external';

interface WorkshopForm {
    product_type: string;
    custom_name: string;
    batch_number: string;
    production_cost: string;
    location: string;
    branch_id: string;
}

interface ExternalForm {
    product_type: string;
    custom_name: string;
    batch_number: string;
    purchase_price: string;
    supplier_name: string;
    quantity: string;
    location: string;
    branch_id: string;
    notes: string;
}

interface ExternalLine {
    product_type: string;
    custom_name: string;
    quantity: string;
    purchase_price: string;
    supplier_name: string;
    notes: string;
}

const emptyWorkshop: WorkshopForm = {
    product_type: '', custom_name: '', batch_number: '', production_cost: '0', location: 'main_warehouse', branch_id: '',
};

const emptyExternal: ExternalForm = {
    product_type: 'Custom Order', custom_name: '', batch_number: '', purchase_price: '0', supplier_name: '', quantity: '1',
    location: 'main_warehouse', branch_id: '', notes: '',
};

const emptyLine: ExternalLine = {
    product_type: '', custom_name: '', quantity: '1', purchase_price: '0', supplier_name: '', notes: '',
};

// ─── Coffin types ────────────────────────────────────────────────────────────

const FALLBACK_TYPES = ['Simple', 'Half glass', 'High roof', 'Executive', 'Dumu', 'Saitoti', 'Dragon', 'Tommy', 'Reagan', 'English coffin', 'Kupa', 'Custom Order'];

// ─── Component ───────────────────────────────────────────────────────────────

const FinishedProductsList = () => {
    const [showForm, setShowForm] = useState(false);
    const [mode, setMode] = useState<SourceMode>('external'); // default to external for new entries
    const [editId, setEditId] = useState<string | null>(null);
    const [workshopForm, setWorkshopForm] = useState<WorkshopForm>(emptyWorkshop);
    const [externalForm, setExternalForm] = useState<ExternalForm>(emptyExternal);
    const [externalLines, setExternalLines] = useState<ExternalLine[]>([{ ...emptyLine }]);
    const [addLocation, setAddLocation] = useState('main_warehouse');
    const [addBranchId, setAddBranchId] = useState('');
    const [search, setSearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterSource, setFilterSource] = useState<'' | 'workshop' | 'external'>('');
    const [productTypes, setProductTypes] = useState<string[]>(FALLBACK_TYPES);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    useQuery({
        queryKey: ['products-type-list'],
        queryFn: async () => {
            const { data } = await supabase.from('products').select('name').eq('is_active', true).order('name');
            if (data && data.length > 0) setProductTypes(data.map((p: any) => p.name));
            return data || [];
        },
    });

    const { data: products, isLoading } = useQuery({
        queryKey: ['finished-products'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('finished_products')
                .select('*, branches(name), production_orders(product_code, batch_number)')
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

    // ── Save mutation ──────────────────────────────────────────────────────

    const saveMutation = useMutation({
        mutationFn: async () => {
            if (mode === 'external') {
                if (editId) {
                    const qty = parseInt(externalForm.quantity) || 1;
                    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
                    const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
                    const baseBatch = `EXT-${dateStr}-${randomStr}`;
                    const finalType = externalForm.product_type === 'Custom Order'
                        ? externalForm.custom_name.trim()
                        : externalForm.product_type;
                    const rows = Array.from({ length: qty }, (_, i): any => ({
                        product_type: finalType,
                        source_type: 'external',
                        production_cost: 0,
                        branch_id: externalForm.branch_id || null,
                        status: 'completed',
                        completed_at: new Date().toISOString(),
                        location: externalForm.location || 'main_warehouse',
                        purchase_price: parseFloat(externalForm.purchase_price) || 0,
                        supplier_name: externalForm.supplier_name.trim() || null,
                        notes: externalForm.notes.trim() || null,
                        batch_number: qty === 1 ? baseBatch : `${baseBatch}-${i + 1}`,
                    }));

                    const { error } = await supabase.from('finished_products').update(rows[0]).eq('id', editId);
                    if (error) throw error;
                } else {
                    // Validate every product line BEFORE saving to prevent partial saves.
                    for (const line of externalLines) {
                        const typeValid =
                            line.product_type.trim() !== '' &&
                            (line.product_type !== 'Custom Order' || line.custom_name.trim() !== '');
                        const qty = parseInt(line.quantity);
                        if (!typeValid) throw new Error('Every product line requires a product name');
                        if (isNaN(qty) || qty < 1) throw new Error('Quantity must be at least 1 for every product line');
                    }

                    const rows: any[] = [];
                    externalLines.forEach(line => {
                        const qty = parseInt(line.quantity) || 1;
                        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(2);
                        const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
                        const baseBatch = `EXT-${dateStr}-${randomStr}`;
                        const finalType = line.product_type === 'Custom Order'
                            ? line.custom_name.trim()
                            : line.product_type;
                        for (let i = 0; i < qty; i++) {
                            rows.push({
                                product_type: finalType,
                                source_type: 'external',
                                production_cost: 0,
                                branch_id: addBranchId || null,
                                status: 'completed',
                                completed_at: new Date().toISOString(),
                                location: addLocation || 'main_warehouse',
                                purchase_price: parseFloat(line.purchase_price) || 0,
                                supplier_name: line.supplier_name.trim() || null,
                                notes: line.notes.trim() || null,
                                batch_number: qty === 1 ? baseBatch : `${baseBatch}-${i + 1}`,
                            });
                        }
                    });

                    // Single insert statement = single atomic transaction (all or nothing).
                    const { error } = await supabase.from('finished_products').insert(rows);
                    if (error) throw error;
                }
            } else {
                const finalType = workshopForm.product_type === 'Custom Order'
                    ? workshopForm.custom_name.trim()
                    : workshopForm.product_type;
                const payload: any = {
                    product_type: finalType,
                    production_cost: parseFloat(workshopForm.production_cost) || 0,
                    branch_id: workshopForm.branch_id || null,
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    location: workshopForm.location || 'main_warehouse',
                };
                if (workshopForm.batch_number) {
                    payload.batch_number = workshopForm.batch_number;
                }
                if (editId) {
                    const { error } = await supabase.from('finished_products').update(payload).eq('id', editId);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('finished_products').insert(payload);
                    if (error) throw error;
                }
            }
        },
        onSuccess: () => {
            const qty = mode === 'external'
                ? (editId
                    ? (parseInt(externalForm.quantity) || 1)
                    : externalLines.reduce((sum, l) => sum + (parseInt(l.quantity) || 0), 0))
                : 1;
            toast({
                title: editId ? 'Product updated' : `${qty} product${qty !== 1 ? 's' : ''} added to inventory`,
                description: mode === 'external' ? 'External stock recorded successfully.' : undefined,
            });
            resetForm();
            queryClient.invalidateQueries({ queryKey: ['finished-products'] });
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
            queryClient.invalidateQueries({ queryKey: ['finished-products'] });
        },
        onError: (err: Error) => {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        },
    });

    // ── Helpers ────────────────────────────────────────────────────────────

    const resetForm = () => {
        setWorkshopForm(emptyWorkshop);
        setExternalForm(emptyExternal);
        setExternalLines([{ ...emptyLine }]);
        setAddLocation('main_warehouse');
        setAddBranchId('');
        setEditId(null);
        setShowForm(false);
    };

    const addLine = () => setExternalLines(ls => [...ls, { ...emptyLine }]);

    const updateLine = (idx: number, patch: Partial<ExternalLine>) =>
        setExternalLines(ls => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

    const removeLine = (idx: number) =>
        setExternalLines(ls => (ls.length > 1 ? ls.filter((_, i) => i !== idx) : ls));

    const startEdit = (product: any) => {
        const src: SourceMode = (product.source_type === 'external' || (!product.source_type && product.purchase_price && !product.production_cost)) ? 'external' : 'workshop';
        setMode(src);
        if (src === 'external') {
            const isCustom = productTypes.every(t => t !== product.product_type);
            setExternalForm({
                product_type: isCustom ? 'Custom Order' : product.product_type || '',
                custom_name: isCustom ? product.product_type : '',
                batch_number: product.batch_number || '',
                purchase_price: String(product.purchase_price || 0),
                supplier_name: product.supplier_name || '',
                quantity: '1',
                location: product.location || 'main_warehouse',
                branch_id: product.branch_id || '',
                notes: product.notes || '',
            });
        } else {
            const isCustom = productTypes.every(t => t !== product.product_type);
            setWorkshopForm({
                product_type: isCustom ? 'Custom Order' : product.product_type || '',
                custom_name: isCustom ? product.product_type : '',
                batch_number: product.batch_number || '',
                production_cost: String(product.production_cost || 0),
                location: product.location || 'main_warehouse',
                branch_id: product.branch_id || '',
            });
        }
        setEditId(product.id);
        setShowForm(true);
    };

    const filtered = (products || []).filter(p => {
        const matchesSearch =
            (p.product_type || '').toLowerCase().includes(search.toLowerCase()) ||
            p.id.toLowerCase().includes(search.toLowerCase()) ||
            (p.supplier_name || '').toLowerCase().includes(search.toLowerCase());
        const matchesType = !filterType || p.product_type === filterType;
        const matchesSource = !filterSource || (p.source_type || 'workshop') === filterSource;
        return matchesSearch && matchesType && matchesSource;
    });

    const formatCurrency = (val: number) => `Ksh ${(val || 0).toLocaleString()}`;

    const isExternalFormValid =
        externalForm.product_type.trim() !== '' &&
        (externalForm.product_type !== 'Custom Order' || externalForm.custom_name.trim() !== '') &&
        parseInt(externalForm.quantity) >= 1;

    const areAllLinesValid =
        externalLines.length > 0 &&
        externalLines.every(l =>
            l.product_type.trim() !== '' &&
            (l.product_type !== 'Custom Order' || l.custom_name.trim() !== '') &&
            parseInt(l.quantity) >= 1
        );

    const totalLineQty = externalLines.reduce((sum, l) => sum + (parseInt(l.quantity) || 0), 0);

    const isWorkshopFormValid = 
        workshopForm.product_type.trim() !== '' &&
        (workshopForm.product_type !== 'Custom Order' || workshopForm.custom_name.trim() !== '');

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">{filtered.length} coffin{filtered.length !== 1 ? 's' : ''} in store</p>
                <Button onClick={() => { resetForm(); setMode('external'); setShowForm(!showForm); }} size="sm" className="shrink-0">
                    {showForm ? <X className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                    {showForm ? 'Cancel' : 'Add External Stock'}
                </Button>
            </div>

            {/* Form */}
            {showForm && (
                <Card className="border-primary/20">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            {mode === 'external'
                                ? <ShoppingCart className="h-5 w-5 text-primary" />
                                : <Wrench className="h-5 w-5 text-primary" />
                            }
                            {editId ? 'Edit Product' : 'Add External Stock'}
                        </CardTitle>

                        {/* Mode selector — only show when adding new */}
                        {!editId && (
                            <div className="flex gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setMode('external')}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors",
                                        mode === 'external'
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-card text-muted-foreground border-border hover:bg-accent"
                                    )}
                                >
                                    🛒 Purchased / External
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMode('workshop')}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors",
                                        mode === 'workshop'
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-card text-muted-foreground border-border hover:bg-accent"
                                    )}
                                >
                                    🔨 Workshop Made
                                </button>
                            </div>
                        )}
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">

                            {/* ── Bulk multi-line editor: external add mode ── */}
                            {mode === 'external' && !editId && (
                                <>
                                    <div className="space-y-3">
                                        <Label>Products to Add</Label>
                                        {externalLines.map((line, idx) => (
                                            <div key={idx} className="border rounded-xl p-3 space-y-2 bg-muted/20">
                                                <div className="flex items-center justify-between">
                                                    <Label>Product {idx + 1}</Label>
                                                    {externalLines.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 text-destructive hover:text-destructive"
                                                            onClick={() => removeLine(idx)}
                                                        >
                                                            <X className="h-3.5 w-3.5" /> Remove
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <Input
                                                        value={line.product_type}
                                                        onChange={e => updateLine(idx, { product_type: e.target.value })}
                                                        placeholder="Product name — e.g. Simple Coffin, Kupa, White Cloth"
                                                        className="h-12"
                                                        list="external-product-type-suggestions"
                                                    />
                                                    <datalist id="external-product-type-suggestions">
                                                        {productTypes.filter(t => t !== 'Custom Order').map(t => (
                                                            <option key={t} value={t} />
                                                        ))}
                                                    </datalist>
                                                </div>
                                                {line.product_type === 'Custom Order' && (
                                                    <div className="space-y-2">
                                                        <Label>Custom Product Name</Label>
                                                        <Input
                                                            value={line.custom_name}
                                                            onChange={e => updateLine(idx, { custom_name: e.target.value })}
                                                            placeholder="Enter custom product name"
                                                            className="h-12"
                                                            required
                                                        />
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="space-y-1">
                                                        <Label>Quantity</Label>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={line.quantity}
                                                            onChange={e => updateLine(idx, { quantity: e.target.value })}
                                                            placeholder="How many?"
                                                            className="h-12"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label>Purchase Price (Ksh)</Label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={line.purchase_price}
                                                            onChange={e => updateLine(idx, { purchase_price: e.target.value })}
                                                            placeholder="Unit price"
                                                            className="h-12"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Supplier (optional)</Label>
                                                    <Input
                                                        value={line.supplier_name}
                                                        onChange={e => updateLine(idx, { supplier_name: e.target.value })}
                                                        placeholder="e.g. Nairobi Casket Supplies"
                                                        className="h-12"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label>Notes (optional)</Label>
                                                    <Input
                                                        value={line.notes}
                                                        onChange={e => updateLine(idx, { notes: e.target.value })}
                                                        placeholder="Optional notes for these items"
                                                        className="h-12"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                        <Button type="button" variant="outline" size="sm" className="w-full" onClick={addLine}>
                                            <Plus className="h-4 w-4 mr-2" /> Add Another Product
                                        </Button>
                                    </div>

                                    {/* Shared fields for the whole bulk addition */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Storage Location</Label>
                                            <Input
                                                value={addLocation}
                                                onChange={e => setAddLocation(e.target.value)}
                                                placeholder="e.g. Aisle 4, Shelf B"
                                                className="h-12"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Branch (if assigned)</Label>
                                            <select
                                                value={addBranchId}
                                                onChange={e => setAddBranchId(e.target.value)}
                                                className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm"
                                            >
                                                <option value="">Main Warehouse / Unassigned</option>
                                                {(branches || []).map(b => (
                                                    <option key={b.id} value={b.id}>{b.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* ── Single product form: editing an external product or workshop mode ── */}
                            {(mode === 'external' && editId) || mode === 'workshop' ? (
                            <>
                            {/* Coffin type picker — shared */}
                            <div className="space-y-2">
                                <Label>Coffin Type</Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 sm:grid-cols-4 gap-2">
                                    {productTypes.map(type => {
                                        const selected = mode === 'external'
                                            ? externalForm.product_type === type
                                            : workshopForm.product_type === type;
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => {
                                                    if (mode === 'external') setExternalForm(f => ({ ...f, product_type: type }));
                                                    else setWorkshopForm(f => ({ ...f, product_type: type }));
                                                }}
                                                className={cn(
                                                    "px-3 py-2.5 rounded-xl text-[10px] font-medium border transition-colors text-center",
                                                    selected
                                                        ? "bg-primary text-primary-foreground border-primary"
                                                        : "bg-card text-foreground border-border hover:bg-accent"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Custom name input for Custom Order */}
                            {mode === 'external' && externalForm.product_type === 'Custom Order' && (
                                <div className="space-y-2">
<Label>Custom Product Name</Label>
                                    <Input
                                        value={externalForm.custom_name}
                                        onChange={e => setExternalForm(f => ({ ...f, custom_name: e.target.value }))}
                                        placeholder="Enter custom product name"
                                        className="h-12"
                                        required
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Batch Number <span className="text-muted-foreground text-[10px]">(optional)</span></Label>
                                <Input
                                    value={mode === 'external' ? externalForm.batch_number : workshopForm.batch_number}
                                    onChange={e => mode === 'external' 
                                        ? setExternalForm(f => ({ ...f, batch_number: e.target.value }))
                                        : setWorkshopForm(f => ({ ...f, batch_number: e.target.value }))
                                    }
                                    placeholder="e.g. BATCH-2026-001"
                                    className="h-12"
                                />
                            </div>

                            {/* Custom name input for workshop Custom Order */}
                            {mode === 'workshop' && workshopForm.product_type === 'Custom Order' && (
                                <div className="space-y-2">
                                    <Label>Custom Product Name</Label>
                                    <Input
                                        value={workshopForm.custom_name}
                                        onChange={e => setWorkshopForm(f => ({ ...f, custom_name: e.target.value }))}
                                        placeholder="Enter custom product name"
                                        className="h-12"
                                        required
                                    />
                                </div>
                            )}

                            {/* ── Workshop-only fields ── */}
                            {mode === 'workshop' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Production Cost (Ksh)</Label>
                                        <Input
                                            type="number"
                                            value={workshopForm.production_cost}
                                            onChange={e => setWorkshopForm(f => ({ ...f, production_cost: e.target.value }))}
                                            className="h-12"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Storage Location</Label>
                                        <Input
                                            value={workshopForm.location}
                                            onChange={e => setWorkshopForm(f => ({ ...f, location: e.target.value }))}
                                            placeholder="e.g. Aisle 4, Shelf B"
                                            className="h-12"
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label>Branch (if assigned)</Label>
                                        <select
                                            value={workshopForm.branch_id}
                                            onChange={e => setWorkshopForm(f => ({ ...f, branch_id: e.target.value }))}
                                            className="w-full h-12 rounded-lg border border-input bg-background px-3 text-sm"
                                        >
                                            <option value="">Main Warehouse / Unassigned</option>
                                            {(branches || []).map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            )}
                            </>
                            ) : null}

                            <Button
                                type="submit"
                                size="lg"
                                className="w-full"
                                disabled={
                                    saveMutation.isPending ||
                                    (mode === 'external'
                                        ? (editId ? !isExternalFormValid : !areAllLinesValid)
                                        : !isWorkshopFormValid)
                                }
                            >
                                {saveMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                {editId
                                    ? 'Update Product'
                                    : mode === 'external'
                                        ? `Add ${totalLineQty || 1} Product${totalLineQty !== 1 ? 's' : ''} to Store`
                                        : 'Add to Inventory'
                                }
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[140px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by type or supplier..."
                        className="pl-10 h-11"
                    />
                </div>
                <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                >
                    <option value="">All Types</option>
                    {productTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
                <select
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value as any)}
                    className="h-11 rounded-lg border border-input bg-background px-3 text-sm"
                >
                    <option value="">All Sources</option>
                    <option value="external">External</option>
                    <option value="workshop">Workshop</option>
                </select>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-card rounded-2xl border p-12 text-center">
                    <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No coffins in inventory</p>
                    <p className="text-xs text-muted-foreground mt-1">Tap "Add External Stock" to add ready coffins</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map(product => {
                        const isExternal = (product as any).source_type === 'external';
                        return (
                            <Card key={product.id} className="border">
                                <CardContent className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-medium text-foreground truncate">{product.product_type}</p>
                                                <span className={cn(
                                                    "text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                                                    isExternal
                                                        ? "bg-amber-500/10 text-amber-600"
                                                        : "bg-blue-500/10 text-blue-600"
                                                )}>
                                                    {isExternal ? '🛒 External' : '🔨 Workshop'}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <Package className="h-3 w-3" /> {product.id.slice(0, 8)}
                                                </span>
                                                {isExternal ? (
                                                    <>
                                                        {(product as any).batch_number && (
                                                            <span className="font-mono bg-accent px-1 rounded">{(product as any).batch_number}</span>
                                                        )}
                                                        {(product as any).supplier_name && (
                                                            <span>Supplier: {(product as any).supplier_name}</span>
                                                        )}
                                                        <span>Bought: {formatCurrency((product as any).purchase_price || 0)}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        {product.production_orders?.product_code && (
                                                            <span className="font-mono">{product.production_orders.product_code}</span>
                                                        )}
                                                        <span>Cost: {formatCurrency(product.production_cost)}</span>
                                                    </>
                                                )}
                                                <span className="flex items-center gap-1">
                                                    <MapPin className="h-3 w-3" />
                                                    {product.branches?.name || product.location || 'Warehouse'}
                                                </span>
                                                {product.completed_at && (
                                                    <span>Added: {new Date(product.completed_at).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                            {(product as any).notes && (
                                                <p className="text-[10px] text-muted-foreground mt-1 italic">{(product as any).notes}</p>
                                            )}
                                        </div>
                                        <div className="flex gap-1 ml-2 shrink-0">
                                            <Button variant="ghost" size="icon" onClick={() => startEdit(product)} className="h-8 w-8">
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                variant="ghost" size="icon"
                                                onClick={() => {
                                                    if (confirm('Remove this coffin from inventory?')) deleteMutation.mutate(product.id);
                                                }}
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FinishedProductsList;
