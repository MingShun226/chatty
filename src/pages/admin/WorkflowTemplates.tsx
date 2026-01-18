/**
 * Admin Workflow Templates Management Page
 *
 * Allows admins to manage n8n workflow templates for different chatbot use cases.
 * Templates can be downloaded and imported into n8n for each user's chatbot setup.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Workflow,
  Plus,
  Download,
  Edit,
  Trash2,
  MoreVertical,
  Loader2,
  FileJson,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  workflow_type: 'ecommerce' | 'appointment' | 'property' | 'support' | 'custom';
  template_json: string;
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

const WORKFLOW_TYPES = [
  { value: 'ecommerce', label: 'E-commerce', description: 'Product sales, pricing, stock, promotions' },
  { value: 'appointment', label: 'Appointment Booking', description: 'Scheduling, availability, confirmations' },
  { value: 'property', label: 'Property Agent', description: 'Listings, inquiries, viewings' },
  { value: 'support', label: 'General Support', description: 'FAQ, document Q&A, tickets' },
  { value: 'custom', label: 'Custom', description: 'Custom workflow for specific use cases' },
];

const getWorkflowTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    ecommerce: 'bg-blue-100 text-blue-800',
    appointment: 'bg-purple-100 text-purple-800',
    property: 'bg-green-100 text-green-800',
    support: 'bg-orange-100 text-orange-800',
    custom: 'bg-gray-100 text-gray-800',
  };
  return colors[type] || colors.custom;
};

export const WorkflowTemplates = () => {
  const { adminUser, isSuperAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    workflow_type: 'ecommerce' as WorkflowTemplate['workflow_type'],
    template_json: '',
    version: '1.0.0',
    is_active: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .order('workflow_type', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      console.error('Error fetching templates:', error);
      // If table doesn't exist yet, just show empty state
      if (error.code === '42P01') {
        setTemplates([]);
      } else {
        toast.error('Failed to load workflow templates');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: WorkflowTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description,
        workflow_type: template.workflow_type,
        template_json: template.template_json,
        version: template.version,
        is_active: template.is_active,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        workflow_type: 'ecommerce',
        template_json: '',
        version: '1.0.0',
        is_active: true,
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingTemplate(null);
  };

  const validateJson = (jsonString: string): boolean => {
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.template_json.trim()) {
      toast.error('Template JSON is required');
      return;
    }
    if (!validateJson(formData.template_json)) {
      toast.error('Invalid JSON format. Please check your template.');
      return;
    }

    setSaving(true);
    try {
      const templateData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        workflow_type: formData.workflow_type,
        template_json: formData.template_json,
        version: formData.version,
        is_active: formData.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('workflow_templates')
          .update(templateData)
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success('Template updated successfully');
      } else {
        // Create new template
        const { error } = await supabase
          .from('workflow_templates')
          .insert({
            ...templateData,
            created_by: adminUser?.user_id,
          });

        if (error) throw error;
        toast.success('Template created successfully');
      }

      handleCloseDialog();
      fetchTemplates();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: WorkflowTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', template.id);

      if (error) throw error;
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  const handleDownload = (template: WorkflowTemplate) => {
    try {
      const blob = new Blob([template.template_json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/\s+/g, '-').toLowerCase()}-v${template.version}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };

  const handleCopyJson = async (template: WorkflowTemplate) => {
    try {
      await navigator.clipboard.writeText(template.template_json);
      setCopiedId(template.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('JSON copied to clipboard');
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (validateJson(content)) {
        setFormData(prev => ({ ...prev, template_json: content }));
        toast.success('JSON file loaded');
      } else {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Workflow Templates</h2>
          <p className="text-muted-foreground">
            Manage n8n workflow templates for different chatbot use cases
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How Workflow Templates Work</p>
              <p>
                Each template is a n8n workflow JSON that can be imported into n8n for a user's chatbot.
                When setting up a new user, download the appropriate template, import it into n8n,
                update the webhook URL, and assign it to the user in User Details.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Workflow className="h-5 w-5" />
            Available Templates
          </CardTitle>
          <CardDescription>
            {templates.length} template{templates.length !== 1 ? 's' : ''} available
          </CardDescription>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <FileJson className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No templates yet</p>
              <p className="text-muted-foreground mb-4">
                Add your first workflow template to get started
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground truncate max-w-xs">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getWorkflowTypeBadge(template.workflow_type)}>
                        {WORKFLOW_TYPES.find(t => t.value === template.workflow_type)?.label || template.workflow_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">v{template.version}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(template.updated_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDownload(template)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyJson(template)}>
                            {copiedId === template.id ? (
                              <Check className="h-4 w-4 mr-2" />
                            ) : (
                              <Copy className="h-4 w-4 mr-2" />
                            )}
                            Copy JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleOpenDialog(template)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(template)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Add New Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? 'Update the workflow template details and JSON'
                : 'Create a new n8n workflow template for chatbot setups'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="E-commerce Chatbot Workflow"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="version">Version</Label>
                <Input
                  id="version"
                  value={formData.version}
                  onChange={(e) => setFormData(prev => ({ ...prev, version: e.target.value }))}
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="workflow_type">Workflow Type</Label>
              <Select
                value={formData.workflow_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, workflow_type: value as WorkflowTemplate['workflow_type'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKFLOW_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <span className="font-medium">{type.label}</span>
                        <span className="text-muted-foreground ml-2">- {type.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of what this workflow does..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="template_json">Workflow JSON *</Label>
                <div className="flex gap-2">
                  <input
                    type="file"
                    accept=".json"
                    id="json-upload"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('json-upload')?.click()}
                  >
                    <FileJson className="h-4 w-4 mr-1" />
                    Upload JSON
                  </Button>
                </div>
              </div>
              <Textarea
                id="template_json"
                value={formData.template_json}
                onChange={(e) => setFormData(prev => ({ ...prev, template_json: e.target.value }))}
                placeholder='{"name": "My Workflow", "nodes": [...], "connections": {...}}'
                rows={12}
                className="font-mono text-sm"
              />
              {formData.template_json && !validateJson(formData.template_json) && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Invalid JSON format
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_active">Active (visible to other admins)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {editingTemplate ? 'Update' : 'Create'} Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
