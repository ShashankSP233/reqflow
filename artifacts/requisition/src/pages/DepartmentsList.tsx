import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function DepartmentsList() {
  return (
    <div className="p-6 max-w-2xl mx-auto text-center mt-16 space-y-3">
      <h2 className="text-xl font-bold">Departments moved</h2>
      <p className="text-muted-foreground">Company and site setup has been moved to <strong>Companies &amp; Sites</strong> in the sidebar.</p>
      <Link href="/setup/companies" className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
        Go to Setup
      </Link>
    </div>
  );
}
