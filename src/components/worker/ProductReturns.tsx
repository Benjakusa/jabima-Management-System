import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, CheckCircle, XCircle,
  Truck, Send, Inbox
} from 'lucide-react';

const ProductReturns = () => {
    const { user, profile, refreshProfile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [tab, setTab] = useState<'transfer' | 'receive'>('transfer');
    const [transferForm, setTransferForm] = useState({ shop_inventory_ids: [] as string[], to_branch_id: '', notes: '' });

    const { data: myBranch, isLoading: loadingBranch } = useQuery({
        queryKey: ['my-profile-branch', user?.id],
        queryFn: async () => {
            if (!user) return null;
            const { data } = await supabase
                .from('profiles')
                .select('branch_id')
                .eq('user_id', user.id)
                .maybeSingle();
            if (data?.branch_id) {
                await refreshProfile();
            }
            return data as { branch_id: string | null } | null;
        },
        enabled: !!user,
        refetchInterval: 5000,
    });

    const branchId = myBranch?.branch_id || profile?.branch_id;

    const { data: branches } = useQuery({
        queryKey: ['branches-list'],
        queryFn: async () => {
            const { data } = await supabase.from('branches').select('id, name').order('name');
            return data || [];
        },
    });

    const { data: myBranchInventory } = useQuery({
        queryKey: ['my-branch-inventory', branchId],
        queryFn: async () => {
            if (!branchId) return [];
            const { data } = await supabase
                .from('shop_inventory' as any)
                .select('*, finished_products(id, product_type, batch_number)')
                .eq('branch_id', branchId);
            return (data || []) as any[];
        },
        enabled: !!branchId,
    });

    const { data: incomingTransfers, isLoading: loadingIncoming } = useQuery({
        queryKey: ['incoming-interbranch-transfers', branchId],
        queryFn: async () => {
            if (!branchId) return [];
            const { data, error } = await supabase
                .from('interbranch_transfers' as any)
                .select('*, from_branch:branches!from_branch_id(name), finished_products(product_type, batch_number)')
                .eq('to_branch_id', branchId)
                .in('status', ['in_transit'])
                .order('transfer_date', { ascending: false });
            if (error) throw error;
            return (data || []) as any[];
        },
        enabled: !!user && !!branchId,
    });

    const sendTransferMutation = useMutation({
        mutationFn: async () => {
            if (transferForm.shop_inventory_ids.length === 0 || !transferForm.to_branch_id) throw new Error('Select at least one product and destination branch');
            if (!branchId) throw new Error('You must be assigned to a branch');

            const selectedItems = (myBranchInventory || []).filter((i: any) => transferForm.shop_inventory_ids.includes(i.id));
            if (selectedItems.length === 0) throw new Error('No valid products selected');

            const records = selectedItems.map((item: any) => ({
                finished_product_id: item.finished_product_id,
                from_branch_id: branchId,
                to_branch_id: transferForm.to_branch_id,
                quantity: 1,
                initiated_by: user?.id,
                status: 'in_transit' as const,
                notes: transferForm.notes.trim() || null,
            }));

            const { error: insertErr } = await supabase.from('interbranch_transfers' as any).insert(records);
            if (insertErr) throw insertErr;

            const { error: deleteErr } = await supabase
                .from('shop_inventory' as any)
                .delete()
                .in('id', transferForm.shop_inventory_ids);
            if (deleteErr) throw deleteErr;
        },
        onSuccess: () => {
            toast({ title: `${transferForm.shop_inventory_ids.length} product(s) transferred!` });
            setTransferForm({ shop_inventory_ids: [], to_branch_id: '', notes: '' });
            queryClient.invalidateQueries({ queryKey: ['incoming-interbranch-transfers'] });
            queryClient.invalidateQueries({ queryKey: ['my-branch-inventory'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const acceptTransferMutation = useMutation({
        mutationFn: async (transfer: any) => {
            const now = new Date().toISOString();

            const { error: updateErr } = await supabase
                .from('interbranch_transfers' as any)
                .update({ status: 'received' })
                .eq('id', transfer.id);
            if (updateErr) throw updateErr;

            const { error: invErr } = await supabase.from('shop_inventory' as any).insert({
                finished_product_id: transfer.finished_product_id,
                branch_id: branchId,
                transferred_at: now,
                transferred_by: user?.id,
            });
            if (invErr) throw invErr;
        },
        onSuccess: () => {
            toast({ title: 'Transfer received — product added to your branch' });
            queryClient.invalidateQueries({ queryKey: ['incoming-interbranch-transfers'] });
            queryClient.invalidateQueries({ queryKey: ['my-branch-inventory'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    return (
        <div className="space-y-4">
            <div className="flex gap-1.5">
                <button onClick={() => setTab('transfer')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary bg-card text-muted-foreground border-border"
                    data-active={tab === 'transfer'}>
                    <Send className="h-4 w-4" />
                    Transfer
                </button>
                <button onClick={() => setTab('receive')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:border-primary bg-card text-muted-foreground border-border"
                    data-active={tab === 'receive'}>
                    <Inbox className="h-4 w-4" />
                    Receive
                </button>
            </div>

            {loadingBranch && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                    <Loader2 className="h-3 w-3 animate-spin" /> Checking branch assignment...
                </div>
            )}

            {tab === 'receive' && (
                <div className="space-y-3">
                    <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                        <Inbox className="h-4 w-4 text-primary" /> Receive from Other Branches
                    </h3>

                    {!branchId ? (
                        <Card className="border border-warning/30">
                            <CardContent className="p-6 text-center space-y-3">
                                <p className="text-sm text-muted-foreground">You are not assigned to a branch yet.</p>
                                <p className="text-xs text-muted-foreground">Ask an admin to assign you a branch in User Management, then refresh this page.</p>
                            </CardContent>
                        </Card>
                    ) : loadingIncoming ? (
                        <div className="space-y-2">
                            {[1, 2].map(i => <div key={i} className="h-24 bg-accent animate-pulse rounded-xl" />)}
                        </div>
                    ) : !incomingTransfers || incomingTransfers.length === 0 ? (
                        <Card className="border">
                            <CardContent className="p-8 text-center">
                                <Truck className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-xs text-muted-foreground">No incoming transfers</p>
                            </CardContent>
                        </Card>
                    ) : (
                        incomingTransfers.map((t: any) => (
                            <Card key={t.id} className="border border-primary/10">
                                <CardContent className="p-4 space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">{t.finished_products?.product_type || 'Unknown Product'}</p>
                                            <p className="text-xs text-muted-foreground">
                                                From: {t.from_branch?.name || 'Warehouse'}
                                            </p>
                                            {t.notes && (
                                                <p className="text-[10px] text-muted-foreground italic mt-1">Notes: {t.notes}</p>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground shrink-0">
                                            {new Date(t.transfer_date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => acceptTransferMutation.mutate(t)}
                                        disabled={acceptTransferMutation.isPending}
                                        className="w-full gap-1 text-xs"
                                    >
                                        {acceptTransferMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                        Accept Transfer
                                    </Button>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {tab === 'transfer' && (
                <div className="space-y-3">
                    <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                        <Send className="h-4 w-4 text-primary" /> Send Product to Another Branch
                    </h3>

                    {!branchId ? (
                        <Card className="border border-warning/30">
                            <CardContent className="p-6 text-center space-y-3">
                                <p className="text-sm text-muted-foreground">You are not assigned to a branch yet.</p>
                                <p className="text-xs text-muted-foreground">Ask an admin to assign you a branch in User Management, then refresh this page.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border border-primary/10">
                            <CardContent className="p-4">
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs">Products from your branch *</Label>
                                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                                            {(myBranchInventory || []).length === 0 && (
                                                <p className="text-xs text-muted-foreground text-center py-4">No products in your branch inventory</p>
                                            )}
                                            {(myBranchInventory || []).map((i: any) => {
                                                const checked = transferForm.shop_inventory_ids.includes(i.id);
                                                return (
                                                    <label key={i.id}
                                                        className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs hover:bg-accent/30 has-[:checked]:bg-primary/5 has-[:checked]:border-primary/30">
                                                        <input type="checkbox" checked={checked} onChange={() => {
                                                            setTransferForm(f => ({
                                                                ...f,
                                                                shop_inventory_ids: checked
                                                                    ? f.shop_inventory_ids.filter(id => id !== i.id)
                                                                    : [...f.shop_inventory_ids, i.id]
                                                            }));
                                                        }} className="rounded" />
                                                        <span className="font-medium">{i.finished_products?.product_type || 'Unknown'}</span>
                                                        {i.finished_products?.batch_number && (
                                                            <span className="text-[10px] text-muted-foreground">({i.finished_products.batch_number})</span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {transferForm.shop_inventory_ids.length > 0 && (
                                            <p className="text-[10px] text-muted-foreground">{transferForm.shop_inventory_ids.length} product(s) selected</p>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Destination Branch *</Label>
                                        <select value={transferForm.to_branch_id} onChange={(e) => setTransferForm(f => ({ ...f, to_branch_id: e.target.value }))}
                                            className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm" required>
                                            <option value="">Select branch...</option>
                                            {(branches || []).filter((b: any) => b.id !== branchId).map((b: any) => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs">Notes</Label>
                                        <Textarea value={transferForm.notes} onChange={(e) => setTransferForm(f => ({ ...f, notes: e.target.value }))} placeholder="Transfer reason..." className="min-h-[50px] text-sm" />
                                    </div>
                                    <Button onClick={() => sendTransferMutation.mutate()} disabled={sendTransferMutation.isPending || transferForm.shop_inventory_ids.length === 0 || !transferForm.to_branch_id} className="w-full gap-1 text-xs" size="lg">
                                        {sendTransferMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        Send Transfer ({transferForm.shop_inventory_ids.length} product{transferForm.shop_inventory_ids.length !== 1 ? 's' : ''})
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProductReturns;
