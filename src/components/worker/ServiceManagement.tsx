import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const ALL_SERVICES = [
    'Body Preservation', 'Body Transport', 'Funeral Arrangement', 'Hearse Service',
    'Decoration Service', 'Burial Coordination', 'Memorial Service', 'Tents', 'Gazebo', 'Lowering Gear'
];

const ServiceManagement = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: myServices, isLoading } = useQuery({
        queryKey: ['my-available-services', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('sales_agent_services' as any)
                .select('*')
                .eq('sales_officer_id', user!.id);
            if (error) throw error;
            return (data || []) as any[];
        },
        enabled: !!user,
    });

    const toggleServiceMutation = useMutation({
        mutationFn: async ({ name, active }: { name: string; active: boolean }) => {
            const existing = (myServices as any[])?.find(s => s.service_name === name);
            if (existing) {
                const { error } = await supabase
                    .from('sales_agent_services' as any)
                    .update({ is_active: !active })
                    .eq('id', existing.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sales_agent_services' as any)
                    .insert({ sales_officer_id: user!.id, service_name: name, is_active: true });
                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-available-services'] });
            toast({ title: 'Services updated' });
        },
        onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
    });

    if (isLoading) return <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" /></div>;

    return (
        <div className="space-y-4">
            <div>
                <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" /> My Available Services
                </h3>
                <p className="text-[10px] text-muted-foreground">Select services you offer to show them in your POS</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_SERVICES.map(service => {
                    const s = (myServices as any[])?.find(ms => ms.service_name === service);
                    const isActive = s ? s.is_active : false;
                    return (
                        <Card key={service}
                            className={cn("border cursor-pointer transition-all hover:border-primary/50", isActive && "border-primary bg-primary/5")}
                            onClick={() => toggleServiceMutation.mutate({ name: service, active: isActive })}>
                            <CardContent className="p-3 flex items-center justify-between">
                                <span className="text-sm font-medium">{service}</span>
                                {isActive && <CheckCircle className="h-4 w-4 text-primary" />}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default ServiceManagement;
