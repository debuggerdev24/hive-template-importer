import { Loader2 } from "lucide-react";

export default function ImportLoading() {
  return (
    <div className="container max-w-4xl py-12 flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-medium">Loading importer...</p>
    </div>
  );
}
