import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";

export default function MarketingConnections() {
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-4xl">Connections</h1>
        <p className="text-muted-foreground mt-1">Connect your LinkedIn, Facebook & Instagram accounts.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plug className="w-5 h-5 text-accent" /> Pending setup
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Once you provide LinkedIn / Meta developer app credentials, "Connect" buttons appear here and tokens are stored securely per account.</p>
        </CardContent>
      </Card>
    </div>
  );
}
