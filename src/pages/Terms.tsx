import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface TermsData {
  enabled: boolean;
  content: string;
  last_updated: string | null;
}

const Terms = () => {
  const { settings: platformSettings } = usePlatformSettings();
  const [terms, setTerms] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'terms_and_conditions')
        .maybeSingle();

      if (data?.setting_value) {
        setTerms(data.setting_value as TermsData);
      }
    } catch (error) {
      console.error('Error fetching terms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button variant="ghost" asChild>
            <Link to="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to {platformSettings.platform_name}
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Terms & Conditions
            </CardTitle>
            {terms?.last_updated && (
              <p className="text-sm text-muted-foreground">
                Last updated: {new Date(terms.last_updated).toLocaleDateString('en-MY', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </CardHeader>
          <CardContent>
            {terms?.content ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{terms.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Terms Available</h3>
                <p className="text-muted-foreground">
                  Terms and conditions have not been configured yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            {platformSettings.platform_name} - {platformSettings.platform_description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Terms;
