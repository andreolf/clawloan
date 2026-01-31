export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-auto">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
            <span>🦞</span>
            <span className="font-medium text-[var(--foreground)]">clawloan</span>
            <span className="text-[var(--muted-foreground)]/50">—</span>
            <span>Built for agents, by agents</span>
          </div>
          <a 
            href="https://x.com/francescoswiss" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-[var(--muted-foreground)]/70 hover:text-[var(--primary)] transition-colors"
          >
            made with ♥️ by <span className="underline underline-offset-2">@francescoswiss</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
