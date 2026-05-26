import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Factory, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ProductionQueueProps {
    onViewProduct: (id: string) => void;
}

const getStageLabel = (stage: number) => {
    switch (stage) {
        case 1: return "Stage 1 — Frame and body assembly";
        case 2: return "Stage 2 — Sanding and painting";
        case 3: return "Stage 3 — Cloth lining and final assembly";
        case 4: return "Stage 4 — Glass fitting";
        default: return `Stage ${stage}`;
    }
};

const ProductionQueue = ({ onViewProduct }: ProductionQueueProps) => {
    const { data: orders, isLoading, error } = useQuery({
        queryKey: ['production_orders'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('production_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        },
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive bg-destructive/5">
                <CardContent className="p-6 text-center text-destructive">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p className="font-medium">Error loading orders</p>
                    <p className="text-sm opacity-80 mt-1">Please ensure the database migration for `production_orders` has been applied.</p>
                </CardContent>
            </Card>
        );
    }

    const activeOrders = orders?.filter(o => o.status !== 'completed') || [];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-medium text-foreground">Active Orders ({activeOrders.length})</h3>
            </div>

            {activeOrders.length === 0 ? (
                <Card className="border-dashed border-2 bg-muted/30">
                    <CardContent className="p-12 text-center flex flex-col items-center">
                        <Factory className="h-10 w-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground font-medium">No active production orders.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {activeOrders.map((order) => (
                        <Card key={order.id} className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => onViewProduct(order.id)}>
                            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <p className="font-semibold text-foreground truncate text-sm sm:text-base">{order.product_type}</p>
                                        <Badge
                                            variant={order.status === 'completed' ? 'default' : 'secondary'}
                                            className={cn("text-[10px] whitespace-nowrap", order.status === 'completed' && "bg-success hover:bg-success")}
                                        >
                                            {order.status === 'in_production' ? 'In Progress' : order.status === 'completed' ? 'Completed' : order.status}
                                        </Badge>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                                        <span className="truncate">Ref: {order.id.slice(0, 8).toUpperCase()}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="truncate">Placed: {format(new Date(order.created_at || order.started_at), 'PPP')}</span>
                                        <span className="hidden sm:inline">•</span>
                                        <span className="truncate">System Order</span>
                                    </div>

                                    <div className="mt-3 inline-flex items-center text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                                        <Factory className="h-3 w-3 mr-1.5" />
                                        {typeof order.current_stage === 'number' ? getStageLabel(order.current_stage) : String(order.current_stage).replace(/_/g, ' ')}
                                    </div>
                                </div>

                                <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Eye className="h-5 w-5" />
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductionQueue;
