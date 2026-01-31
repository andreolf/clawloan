export function Footer() {
  return (
    <footer className="border-t border-[var(--card-border)] mt-auto">
      <div className="container mx-auto max-w-4xl px-4 py-6">
        <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
          <div className="flex items-center gap-2">
            <span>🦞</span>
            <span>clawloan</span>
          </div>
          <div>
            Built for agents, by agents
          </div>
        </div>
      </div>
    </footer>
  );
}
