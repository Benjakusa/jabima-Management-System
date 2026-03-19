import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ClipboardList, Plus, X, Loader2, Clock, CheckCircle, XCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

const productTypes = [
    'Simple', 'Half glass', 'High roof',
    'Executive', 'Dumu', 'Saitoti',
    'Dragon', 'Tommy', 'Reagan',
    'English coffin', 'Kupa',
    'Custom Order',
];

const ProductRequests = () => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [productType, setProductType] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [notes, setNotes] = useState('');

    const { data: requests, isLoading } = useQuery({
        queryKey: ['my-product-requests', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('product_requests' as any)
                .select('*, branches(name)')
                .eq('sales_officer_id', user!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
        enabled: !!user,
    });

    const requestMutation = useMutation({
        mutationFn: async () => {
            if (!productType) throw new Error('Please select a product type');
            const { error } = await supabase.from('product_requests' as any).insert({
                product_type: productType,
                quantity: parseInt(quantity) || 1,
                sales_officer_id: user!.id,
                branch_id: profile?.branch_id,
                notes: notes.trim() || null,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            toast({ title: 'Request submitted for approval' });
            setShowForm(false);
            setProductType('');
            setQuantity('1');
            setNotes('');
            queryClient.invalidateQueries({ queryKey: ['my-product-requests'] });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <Clock className="h-3 w-3 text-warning" />;
            case 'approved': return <CheckCircle className="h-3 w-3 text-primary" />;
            case 'fulfilled': return <Package className="h-3 w-3 text-success" />;
            case 'rejected': return <XCircle className="h-3 w-3 text-destructive" />;
            default: return null;
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" /> My Product Requests
                </h3>
                <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? 'ghost' : 'default'} className="h-8">
                    {showForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showForm ? 'Cancel' : 'New Request'}
                </Button>
            </div>

            {showForm && (
                <Card className="border-primary/20">
                    <CardContent className="p-4 space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs">Product Type</Label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {productTypes.map(type => (
                                    <button key={type} type="button" onClick={() => setProductType(type)}
                                        className={cn("px-2 py-1.5 rounded-lg text-[10px] border font-medium transition-colors text-center",
                                            productType === type ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent"
                                        )}>{type}</button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs">Quantity</Label>
                                <Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} min="1" className="h-9 text-xs" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs">Notes (optional)</Label>
                                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Urgency, specifics..." className="h-9 text-xs" />
                            </div>
                        </div>
                        <Button className="w-full h-9 text-xs" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending || !productType}>
                            {requestMutation.isPending && <Loader2 className="animate-spin mr-2 h-3 w-3" />}
                            Submit Request
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
                        <Card key={req.id} className="border">
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
