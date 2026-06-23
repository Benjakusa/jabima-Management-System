import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, Package, Loader2, Truck, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductRequestProcessing = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'fulfilled'>('pending');
    const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
    const [fulfillDialog, setFulfillDialog] = useState<{ open: boolean; request: any } | null>(null);
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [productSearch, setProductSearch] = useState('');

    const { data: requests, isLoading } = useQuery({
        queryKey: ['product-requests-officer', filter],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_requests')
                .select('*, branches(name), profiles:sales_officer_id(full_name)')
                .eq('status', filter)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id }: { id: string }) => {
            const { error } = await supabase
                .from('product_requests')
                .update({
                    status: 'approved',
                    approved_by: profile!.id,
                    approved_at: new Date().toISOString()
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Request approved' });
            queryClient.invalidateQueries({ queryKey: ['product-requests-officer'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const { error } = await supabase
                .from('product_requests')
                .update({ status: 'rejected', notes: notes || 'Rejected by inventory officer' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Request rejected' });
            queryClient.invalidateQueries({ queryKey: ['product-requests-officer'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const { data: availableProducts } = useQuery({
        queryKey: ['available-finished-products'],
        queryFn: async () => {
            let query = supabase
                .from('finished_products')
                .select('id, product_type, batch_number, production_cost, completed_at, production_orders(batch_number)')
                .eq('status', 'completed')
                .not('status', 'is', 'sold');

            const [existingInShop, pendingRequests] = await Promise.all([
                supabase.from('shop_inventory').select('finished_product_id'),
                supabase.from('product_requests').select('selected_product_ids').in('status', ['pending', 'approved']),
            ]);

            const usedProductIds = (existingInShop?.data || []).map((s: any) => s.finished_product_id);
            const pickedIds = (pendingRequests?.data || []).flatMap((r: any) => r.selected_product_ids || []);

            const unavailableIds = Array.from(new Set([...usedProductIds, ...pickedIds]));

            if (unavailableIds.length > 0) {
                query = query.not('id', 'in', `(${unavailableIds.join(',')})`);
            }

            const { data } = await query;
            return data || [];
        },
        enabled: !!fulfillDialog?.open && !!fulfillDialog?.request,
    });

    const fulfillMutation = useMutation({
        mutationFn: async ({ requestId, productIds, branchId }: { requestId: string; productIds: string[]; branchId: string | null }) => {
            const inserts = productIds.map(productId => ({
                finished_product_id: productId,
                branch_id: branchId || null,
                transferred_by: user!.id,
            }));

            const { error: shopError } = await supabase.from('shop_inventory').insert(inserts);
            if (shopError) throw shopError;

            // Also update finished_products status
            const { error: productError } = await supabase
                .from('finished_products')
                .update({
                    status: 'transferred',
                    branch_id: branchId
                })
                .in('id', productIds);
            if (productError) throw productError;

            const { error: updateError } = await supabase
                .from('product_requests')
                .update({
                    status: 'fulfilled',
                    approved_by: profile!.id,
                    approved_at: new Date().toISOString()
                })
                .eq('id', requestId);
            if (updateError) throw updateError;
        },
        onSuccess: () => {
            toast({ title: 'Product fulfilled and made available to POS' });
            setFulfillDialog(null);
            setSelectedProduct('');
            setProductSearch('');
            queryClient.invalidateQueries({ queryKey: ['product-requests-officer'] });
            queryClient.invalidateQueries({ queryKey: ['available-finished-products'] });
            queryClient.invalidateQueries({ queryKey: ['available-products'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const filteredProducts = (availableProducts || []).filter((p: any) =>
        !productSearch ||
        p.product_type.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.batch_number || '').toLowerCase().includes(productSearch.toLowerCase())
    );

    const filters = [
        { key: 'pending' as const, label: 'Pending', icon: Clock },
        { key: 'approved' as const, label: 'Approved', icon: CheckCircle },
        { key: 'rejected' as const, label: 'Rejected', icon: XCircle },
        { key: 'fulfilled' as const, label: 'Fulfilled', icon: Package },
    ];

    const openFulfill = (req: any) => {
        setFulfillDialog({ open: true, request: req });
        if (req.selected_product_ids && req.selected_product_ids.length > 0) {
            setSelectedProduct(req.selected_product_ids[0]);
        }
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {filters.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)}
                            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border shrink-0",
                                filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-accent"
                            )}>
                            <f.icon className="h-3.5 w-3.5" />
                            {f.label}
                        </button>
                    ))}
                </div>

                {isLoading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />)}
                    </div>
                ) : (requests || []).length === 0 ? (
                    <div className="bg-card rounded-2xl border p-12 text-center">
                        <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-muted-foreground">No {filter} product requests</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {(requests || []).map((req: any) => (
                            <Card key={req.id} className="border">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-foreground">{req.product_type}</p>
                                            <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                                                <p>Agent: {req.profiles?.full_name || 'Unknown'}</p>
                                                <p>Branch: {req.branches?.name || 'Main Warehouse'}</p>
                                                <p>Quantity: <span className="font-semibold text-foreground">{req.quantity}</span></p>
                                                {req.selected_product_ids && req.selected_product_ids.length > 0 && (
                                                    <p className="text-primary font-medium flex items-center gap-1">
                                                        <CheckCircle className="h-2.5 w-2.5" />
                                                        {req.selected_product_ids.length} specific items picked by agent
                                                    </p>
                                                )}
                                                {req.notes && <p className="italic">Note: {req.notes}</p>}
                                            </div>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {new Date(req.created_at).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {filter === 'pending' && (
                                        <div className="space-y-2">
                                            <div className="flex gap-2">
                                                <Button size="sm" onClick={() => approveMutation.mutate({ id: req.id })}
                                                    disabled={approveMutation.isPending}
                                                    className="flex-1 gap-1 bg-primary hover:bg-primary/90">
                                                    {approveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                                    Approve
                                                </Button>
                                                <Button size="sm" variant="outline" onClick={() => {
                                                    const notes = rejectNotes[req.id] || '';
                                                    rejectMutation.mutate({ id: req.id, notes });
                                                }} disabled={rejectMutation.isPending} className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5">
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    Reject
                                                </Button>
                                            </div>
                                            <Textarea
                                                placeholder="Comment (optional)"
                                                value={rejectNotes[req.id] || ''}
                                                onChange={e => setRejectNotes(n => ({ ...n, [req.id]: e.target.value }))}
                                                className="text-[10px] min-h-[40px]"
                                                rows={1}
                                            />
                                        </div>
                                    )}

                                    {filter === 'approved' && (
                                        <div className="pt-2 border-t">
                                            <Button size="sm"
                                                onClick={() => {
                                                    if (req.selected_product_ids && req.selected_product_ids.length > 0) {
                                                        fulfillMutation.mutate({
                                                            requestId: req.id,
                                                            productIds: req.selected_product_ids,
                                                            branchId: req.branch_id
                                                        });
                                                    } else {
                                                        openFulfill(req);
                                                    }
                                                }}
                                                disabled={fulfillMutation.isPending}
                                                className="w-full gap-1 bg-success hover:bg-success/90">
                                                {fulfillMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                                                Fulfill & Make Available to POS
                                                {req.selected_product_ids?.length > 1 ? ` (${req.selected_product_ids.length} items)` : ''}
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={fulfillDialog?.open || false} onOpenChange={(open) => {
                if (!open) { setFulfillDialog(null); setSelectedProduct(''); setProductSearch(''); }
            }}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Truck className="h-5 w-5 text-success" />
                            Fulfill Product Request
                        </DialogTitle>
                    </DialogHeader>
                    {fulfillDialog?.request && (
                        <div className="space-y-4">
                            <div className="bg-accent/50 rounded-lg p-3 space-y-1">
                                <p className="font-medium">{fulfillDialog.request.product_type}</p>
                                <p className="text-xs text-muted-foreground">
                                    For: {fulfillDialog.request.profiles?.full_name || 'Sales Officer'}
                                    {fulfillDialog.request.branches?.name && ` • ${fulfillDialog.request.branches.name}`}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-xs flex items-center gap-1">
                                    <Package className="h-3 w-3" /> Select Product from Inventory
                                </Label>
                                <div className="relative">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        placeholder="Search products..."
                                        value={productSearch}
                                        onChange={e => setProductSearch(e.target.value)}
                                        className="pl-8 h-9 text-sm"
                                    />
                                </div>
                                <div className="border rounded-lg max-h-48 overflow-y-auto">
                                    {filteredProducts.length === 0 ? (
                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                            No available products in inventory
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredProducts.map((p: any) => (
                                                <button key={p.id} type="button"
                                                    onClick={() => setSelectedProduct(p.id)}
                                                    className={cn("w-full px-3 py-2 text-left text-sm flex items-center justify-between hover:bg-accent transition-colors",
                                                        selectedProduct === p.id ? "bg-primary/10 border-l-2 border-primary" : ""
                                                    )}>
                                                    <div>
                                                        <p className="font-medium">{p.product_type}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            Batch: {p.batch_number || p.production_orders?.batch_number || 'N/A'}
                                                        </p>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {p.production_cost ? `Ksh ${p.production_cost.toLocaleString()}` : ''}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => { setFulfillDialog(null); setSelectedProduct(''); setProductSearch(''); }}
                                    className="flex-1">Cancel</Button>
                                <Button onClick={() => fulfillMutation.mutate({
                                    requestId: fulfillDialog.request.id,
                                    productIds: fulfillDialog.request.selected_product_ids && fulfillDialog.request.selected_product_ids.length > 0
                                        ? fulfillDialog.request.selected_product_ids
                                        : [selectedProduct],
                                    branchId: fulfillDialog.request.branch_id,
                                })} disabled={(!selectedProduct && (!fulfillDialog.request.selected_product_ids || fulfillDialog.request.selected_product_ids.length === 0)) || fulfillMutation.isPending}
                                    className="flex-1 bg-success hover:bg-success/90 gap-1">
                                    {fulfillMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Truck className="h-3.5 w-3.5" />}
                                    Fulfill {fulfillDialog.request.selected_product_ids?.length > 1 ? `(${fulfillDialog.request.selected_product_ids.length} items)` : ''}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ProductRequestProcessing;
