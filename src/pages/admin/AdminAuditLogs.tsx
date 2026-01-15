import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  Eye,
  User,
  Settings,
  CreditCard,
  Shield,
  Bot,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface AuditLog {
  id: string;
  admin_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  description: string;
  changes: any;
  ip_address: string | null;
  severity: 'info' | 'warning' | 'critical';
  created_at: string;
  admin_email?: string;
}

const resourceIcons: Record<string, typeof User> = {
  user: User,
  settings: Settings,
  tier: CreditCard,
  admin: Shield,
  chatbot: Bot,
};

export const AdminAuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [resourceFilter, setResourceFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      // Fetch audit logs
      let query = supabase
        .from('admin_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      const { data: logsData, error } = await query;

      if (error) throw error;

      // Fetch admin emails for each log
      const logsWithEmails = await Promise.all(
        (logsData || []).map(async (log) => {
          if (log.admin_user_id) {
            const { data: admin } = await supabase
              .from('admin_users')
              .select('user_id')
              .eq('id', log.admin_user_id)
              .single();

            if (admin?.user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', admin.user_id)
                .single();

              return { ...log, admin_email: profile?.email || 'Unknown' };
            }
          }
          return { ...log, admin_email: 'System' };
        })
      );

      setLogs(logsWithEmails);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const config = {
      info: { icon: Info, className: 'bg-blue-100 text-blue-800' },
      warning: { icon: AlertTriangle, className: 'bg-amber-100 text-amber-800' },
      critical: { icon: AlertCircle, className: 'bg-red-100 text-red-800' },
    };

    const { icon: Icon, className } = config[severity as keyof typeof config] || config.info;

    return (
      <Badge variant="outline" className={className}>
        <Icon className="w-3 h-3 mr-1" />
        {severity}
      </Badge>
    );
  };

  const getResourceIcon = (resourceType: string) => {
    const Icon = resourceIcons[resourceType] || FileText;
    return <Icon className="w-4 h-4 text-muted-foreground" />;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === '' ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.admin_email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesResource = resourceFilter === 'all' || log.resource_type === resourceFilter;

    return matchesSearch && matchesSeverity && matchesResource;
  });

  const uniqueResourceTypes = [...new Set(logs.map(l => l.resource_type))];

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>Track all administrative actions on the platform</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchLogs}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Resource" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Resources</SelectItem>
                {uniqueResourceTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Logs Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead className="w-[150px]">Admin</TableHead>
                  <TableHead className="w-[120px]">Resource</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead className="w-[80px]">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No audit logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div>
                          <div className="text-sm">
                            {format(new Date(log.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm truncate max-w-[150px]" title={log.admin_email}>
                          {log.admin_email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResourceIcon(log.resource_type)}
                          <span className="text-sm capitalize">{log.resource_type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{log.action}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[300px]">
                            {log.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {filteredLogs.length} logs (page {page + 1})
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={logs.length < pageSize}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Full details of the selected audit log entry
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Timestamp</div>
                  <div>{format(new Date(selectedLog.created_at), 'PPpp')}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Admin</div>
                  <div>{selectedLog.admin_email}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Resource Type</div>
                  <div className="capitalize">{selectedLog.resource_type}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Resource ID</div>
                  <div className="font-mono text-sm">{selectedLog.resource_id || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Severity</div>
                  <div>{getSeverityBadge(selectedLog.severity)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground">IP Address</div>
                  <div>{selectedLog.ip_address || 'N/A'}</div>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Action</div>
                <div className="font-medium">{selectedLog.action}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Description</div>
                <div>{selectedLog.description}</div>
              </div>
              {selectedLog.changes && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-2">Changes</div>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
