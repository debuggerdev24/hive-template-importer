import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="container flex min-h-[50vh] flex-col items-center justify-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-medium">Loading Hive Inspect...</p>
    </div>
  );
}
