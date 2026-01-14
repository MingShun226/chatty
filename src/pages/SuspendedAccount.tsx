import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, MessageCircle, LogOut } from 'lucide-react';

export const SuspendedAccount = () => {
  const { signOut } = useAuth();

  const handleContactSupport = () => {
    window.open('https://wa.me/60165230268', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-600">Account Suspended</CardTitle>
          <CardDescription className="text-base mt-2">
            Your account has been suspended. You cannot access the platform at this time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-100 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground mb-2">
              If you believe this is a mistake or would like to appeal, please contact our support team:
            </p>
            <p className="font-mono text-lg font-semibold">+60 16-523 0268</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              onClick={handleContactSupport}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Contact Support via WhatsApp
            </Button>

            <Button
              variant="outline"
              onClick={signOut}
              className="w-full"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuspendedAccount;
