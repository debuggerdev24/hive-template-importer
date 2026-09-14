"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ApplicationError]", error);
  }, [error]);

  return (
    <div className="container flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/30 shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
          <CardDescription>
            An unexpected error occurred while processing your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground break-words max-h-32 overflow-y-auto">
            {error.message || "Unknown application error"}
          </div>
        </CardContent>
        <CardFooter className="flex justify-center gap-3">
          <Button onClick={() => reset()} variant="default" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </Button>
          <Button onClick={() => (window.location.href = "/")} variant="outline">
            Return Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
