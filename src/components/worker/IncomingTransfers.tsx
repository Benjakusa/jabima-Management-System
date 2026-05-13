import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Loader2, ArrowRight, Package, User } from 'lucide-react';

const IncomingTransfers = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

    const { data: incoming, isLoading } = useQuery({
        queryKey: ['incoming-transfers', profile?.branch_id],
        queryFn: async () => {
            if (!profile?.branch_id) return [];
            const { data, error } = await supabase
                .from('stock_returns' as any)
                .select('*, finished_products(id, product_type, batch_number)')
                .eq('destination_branch_id', profile.branch_id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []) as any[];
        },
        enabled: !!user && !!profile?.branch_id,
    });

    const acceptMutation = useMutation({
        mutationFn: async (ret: any) => {
            const now = new Date().toISOString();

            const { error: updateErr } = await supabase
                .from('stock_returns' as any)
                .update({ status: 'accepted' })
                .eq('id', ret.id);
            if (updateErr) throw updateErr;

            const { error: invErr } = await supabase.from('shop_inventory' as any).insert({
                finished_product_id: ret.finished_product_id,
                branch_id: profile?.branch_id,
                transferred_at: now,
                transferred_by: user?.id,
            });
            if (invErr) throw invErr;

            const { error: prodErr } = await supabase
                .from('finished_products' as any)
                .update({ status: 'completed' })
                .eq('id', ret.finished_product_id);
            if (prodErr) throw prodErr;
        },
        onSuccess: () => {
            toast({ title: 'Transfer accepted — product added to your branch' });
            queryClient.invalidateQueries({ queryKey: ['incoming-transfers'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const { error } = await supabase
                .from('stock_returns' as any)
                .update({ status: 'rejected', return_reason: notes || 'Rejected by receiving branch' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Transfer rejected' });
            queryClient.invalidateQueries({ queryKey: ['incoming-transfers'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    if (!profile?.branch_id) {
        return (
            <Card className="border">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    You need to be assigned to a branch to receive transfers.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-primary" /> Incoming Transfers
            </h3>

            {isLoading ? (
                <div className="space-y-2">
                    {[1, 2].map(i => <div key={i} className="h-24 bg-accent animate-pulse rounded-xl" />)}
                </div>
            ) : !incoming || incoming.length === 0 ? (
                <Card className="border">
                    <CardContent className="p-8 text-center">
                        <Package className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No incoming transfers</p>
                    </CardContent>
                </Card>
            ) : (
                incoming.map((ret: any) => (
                    <Card key={ret.id} className="border border-primary/10">
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm">{ret.finished_products?.product_type || 'Unknown Product'}</p>
                                    {ret.return_reason && (
                                        <p className="text-[10px] text-muted-foreground italic mt-1">Reason: {ret.return_reason}</p>
                                    )}
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                    {new Date(ret.created_at).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={() => acceptMutation.mutate(ret)}
                                        disabled={acceptMutation.isPending} className="flex-1 gap-1 text-xs">
                                        {acceptMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                        Accept
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => {
                                        const notes = rejectNotes[ret.id] || '';
                                        rejectMutation.mutate({ id: ret.id, notes });
                                    }} disabled={rejectMutation.isPending} className="flex-1 gap-1 text-xs text-destructive border-destructive/30 hover:bg-destructive/5">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Reject
                                    </Button>
                                </div>
                                <Textarea
                                    placeholder="Comment (optional)"
                                    value={rejectNotes[ret.id] || ''}
                                    onChange={e => setRejectNotes(n => ({ ...n, [ret.id]: e.target.value }))}
                                    className="text-[10px] min-h-[40px]"
                                    rows={1}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))
            )}
        </div>
    );
};

export default IncomingTransfers;
