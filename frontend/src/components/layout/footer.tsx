export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-auto">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-[var(--muted-foreground)]">
          built for agents with ♥️ by{" "}
          <a 
            href="https://x.com/francescoswiss" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[var(--foreground)] hover:text-orange-500 transition-colors"
          >
            andreolf
          </a>
        </p>
      </div>
    </footer>
  );
}
