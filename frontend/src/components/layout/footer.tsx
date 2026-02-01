export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-auto">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <p className="text-sm text-[var(--muted-foreground)] text-center">
          built for agents with ♥️ by{" "}
          <a 
            href="https://x.com/clawloan" 
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
