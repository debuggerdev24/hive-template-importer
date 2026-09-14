import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full text-center shadow-md">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestion className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Page Not Found</CardTitle>
          <CardDescription>
            The requested template or page could not be located.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center gap-3">
          <Button asChild variant="default">
            <Link href="/templates">Go to Templates</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
