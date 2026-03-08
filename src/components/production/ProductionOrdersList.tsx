import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Loader2, Search, Factory, Eye, ArrowRight, CheckCircle, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STAGES } from './ProductionPipeline';

const productTypes = [
  'Standard Coffin', 'Executive Coffin', 'Premium Casket',
  'Deluxe Coffin', 'Child Coffin',
  'Casket - Flat Top', 'Casket - Half Couch', 'Casket - Full Couch',
  'Custom Order',
];

const sizes = ['Adult', 'Child', 'Infant'];
const materialTypes = ['Oak', 'Mahogany', 'Pine', 'MDF', 'Cypress', 'Paulownia'];

interface Props {
  onViewProduct: (id: string) => void;
}

const ProductionOrdersList = ({ onViewProduct }: Props) => {
  const [showForm, setShowForm] = useState(false);
  const [productType, setProductType] = useState('');
  const [customType, setCustomType] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [batchNumber, setBatchNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['production-orders-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const type = productType === 'Custom Order' ? customType.trim() : productType;
      if (!type) throw new Error('Product type is required');
      const qty = parseInt(quantity) || 1;
      if (qty < 1 || qty > 100) throw new Error('Quantity must be between 1 and 100');
      const batch = batchNumber.trim() || `BATCH-${Date.now().toString(36).toUpperCase()}`;

      const { data, error } = await supabase.rpc('create_production_batch', {
        p_product_type: type,
        p_quantity: qty,
        p_batch_number: batch,
        p_notes: notes.trim() || null,
        p_expected_completion_date: expectedDate || null,
        p_created_by: user?.id || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const count = Array.isArray(data) ? data.length : 1;
      toast({ title: `${count} production order${count > 1 ? 's' : ''} created` });
      setShowForm(false);
      setProductType('');
      setCustomType('');
      setQuantity('1');
      setBatchNumber('');
      setNotes('');
      setExpectedDate('');
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders-pipeline'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const advanceStageMutation = useMutation({
    mutationFn: async ({ orderId, currentStage }: { orderId: string; currentStage: string }) => {
      const stageIdx = STAGES.findIndex(s => s.value === currentStage);
      const isLast = stageIdx === STAGES.length - 1;

      if (isLast) {
        const { error } = await supabase
          .from('production_orders')
          .update({ status: 'completed' as any, completed_at: new Date().toISOString() })
          .eq('id', orderId);
        if (error) throw error;

        const { data: order } = await supabase.from('production_orders').select('*').eq('id', orderId).single();
        if (order) {
          await supabase.from('finished_products').insert({
            production_order_id: orderId,
            product_type: order.product_type,
            production_cost: order.production_cost || 0,
          });
        }
      } else {
        const nextStage = STAGES[stageIdx + 1].value;
        const { error } = await supabase
          .from('production_orders')
          .update({ current_stage: nextStage as any })
          .eq('id', orderId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: 'Stage advanced successfully' });
      queryClient.invalidateQueries({ queryKey: ['production-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['production-orders-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['production-completed-count'] });
    },
    onError: (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  const filtered = (orders || []).filter(o => {
    const matchesSearch = o.product_type.toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.product_code && o.product_code.toLowerCase().includes(search.toLowerCase())) ||
      (o.batch_number && o.batch_number.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStageLabel = (stage: string) => STAGES.find(s => s.value === stage)?.label || stage;
  const getStageColor = (stage: string) => STAGES.find(s => s.value === stage)?.color || 'bg-muted';
  const getStageIndex = (stage: string) => STAGES.findIndex(s => s.value === stage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
        <Button onClick={() => setShowForm(!showForm)} size="lg">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Cancel' : 'New Batch Order'}
        </Button>
      </div>

      {showForm && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Factory className="h-5 w-5 text-primary" />
              Create Production Batch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Product Type</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {productTypes.map(type => (
                    <button key={type} type="button" onClick={() => setProductType(type)}
                      className={cn("px-3 py-2.5 rounded-xl text-xs font-medium border transition-colors text-center",
                        productType === type ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-accent"
                      )}>{type}</button>
                  ))}
                </div>
              </div>

              {productType === 'Custom Order' && (
                <div className="space-y-2">
                  <Label>Custom Type Name</Label>
                  <Input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="Describe the custom product" required />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input type="number" min="1" max="100" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="How many?" />
                  <p className="text-[10px] text-muted-foreground">Each unit gets a unique Product ID</p>
                </div>
                <div className="space-y-2">
                  <Label>Batch Number (optional)</Label>
                  <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. BATCH-001" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Expected Completion Date (optional)</Label>
                <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions, client details, etc." maxLength={500} className="min-h-[60px]" />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={createMutation.isPending || !productType || (productType === 'Custom Order' && !customType.trim())}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : <Package className="h-4 w-4" />}
                Create {parseInt(quantity) > 1 ? `${quantity} Orders` : 'Order'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID, product code, batch..." className="pl-10 h-11" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-lg border border-input bg-background px-3 text-sm min-w-[120px]">
          <option value="all">All Status</option>
          <option value="in_production">In Production</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card rounded-2xl border p-12 text-center">
          <Factory className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No production orders found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const isCompleted = order.status === 'completed';
            const stageIdx = getStageIndex(order.current_stage);
            const progress = isCompleted ? 100 : Math.round(((stageIdx) / STAGES.length) * 100);

            return (
              <Card key={order.id} className={cn("border", isCompleted && "border-success/30 bg-success/5")}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="font-medium text-foreground truncate">{order.product_type}</p>
                        {isCompleted && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        {order.product_code && (
                          <Badge variant="outline" className="text-[10px] font-mono">{order.product_code}</Badge>
                        )}
                        {order.batch_number && (
                          <Badge variant="secondary" className="text-[10px]">{order.batch_number}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Started {new Date(order.started_at).toLocaleDateString()}
                        {order.expected_completion_date && ` • Due ${new Date(order.expected_completion_date).toLocaleDateString()}`}
                        {order.completed_at && ` • Done ${new Date(order.completed_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => onViewProduct(order.id)} className="h-8 w-8">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={cn(
                        "font-medium px-2 py-0.5 rounded-md",
                        isCompleted ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
                      )}>
                        {isCompleted ? 'Completed' : getStageLabel(order.current_stage)}
                      </span>
                      <span className="text-muted-foreground">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isCompleted ? "bg-success" : getStageColor(order.current_stage))}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Stage dots */}
                  <div className="flex gap-0.5">
                    {STAGES.map((s, i) => (
                      <div key={s.value} className={cn(
                        "flex-1 h-1 rounded-full",
                        isCompleted || i <= stageIdx ? getStageColor(s.value) : "bg-secondary"
                      )} />
                    ))}
                  </div>

                  {/* Notes */}
                  {order.notes && (
                    <p className="text-xs text-muted-foreground mt-2 bg-accent/30 rounded-lg px-2 py-1 truncate">{order.notes}</p>
                  )}

                  {/* Advance button */}
                  {!isCompleted && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => advanceStageMutation.mutate({ orderId: order.id, currentStage: order.current_stage })}
                      disabled={advanceStageMutation.isPending}
                    >
                      {advanceStageMutation.isPending ? (
                        <Loader2 className="animate-spin h-3.5 w-3.5" />
                      ) : stageIdx === STAGES.length - 1 ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5" />
                          Mark Complete
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-3.5 w-3.5" />
                          Advance to {STAGES[stageIdx + 1]?.label}
                        </>
                      )}
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

export default ProductionOrdersList;
