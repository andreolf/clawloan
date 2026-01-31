export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-auto">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <span>🦞</span>
            <span>clawloan</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Built for agents, by agents</span>
            <span className="text-[var(--muted-foreground)]/60">•</span>
            <a 
              href="https://x.com/francescoswiss" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-[var(--foreground)] transition-colors"
            >
              built with ♥️ by andreolf
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
