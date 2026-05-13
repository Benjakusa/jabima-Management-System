import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Plus, X, Loader2, Clock, CheckCircle, XCircle, ArrowRight, Warehouse, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import IncomingTransfers from './IncomingTransfers';

const ProductReturns = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [finishedProductId, setFinishedProductId] = useState('');
    const [returnDest, setReturnDest] = useState<'warehouse' | 'branch'>('warehouse');
    const [destinationBranchId, setDestinationBranchId] = useState('');
    const [reason, setReason] = useState('');
    const [tab, setTab] = useState<'my' | 'incoming'>('my');

    const { data: branchProducts } = useQuery({
        queryKey: ['branch-products-for-return', profile?.branch_id],
        queryFn: async () => {
            const branchId = profile?.branch_id;
            if (branchId) {
                const { data: shopItems } = await supabase
                    .from('shop_inventory' as any)
                    .select('*, finished_products(*)')
                    .eq('branch_id', branchId);
                if (shopItems && shopItems.length > 0) {
                    return shopItems.map((s: any) => s.finished_products).filter(Boolean);
                }
                return [];
            }
            const { data } = await supabase
                .from('finished_products')
                .select('id, product_type, production_cost, completed_at, batch_number')
                .eq('status', 'completed')
                .is('branch_id', null)
                .order('completed_at', { ascending: false });
            return data || [];
        },
        enabled: !!user && !!profile,
    });

    const { data: myReturns, isLoading } = useQuery({
        queryKey: ['my-stock-returns', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('stock_returns' as any)
                .select('*, finished_products(id, product_type, batch_number)')
                .eq('returned_by', user!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => {
            const { data } = await supabase.from('branches').select('id, name').order('name');
            return data || [];
        },
    });

    const returnMutation = useMutation({
        mutationFn: async () => {
            if (!finishedProductId) throw new Error('Please select a product');
            const { error } = await supabase.from('stock_returns' as any).insert({
                finished_product_id: finishedProductId,
                returned_by: user!.id,
                return_reason: reason.trim() || null,
                is_unsold: true,
                destination_branch_id: returnDest === 'branch' ? destinationBranchId : null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Return/Transfer submitted' });
            setShowForm(false);
            setFinishedProductId('');
            setReason('');
            queryClient.invalidateQueries({ queryKey: ['my-stock-returns'] });
            queryClient.invalidateQueries({ queryKey: ['branch-products-for-return'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-3 w-3 text-warning" />;
            case 'accepted': return <CheckCircle className="h-3 w-3 text-success" />;
            case 'rejected': return <XCircle className="h-3 w-3 text-destructive" />;
            default: return <Clock className="h-3 w-3 text-warning" />;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <button onClick={() => setTab('my')}
                    className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
                        tab === 'my' ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                    )}>
                    <RotateCcw className="h-4 w-4" />
                    My Transfers
                </button>
                <button onClick={() => setTab('incoming')}
                    className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
                        tab === 'incoming' ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
                    )}>
                    <ArrowRight className="h-4 w-4" />
                    Incoming
                </button>
            </div>

            {tab === 'incoming' ? (
                <IncomingTransfers />
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                            <RotateCcw className="h-4 w-4 text-primary" /> My Transfers
                        </h3>
                        <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? 'ghost' : 'default'} className="h-8">
                            {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            {showForm ? 'Cancel' : 'Transfer Product'}
                        </Button>
                    </div>

                    {showForm && (
                        <Card className="border-primary/20">
                            <CardContent className="p-4 space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs">Select Product (from {profile?.branch_id ? 'your branch' : 'stock'})</Label>
                                    <select value={finishedProductId} onChange={e => setFinishedProductId(e.target.value)}
                                        className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs">
                                        <option value="">Choose product...</option>
                                        {((branchProducts as any) || []).map((p: any) => (
                                            <option key={p.id} value={p.id}>
                                                {p.product_type} - {p.batch_number || p.id.slice(0, 8)}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Destination</Label>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => { setReturnDest('warehouse'); setDestinationBranchId(''); }}
                                            className={cn("flex-1 py-2 rounded-lg text-[10px] font-medium border flex items-center justify-center gap-1.5",
                                                returnDest === 'warehouse' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
                                            <Warehouse className="h-3.5 w-3.5" />
                                            Main Warehouse
                                        </button>
                                        <button type="button" onClick={() => setReturnDest('branch')}
                                            className={cn("flex-1 py-2 rounded-lg text-[10px] font-medium border flex items-center justify-center gap-1.5",
                                                returnDest === 'branch' ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
                                            <Building2 className="h-3.5 w-3.5" />
                                            Other Branch
                                        </button>
                                    </div>
                                    {returnDest === 'branch' && (
                                        <select value={destinationBranchId} onChange={e => setDestinationBranchId(e.target.value)}
                                            className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs">
                                            <option value="">Select branch...</option>
                                            {(branches || []).filter((b: any) => b.id !== profile?.branch_id).map((b: any) => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs">Reason</Label>
                                    <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Defective, excess stock, transfer..." className="text-xs min-h-[60px]" />
                                </div>
                                <Button className="w-full h-9 text-xs" onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending || !finishedProductId || (returnDest === 'branch' && !destinationBranchId)}>
                                    {returnMutation.isPending && <Loader2 className="animate-spin mr-2 h-3 w-3" />}
                                    Submit
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    <div className="space-y-2">
                        {isLoading ? (
                            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                        ) : ((myReturns as any) || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-8">No transfers made yet</p>
                        ) : (
                            ((myReturns as any) || []).map((ret: any) => (
                                <Card key={ret.id} className="border">
                                    <CardContent className="p-3 flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium">{ret.finished_products?.product_type || 'Unknown Product'}</p>
                                            <div className="flex items-center gap-3 mt-0.5 text-[9px] text-muted-foreground">
                                                <span className="flex items-center gap-1 capitalize">
                                                    {getStatusIcon(ret.status)}
                                                    {ret.status}
                                                </span>
                                                {ret.destination_branch_id && (
                                                    <span className="flex items-center gap-1">
                                                        <ArrowRight className="h-3 w-3" />
                                                        {branches?.find((b: any) => b.id === ret.destination_branch_id)?.name || 'Branch'}
                                                    </span>
                                                )}
                                                <span>{new Date(ret.created_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        {ret.return_reason && <p className="text-[9px] text-muted-foreground italic truncate max-w-[100px]">{ret.return_reason}</p>}
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default ProductReturns;
