import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Documento no encontrado</h1>
      <p className="text-sm text-muted-foreground">No existe en este entorno de demo.</p>
      <Button asChild>
        <Link href="/">Volver al inicio</Link>
      </Button>
    </main>
  );
}
