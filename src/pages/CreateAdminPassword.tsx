import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Shield, Key, Copy } from 'lucide-react';

const CreateAdminPassword = () => {
  console.log('CreateAdminPassword component loaded!');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const createAdminAuth = async () => {
    setLoading(true);
    setResults([]);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-admin-auth', {
        body: {}
      });
      
      if (error) {
        console.error('Error creating admin auth:', error);
        toast({
          title: "Error",
          description: `Failed to create admin auth: ${error.message}`,
          variant: "destructive"
        });
        return;
      }
      
      if (data?.results && data.results.length > 0) {
        setResults(data.results);
        toast({
          title: "Success",
          description: `Created ${data.successful} admin auth accounts`,
        });
      } else {
        toast({
          title: "Info",
          description: data?.message || "No admin users needed auth creation",
        });
      }
    } catch (error) {
      console.error('Exception creating admin auth:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Password copied to clipboard"
    });
  };

  return (
    <main className="min-h-screen bg-brand-blue flex flex-col items-center justify-start pt-16 px-4">
      <div className="w-full max-w-2xl space-y-6">
        <Card>
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Create Admin Auth Account</CardTitle>
              <CardDescription className="text-base">
                Generate authentication accounts and temporary passwords for admin users
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Button 
              onClick={createAdminAuth} 
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Creating..." : "Create Admin Auth Account"}
            </Button>

            {results.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Admin Auth Results
                </h3>
                
                {results.map((result, index) => (
                  <Card key={index} className={result.success ? "border-green-200" : "border-red-200"}>
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div>
                          <strong>Email:</strong> {result.email}
                        </div>
                        
                        {result.success ? (
                          <>
                            <div>
                              <strong>Auth User ID:</strong> {result.auth_user_id}
                            </div>
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <div className="flex items-center justify-between">
                                <div>
                                  <strong>Temporary Password:</strong>
                                  <div className="font-mono text-lg mt-1 break-all">
                                    {result.temp_password}
                                  </div>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyToClipboard(result.temp_password)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                              <p className="text-yellow-800 text-sm mt-2">
                                ⚠️ Save this password! You'll need it to log in as {result.email}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <strong>Error:</strong> {result.error}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default CreateAdminPassword;