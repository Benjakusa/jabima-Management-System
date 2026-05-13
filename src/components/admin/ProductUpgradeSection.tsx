import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowUpCircle, Search, ShoppingCart, TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

const ProductUpgradeSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [priceDiff, setPriceDiff] = useState('');

  const { data: sales, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-for-upgrade'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sales')
        .select('id, customer_name, product_type, selling_price, finished_product_id, payment_status, created_at')
        .is('upgraded_product_id', null)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: products } = useQuery({
    queryKey: ['products-for-upgrade'],
    queryFn: async () => {
      const { data } = await supabase
        .from('products' as any)
        .select('*')
        .eq('is_active', true)
        .order('name');
      return data || [];
    },
  });

  const selectedSale = (sales || []).find((s: any) => s.id === selectedSaleId) as any;
  const selectedProduct = (products || []).find((p: any) => p.id === selectedProductId) as any;

  const suggestedDiff = (() => {
    if (!selectedSale || !selectedProduct) return 0;
    const productPrice = selectedProduct.selling_price || 0;
    const salePrice = selectedSale.selling_price || 0;
    return Math.max(0, productPrice - salePrice);
  })();

  const upgradeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSaleId || !selectedProductId) throw new Error('Select a sale and product');
      const diff = parseFloat(priceDiff) || suggestedDiff;
      if (diff <= 0) throw new Error('Price difference must be greater than zero');

      const { error: updateError } = await supabase
        .from('sales')
        .update({
          original_product_id: selectedSale.product_type,
          upgraded_product_id: selectedProduct.name,
          upgrade_price_difference: diff,
          selling_price: (selectedSale.selling_price || 0) + diff,
          payment_status: 'partial',
        } as any)
        .eq('id', selectedSaleId);
      if (updateError) throw updateError;

      const { error: txnError } = await supabase
        .from('payment_transactions' as any)
        .insert({
          sale_id: selectedSaleId,
          amount: diff,
          payment_method: 'credit',
          reference_number: `UPGRADE-${Date.now().toString().slice(-8)}`,
          recorded_by: user?.id,
          notes: `Product upgrade from ${selectedSale.product_type} to ${selectedProduct.name}`,
        });
      if (txnError) throw txnError;
    },
    onSuccess: () => {
      toast({ title: 'Product upgraded successfully!' });
      setSelectedSaleId('');
      setSelectedProductId('');
      setPriceDiff('');
      queryClient.invalidateQueries({ queryKey: ['sales-for-upgrade'] });
      queryClient.invalidateQueries({ queryKey: ['payment-transactions'] });
    },
    onError: (err: Error) => toast({ variant: 'destructive', title: 'Error', description: err.message }),
  });

  const filteredSales = (sales || []).filter((s: any) =>
    !search || s.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    s.product_type?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Product Upgrades</h2>
        <p className="text-sm text-muted-foreground">Upgrade a sold product to a higher-value item and record the price difference</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Select Sale */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              1. Select Existing Sale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 text-sm" placeholder="Search by customer or product..." />
            </div>
            {salesLoading ? (
              <div className="text-center py-4"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredSales.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No sales found</p>
                )}
                {filteredSales.map((s: any) => (
                  <button key={s.id} type="button" onClick={() => { setSelectedSaleId(s.id); setSelectedProductId(''); setPriceDiff(''); }}
                    className={cn("w-full text-left p-2.5 rounded-lg border text-xs transition-all",
                      selectedSaleId === s.id ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:border-primary/30"
                    )}>
                    <p className="font-medium text-foreground">{s.customer_name}</p>
                    <p className="text-[10px] text-muted-foreground">{s.product_type} — {formatCurrency(s.selling_price)}</p>
                    <p className="text-[9px] text-muted-foreground">{new Date(s.created_at).toLocaleDateString()} • {s.payment_status}</p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Select Product & Confirm */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              2. Upgrade To
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedSale ? (
              <p className="text-xs text-muted-foreground text-center py-8">Select a sale first</p>
            ) : (
              <>
                <div className="bg-accent/20 rounded-lg p-2.5 text-xs space-y-1">
                  <p className="text-muted-foreground">Current: <span className="font-medium text-foreground">{selectedSale.product_type}</span></p>
                  <p className="text-muted-foreground">Price: <span className="font-medium text-foreground">{formatCurrency(selectedSale.selling_price)}</span></p>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <Label className="text-xs">Select New Product</Label>
                  {(products || []).map((p: any) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedProductId(p.id); setPriceDiff(String(suggestedDiff)); }}
                      className={cn("w-full text-left p-2.5 rounded-lg border text-xs transition-all",
                        selectedProductId === p.id ? "border-success bg-success/5 ring-1 ring-success/20" : "border-border hover:border-success/30"
                      )}>
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.selling_price > 0 && <p className="text-[10px] text-success">{formatCurrency(p.selling_price)}</p>}
                    </button>
                  ))}
                </div>

                {selectedProduct && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="bg-success/5 rounded-lg p-2.5 text-xs space-y-1">
                      <p className="text-muted-foreground">New: <span className="font-medium text-foreground">{selectedProduct.name}</span></p>
                      <p className="text-muted-foreground">Price: <span className="font-medium text-success">{formatCurrency(selectedProduct.selling_price || 0)}</span></p>
                      <p className="text-muted-foreground">Difference: <span className="font-bold text-success">{formatCurrency(suggestedDiff)}</span></p>
                    </div>
                    <div>
                      <Label className="text-xs">Price Difference (Ksh)</Label>
                      <Input type="number" value={priceDiff} onChange={e => setPriceDiff(e.target.value)}
                        className="h-10 text-sm" min="0" step="0.01" />
                    </div>
                    <Button size="lg" className="w-full" onClick={() => upgradeMutation.mutate()}
                      disabled={upgradeMutation.isPending || !priceDiff || parseFloat(priceDiff) <= 0}>
                      {upgradeMutation.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      Confirm Upgrade — {formatCurrency(parseFloat(priceDiff) || 0)}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProductUpgradeSection;
