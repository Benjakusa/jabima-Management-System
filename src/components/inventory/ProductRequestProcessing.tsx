import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, XCircle, Clock, Package, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductRequestProcessing = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'fulfilled'>('pending');
    const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

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
                    approved_by: user!.id,
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

    const filters = [
        { key: 'pending' as const, label: 'Pending', icon: Clock },
        { key: 'approved' as const, label: 'Approved', icon: CheckCircle },
        { key: 'rejected' as const, label: 'Rejected', icon: XCircle },
        { key: 'fulfilled' as const, label: 'Fulfilled', icon: Package },
    ];

    return (
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
                                                disabled={approveMutation.isPending} className="flex-1 gap-1">
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
                                            placeholder="Rejection comment (optional)"
                                            value={rejectNotes[req.id] || ''}
                                            onChange={e => setRejectNotes(n => ({ ...n, [req.id]: e.target.value }))}
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

export default ProductRequestProcessing;
