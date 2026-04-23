import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { RotateCcw, Plus, X, Loader2, Clock, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const ProductReturns = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [finishedProductId, setFinishedProductId] = useState('');
    const [reason, setReason] = useState('');

    const { data: mySales } = useQuery({
        queryKey: ['my-product-sales-for-return', user?.id],
        queryFn: async () => {
            // Find all products sold by this agent that haven't been returned yet
            const { data, error } = await supabase
                .from('sales' as any)
                .select('*, products(*)')
                .eq('sales_officer_id', user!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const { data: myReturns, isLoading } = useQuery({
        queryKey: ['my-product-returns', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_returns')
                .select('*, finished_products(product_type)')
                .eq('sales_officer_id', user!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const returnMutation = useMutation({
        mutationFn: async () => {
            if (!finishedProductId) throw new Error('Please select a product to return');
            const { error } = await supabase.from('product_returns').insert({
                finished_product_id: finishedProductId,
                sales_officer_id: user!.id,
                reason: reason.trim() || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Return request submitted' });
            setShowForm(false);
            setFinishedProductId('');
            setReason('');
            queryClient.invalidateQueries({ queryKey: ['my-product-returns'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-3 w-3 text-warning" />;
            case 'processed': return <CheckCircle className="h-3 w-3 text-success" />;
            case 'rejected': return <XCircle className="h-3 w-3 text-destructive" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-primary" /> My Product Returns
                </h3>
                <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? 'ghost' : 'default'} className="h-8">
                    {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showForm ? 'Cancel' : 'Initiate Return'}
                </Button>
            </div>

            {showForm && (
                <Card className="border-primary/20">
                    <CardContent className="p-4 space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Select Product from Sold</Label>
                            <select
                                value={finishedProductId}
                                onChange={e => setFinishedProductId(e.target.value)}
                                className="w-full h-9 rounded-lg border border-input bg-background px-3 text-xs"
                            >
                                <option value="">Choose product...</option>
                                {((mySales as any) || []).map((sale: any) => (
                                    <option key={sale.id} value={sale.finished_product_id}>
                                        {sale.product_type} - {new Date(sale.created_at).toLocaleDateString()}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs">Reason for return</Label>
                            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Defective, customer changed mind..." className="text-xs min-h-[60px]" />
                        </div>
                        <Button className="w-full h-9 text-xs" onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending || !finishedProductId}>
                            {returnMutation.isPending && <Loader2 className="animate-spin mr-2 h-3 w-3" />}
                            Submit Return
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-2">
                {isLoading ? (
                    <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : ((myReturns as any) || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">No returns made yet</p>
                ) : (
                    ((myReturns as any) || []).map((ret: any) => (
                        <Card key={ret.id} className="border">
                            <CardContent className="p-3 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">{ret.products?.product_type || 'Unknown Product'}</p>
                                    <div className="flex items-center gap-3 mt-0.5 text-[9px] text-muted-foreground">
                                        <span className="flex items-center gap-1 capitalize">
                                            {getStatusIcon(ret.status)}
                                            {ret.status}
                                        </span>
                                        <span>{new Date(ret.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                {ret.reason && <p className="text-[9px] text-muted-foreground italic truncate max-w-[100px]">{ret.reason}</p>}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};

export default ProductReturns;
