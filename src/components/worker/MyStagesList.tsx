import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Factory, Eye, Clock, User } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  onViewProduct?: (id: string) => void;
}

const MyStagesList = ({ onViewProduct }: Props) => {
  const { user } = useAuth();

  const { data: myTasks, isLoading } = useQuery({
    queryKey: ['my-active-production-tasks', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wp_production_tasks' as any)
        .select(`
          *,
          production_orders (*)
        `)
        .eq('assigned_officer_id', user!.id)
        .eq('status', 'In Progress')
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">My Active Stages ({myTasks?.length || 0})</h3>
      </div>

      {!myTasks || myTasks.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="p-12 text-center flex flex-col items-center">
            <Factory className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground font-medium">You have no active stages.</p>
            <p className="text-xs text-muted-foreground mt-1">Go to Production to select and start a stage.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {myTasks.map((task: any) => {
            const order = task.production_orders;
            if (!order) return null;

            return (
              <Card key={task.id} className="hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => onViewProduct && onViewProduct(order.id)}>
                <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground truncate text-sm sm:text-base">{order.product_type}</p>
                      <Badge variant="secondary" className="text-[10px] whitespace-nowrap bg-primary/10 text-primary">
                        {task.stage_name}
                      </Badge>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                      <span className="truncate">Ref: {order.id.slice(0, 8).toUpperCase()}</span>
                      <span className="hidden sm:inline">•</span>
                      <span className="truncate">Started: {format(new Date(task.started_at), 'PPP')}</span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="inline-flex items-center text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                        <Clock className="h-3 w-3 mr-1.5" />
                        In Progress
                      </div>
                      <div className="inline-flex items-center text-xs font-medium bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full border">
                        <User className="h-3 w-3 mr-1.5" />
                        You
                      </div>
                    </div>
                  </div>

                  {onViewProduct && (
                    <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-5 w-5" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyStagesList;
