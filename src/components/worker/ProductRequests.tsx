import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
    ClipboardList, Plus, X, Loader2, Clock, CheckCircle,
    XCircle, Package, Search, Box, MapPin, ShoppingCart, Wrench
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductRequests = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [notes, setNotes] = useState('');
    const [inventorySearch, setInventorySearch] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterSource, setFilterSource] = useState<'' | 'workshop' | 'external'>('');
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

    const productTypes = [
        'Simple', 'Half glass', 'High roof',
        'Executive', 'Dumu', 'Saitoti',
        'Dragon', 'Tommy', 'Reagan',
        'English coffin', 'Kupa',
        'Custom Order',
    ];

    const { data: requests, isLoading } = useQuery({
        queryKey: ['my-product-requests', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_requests' as any)
                .select('*, branches(name)')
                .eq('sales_officer_id', profile!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user && !!profile,
    });

    const { data: finishedProducts } = useQuery({
        queryKey: ['main-warehouse-inventory'],
        queryFn: async () => {
            // Get all products already in shop inventory
            const { data: inShop } = await supabase
                .from('shop_inventory')
                .select('finished_product_id');

            // Get all products currently picked in pending or approved requests
            const { data: pendingRequests } = await supabase
                .from('product_requests' as any)
                .select('selected_product_ids')
                .in('status', ['pending', 'approved']);

            const inShopIds = (inShop || []).map((s: any) => s.finished_product_id);
            const pickedIds = (pendingRequests || [])
                .flatMap((r: any) => r.selected_product_ids || []);

            const unavailableIds = Array.from(new Set([...inShopIds, ...pickedIds]));

            let query = supabase
                .from('finished_products')
                .select('*, branches(name), production_orders(product_code, batch_number)')
                .eq('status', 'completed');

            if (unavailableIds.length > 0) {
                query = query.not('id', 'in', `(${unavailableIds.join(',')})`);
            }

            const { data } = await query;
            return data || [];
        },
    });

    const filtered = (finishedProducts || []).filter((p: any) => {
        const matchesSearch =
            (p.product_type || '').toLowerCase().includes(inventorySearch.toLowerCase()) ||
            p.id.toLowerCase().includes(inventorySearch.toLowerCase()) ||
            (p.supplier_name || '').toLowerCase().includes(inventorySearch.toLowerCase());
        const matchesType = !filterType || p.product_type === filterType;
        const matchesSource = !filterSource || (p.source_type || 'workshop') === filterSource;
        return matchesSearch && matchesType && matchesSource;
    });

    const requestMutation = useMutation({
        mutationFn: async () => {
            const items = (finishedProducts || []).filter((p: any) => selectedProductIds.includes(p.id));
            const types = Array.from(new Set(items.map((p: any) => p.product_type)));
            const derivedType = types.length === 1 ? types[0] : 'Mixed';

            const { error } = await supabase.from('product_requests' as any).insert({
                product_type: derivedType,
                quantity: selectedProductIds.length,
                sales_officer_id: profile!.id,
                branch_id: profile!.branch_id,
                notes: notes.trim() || null,
                selected_product_ids: selectedProductIds,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Request submitted' });
            setShowForm(false);
            setNotes('');
            setSelectedProductIds([]);
            queryClient.invalidateQueries({ queryKey: ['my-product-requests'] });
            queryClient.invalidateQueries({ queryKey: ['main-warehouse-inventory'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const toggleSelection = (id: string) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-3 w-3 text-warning" />;
            case 'approved': return <CheckCircle className="h-3 w-3 text-primary" />;
            case 'fulfilled': return <Package className="h-3 w-3 text-success" />;
            case 'rejected': return <XCircle className="h-3 w-3 text-destructive" />;
            default: return null;
        }
    };

    const formatCurrency = (val: number) => `Ksh ${(val || 0).toLocaleString()}`;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" /> My Product Requests
                </h3>
                <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? 'secondary' : 'default'} className="h-8">
                    {showForm ? <X className="h-3.5 w-3.5 mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                    {showForm ? 'Close Directory' : 'New Request (Pick Items)'}
                </Button>
            </div>

            {showForm && (
                <Card className="border-primary/20 shadow-sm bg-accent/5">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-bold text-primary flex items-center gap-2">
                                    <Package className="h-4 w-4" /> Pick Items from Main Warehouse
                                </Label>
                                <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                                    {selectedProductIds.length} items picked
                                </Badge>
                            </div>

                            {/* Filters matching Inventory Dashboard */}
                            <div className="flex gap-2 flex-wrap">
                                <div className="relative flex-1 min-w-[140px]">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        value={inventorySearch}
                                        onChange={e => setInventorySearch(e.target.value)}
                                        placeholder="Search by ID or supplier..."
                                        className="pl-8 h-9 text-xs"
                                    />
                                </div>
                                <select
                                    value={filterType}
                                    onChange={e => setFilterType(e.target.value)}
                                    className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                                >
                                    <option value="">All Types</option>
                                    {productTypes.map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                                <select
                                    value={filterSource}
                                    onChange={e => setFilterSource(e.target.value as any)}
                                    className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                                >
                                    <option value="">All Sources</option>
                                    <option value="external">External</option>
                                    <option value="workshop">Workshop</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto p-1 border rounded-lg bg-background/50">
                                {filtered.length === 0 ? (
                                    <p className="text-[10px] text-muted-foreground text-center py-8 italic">No matching items found in warehouse</p>
                                ) : (
                                    filtered.map((p: any) => {
                                        const selected = selectedProductIds.includes(p.id);
                                        const isExternal = p.source_type === 'external';
                                        return (
                                            <div
                                                key={p.id}
                                                onClick={() => toggleSelection(p.id)}
                                                className={cn(
                                                    "cursor-pointer transition-all border rounded-xl p-3 relative",
                                                    selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:bg-accent/50"
                                                )}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-semibold text-xs text-foreground truncate">{p.product_type}</p>
                                                            <span className={cn(
                                                                "text-[8px] font-bold px-1 py-0.5 rounded-full shrink-0",
                                                                isExternal ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"
                                                            )}>
                                                                {isExternal ? '🛒 External' : '🔨 Workshop'}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
                                                            <span className="flex items-center gap-1 font-mono">
                                                                <Box className="h-2.5 w-2.5" /> {p.id.slice(0, 8)}
                                                            </span>
                                                            {isExternal ? (
                                                                <>
                                                                    {p.batch_number && <span className="font-mono bg-accent/50 px-1 rounded">{p.batch_number}</span>}
                                                                    <span>Bought: {formatCurrency(p.purchase_price)}</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {p.production_orders?.product_code && <span className="font-mono">{p.production_orders.product_code}</span>}
                                                                    <span>Cost: {formatCurrency(p.production_cost)}</span>
                                                                </>
                                                            )}
                                                            <span className="flex items-center gap-1">
                                                                <MapPin className="h-2.5 w-2.5" />
                                                                {p.branches?.name || p.location || 'Warehouse'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {selected && <CheckCircle className="h-4 w-4 text-primary shrink-0 ml-2" />}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs">Notes (optional)</Label>
                            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Urgency, specifics..." className="h-9 text-xs" />
                        </div>
                        <Button className="w-full h-9 text-xs" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || selectedProductIds.length === 0}>
                            {requestMutation.isPending && <Loader2 className="animate-spin mr-2 h-3 w-3" />}
                            Submit Request ({selectedProductIds.length} items)
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-2">
                {isLoading ? (
                    <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : ((requests as any) || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No requests made yet</p>
                ) : (
                    ((requests as any) || []).map((req: any) => (
                        <Card key={req.id} className={cn("border", req.status === 'fulfilled' ? 'border-success/30 bg-success/5' : '')}>
                            <CardContent className="p-3 flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium">{req.product_type}</span>
                                        <span className="text-[10px] text-muted-foreground">x{req.quantity}</span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-[9px] text-muted-foreground">
                                        <span className="flex items-center gap-1 capitalize">
                                            {getStatusIcon(req.status)}
                                            {req.status}
                                        </span>
                                        <span>{new Date(req.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {req.notes && <p className="text-[9px] text-muted-foreground italic truncate max-w-[100px]">{req.notes}</p>}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProductRequests;
