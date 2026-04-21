import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, RotateCcw, Loader2, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductReturnProcessing = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'pending' | 'processed' | 'rejected'>('pending');
    const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

    const { data: returns, isLoading } = useQuery({
        queryKey: ['product-returns-officer', filter],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_returns')
                .select('*, products(product_type, id), profiles:sales_officer_id(full_name)')
                .eq('status', filter)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    const processMutation = useMutation({
        mutationFn: async ({ id, productId }: { id: string; productId: string }) => {
            // Update return status
            const { error: retErr } = await supabase
                .from('product_returns')
                .update({
                    status: 'processed',
                    processed_by: user!.id,
                    processed_at: new Date().toISOString()
                })
                .eq('id', id);
            if (retErr) throw retErr;

            // Put product back in inventory (mark as completed/available)
            const { error: prodErr } = await supabase
                .from('finished_products')
                .update({ status: 'completed' as const })
                .eq('id', productId);
            if (prodErr) throw prodErr;
        },
        onSuccess: () => {
            toast({ title: 'Return processed' });
            queryClient.invalidateQueries({ queryKey: ['product-returns-officer'] });
            queryClient.invalidateQueries({ queryKey: ['finished-products'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
            const { error } = await supabase
                .from('product_returns')
                .update({ status: 'rejected', reason: notes || 'Rejected by inventory officer' })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Return rejected' });
            queryClient.invalidateQueries({ queryKey: ['product-returns-officer'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const filters = [
        { key: 'pending' as const, label: 'Pending', icon: Clock },
        { key: 'processed' as const, label: 'Processed', icon: CheckCircle },
        { key: 'rejected' as const, label: 'Rejected', icon: XCircle },
    ];

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                {filters.map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors border",
                            filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:bg-accent"
                        )}>
                        <f.icon className="h-4 w-4" />
                        {f.label}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-28" />)}
                </div>
            ) : (returns || []).length === 0 ? (
                <div className="bg-card rounded-2xl border p-12 text-center">
                    <RotateCcw className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-muted-foreground">No {filter} product returns</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {(returns || []).map((ret: any) => (
                        <Card key={ret.id} className="border">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-foreground">{ret.products?.product_type || 'Unknown Product'}</p>
                                        <div className="text-[10px] text-muted-foreground space-y-0.5 mt-1">
                                            <p>Agent: {ret.profiles?.full_name || 'Unknown'}</p>
                                            <p>Product ID: {ret.finished_product_id.slice(0, 8)}</p>
                                            {ret.reason && <p className="italic">Reason: {ret.reason}</p>}
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                        {new Date(ret.created_at).toLocaleDateString()}
                                    </span>
                                </div>

                                {filter === 'pending' && (
                                    <div className="space-y-2">
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => processMutation.mutate({ id: ret.id, productId: ret.finished_product_id })}
                                                disabled={processMutation.isPending} className="flex-1 gap-1">
                                                {processMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                                Process Return
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => {
                                                const notes = rejectNotes[ret.id] || '';
                                                rejectMutation.mutate({ id: ret.id, notes });
                                            }} disabled={rejectMutation.isPending} className="flex-1 gap-1 text-destructive border-destructive/30 hover:bg-destructive/5">
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
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductReturnProcessing;
