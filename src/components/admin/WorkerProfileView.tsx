import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Wallet, Briefcase, ClipboardList, ShoppingCart, FileText } from 'lucide-react';
import { cn, formatStage, formatCurrency } from '@/lib/utils';
import type { UserWithRole } from './UserManagement';
import { roleLabels } from './UserManagement';

interface Props {
  user: UserWithRole;
  branches: { id: string; name: string }[];
}

const WorkerProfileView = ({ user, branches }: Props) => {
  const branchName = branches.find(b => b.id === user.branch_id)?.name || 'Unassigned';

  const { data: wallet } = useQuery({
    queryKey: ['worker-wallet', user.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('wallets').select('*').eq('user_id', user.user_id).maybeSingle();
      return data;
    },
  });

  const { data: paymentConfigs } = useQuery({
    queryKey: ['worker-pay-configs', user.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('payment_configs').select('*').eq('user_id', user.user_id);
      return data || [];
    },
  });

  const { data: stageLogs } = useQuery({
    queryKey: ['worker-stage-logs', user.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('stage_logs').select('*, production_orders(product_code, product_type)').eq('worker_id', user.user_id).order('started_at', { ascending: false }).limit(20);
      return data || [];
    },
  });

  const { data: dailyReports } = useQuery({
    queryKey: ['worker-daily-reports', user.user_id],
    queryFn: async () => {
      const [regularRes, workshopRes] = await Promise.all([
        supabase.from('daily_reports').select('*').eq('user_id', user.user_id).order('report_date', { ascending: false }).limit(10),
        supabase.from('wp_daily_reports' as any).select('*').eq('officer_id', user.user_id).order('report_date', { ascending: false }).limit(10)
      ]);

      const regularReports = regularRes.data || [];
      const workshopReports = (workshopRes.data || []).map((r: any) => ({
        ...r,
        user_id: r.officer_id,
        tasks_completed: r.tasks_completed || (r.tasks ? r.tasks.length : 0),
      }));

      return [...regularReports, ...workshopReports].sort((a, b) =>
        new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
      ).slice(0, 10);
    },
  });

  const { data: sales } = useQuery({
    queryKey: ['worker-sales', user.user_id],
    queryFn: async () => {
      const { data } = await supabase.from('sales').select('*').eq('sales_officer_id', user.user_id).order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
  });

  const payTypeLabels: Record<string, string> = {
    daily_wage: 'Daily Wage',
    per_stage: 'Per Stage',
    per_product: 'Per Product',
    commission: 'Commission',
  };

  const totalEarnings = wallet ? wallet.pending_earnings + wallet.approved_earnings + wallet.paid_earnings : 0;

  return (
    <div className="space-y-6">
      {/* Personal Details */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Personal Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Full Name</p><p className="font-medium text-foreground">{user.full_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Email</p><p className="font-medium text-foreground">{user.email}</p></div>
            <div><p className="text-muted-foreground text-xs">Phone</p><p className="font-medium text-foreground">{user.phone || '—'}</p></div>
            <div><p className="text-muted-foreground text-xs">Role</p><p className="font-medium text-foreground">{roleLabels[user.role] || user.role}</p></div>
            <div><p className="text-muted-foreground text-xs">Branch</p><p className="font-medium text-foreground">{branchName}</p></div>
            <div><p className="text-muted-foreground text-xs">Status</p><p className={cn("font-medium", user.is_muted ? "text-destructive" : "text-success")}>{user.is_muted ? 'Suspended' : 'Active'}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* Wallet */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Wallet</CardTitle>
        </CardHeader>
        <CardContent>
          {wallet ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground text-xs">Total Earnings</p><p className="font-bold text-foreground">{formatCurrency(totalEarnings)}</p></div>
              <div><p className="text-muted-foreground text-xs">Pending</p><p className="font-bold text-warning">{formatCurrency(wallet.pending_earnings)}</p></div>
              <div><p className="text-muted-foreground text-xs">Approved</p><p className="font-bold text-success">{formatCurrency(wallet.approved_earnings)}</p></div>
              <div><p className="text-muted-foreground text-xs">Paid</p><p className="font-bold text-muted-foreground">{formatCurrency(wallet.paid_earnings)}</p></div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No wallet found</p>
          )}
        </CardContent>
      </Card>

      {/* Payment Structure */}
      <Card className="border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> Payment Structure</CardTitle>
        </CardHeader>
        <CardContent>
          {paymentConfigs && paymentConfigs.length > 0 ? (
            <div className="space-y-2">
              {paymentConfigs.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                  <div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">{payTypeLabels[c.payment_type] || c.payment_type}</span>
                    {c.stage && <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-md ml-1">{formatStage(c.stage)}</span>}
                    {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                  </div>
                  <span className="font-bold text-success text-sm">{formatCurrency(c.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No payment configs set</p>
          )}
        </CardContent>
      </Card>

      {/* Work History */}
      {stageLogs && stageLogs.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" /> Work History (Recent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {stageLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-foreground">{(log as any).production_orders?.product_code || 'N/A'} — {formatStage(log.stage)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(log.started_at).toLocaleDateString()}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", log.completed_at ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
                    {log.completed_at ? 'Completed' : 'In Progress'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sales */}
      {sales && sales.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" /> Sales (Recent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {sales.map(s => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg text-sm">
                  <div>
                    <p className="font-medium text-foreground">{s.product_type} — {s.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="font-bold text-success">{formatCurrency(s.selling_price)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Reports */}
      {dailyReports && dailyReports.length > 0 && (
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Daily Reports (Recent)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {dailyReports.map(r => (
                <div key={r.id} className="p-3 bg-secondary/30 rounded-lg text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{new Date(r.report_date).toLocaleDateString()}</p>
                    <span className="text-xs text-muted-foreground">{r.tasks_completed} tasks</span>
                  </div>
                  {r.summary && <p className="text-xs text-muted-foreground mt-1">{r.summary}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default WorkerProfileView;
