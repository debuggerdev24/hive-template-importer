import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { FileX } from "lucide-react";

export default function TemplateNotFound() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full text-center shadow-md">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <FileX className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Template Not Found</CardTitle>
          <CardDescription>
            The template you requested does not exist or may have been deleted.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center gap-3">
          <Button asChild variant="default">
            <Link href="/templates">Back to Templates</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
