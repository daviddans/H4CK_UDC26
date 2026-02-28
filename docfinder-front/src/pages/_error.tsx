import type { NextPageContext } from "next";

function ErrorPage({ statusCode }: { statusCode?: number }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Error en DocFinder</h1>
        <p className="mt-2 text-sm text-muted-foreground">{statusCode ? `Código ${statusCode}` : "Error inesperado"}</p>
      </div>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 404;
  return { statusCode };
};

export default ErrorPage;
