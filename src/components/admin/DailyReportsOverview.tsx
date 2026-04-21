import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Calendar, Search, CheckCircle, AlertCircle, Check } from 'lucide-react';

const DailyReportsOverview = () => {
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: reports, isLoading } = useQuery({
    queryKey: ['admin-daily-reports', dateFilter],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('report_date', dateFilter)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email');
      return data || [];
    },
  });

  const { data: allWorkers } = useQuery({
    queryKey: ['all-worker-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role').in('role', ['workshop_worker', 'sales_officer']);
      return data || [];
    },
  });

  const getProfileName = (userId: string) => {
    const p = profiles?.find(p => p.user_id === userId);
    return p?.full_name || 'Unknown';
  };

  const getProfileEmail = (userId: string) => {
    const p = profiles?.find(p => p.user_id === userId);
    return p?.email || '';
  };

  const submittedUserIds = new Set(reports?.map(r => r.user_id) || []);
  const missingWorkers = (allWorkers || []).filter(w => !submittedUserIds.has(w.user_id));

  const filteredReports = (reports || []).filter(r => {
    if (!searchTerm) return true;
    const name = getProfileName(r.user_id).toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  const totalTasks = filteredReports.reduce((sum, r) => sum + (r.tasks_completed || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold text-foreground">Daily Reports</h2>
        <p className="text-sm text-muted-foreground">View worker end-of-day summaries</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Reports Submitted</p>
          <p className="text-2xl font-bold font-display text-primary">{reports?.length || 0}</p>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Total Tasks</p>
          <p className="text-2xl font-bold font-display text-success">{totalTasks}</p>
        </CardContent></Card>
        <Card className="border"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">Not Submitted</p>
          <p className="text-2xl font-bold font-display text-destructive">{missingWorkers.length}</p>
        </CardContent></Card>
      </div>

      {/* Missing reports */}
      {missingWorkers.length > 0 && (
        <div>
          <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-destructive" /> Workers Who Haven't Submitted
          </h3>
          <div className="flex flex-wrap gap-2">
            {missingWorkers.map(w => (
              <Badge key={w.user_id} variant="destructive" className="text-xs">
                {getProfileName(w.user_id)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-2xl border p-4 animate-pulse h-24" />
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <Card className="border"><CardContent className="p-8 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No reports submitted for this date</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredReports.map(report => (
            <Card key={report.id} className="border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-success" />
                      <span className="font-medium text-foreground text-sm">{getProfileName(report.user_id)}</span>
                      <Badge variant="secondary" className="text-[10px]">{report.tasks_completed} tasks</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1">{getProfileEmail(report.user_id)}</p>
                    {report.completed_tasks && report.completed_tasks.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[10px] text-muted-foreground font-medium">Completed Tasks:</p>
                        <div className="space-y-1 bg-accent/20 rounded-lg p-2 max-h-[120px] overflow-y-auto">
                          {report.completed_tasks.map((task: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <Check className="h-3 w-3 text-green-500 shrink-0" />
                              <span className="font-medium">{task.product}</span>
                              <Badge variant="outline" className="text-[10px] shrink-0">{task.batch}</Badge>
                              <span className="text-muted-foreground text-[10px] shrink-0">{task.stage}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {report.summary && (
                      <p className="text-sm text-foreground bg-accent/30 rounded-lg p-3 mt-2">{report.summary}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                    {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyReportsOverview;
