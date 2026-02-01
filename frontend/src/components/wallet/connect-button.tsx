"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [hasInjected, setHasInjected] = useState(false);

  // Detect injected wallet after mount (avoids hydration mismatch)
  useEffect(() => {
    const w = window as unknown as { ethereum?: unknown };
    setHasInjected(!!w.ethereum);
  }, []);

  // Close on escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setShowMenu(false);
      setShowConnectors(false);
    }
  }, []);

  // Close dropdown when clicking anywhere
  useEffect(() => {
    if (!showMenu && !showConnectors) return;

    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-wallet-menu]')) {
        setShowMenu(false);
        setShowConnectors(false);
      }
    };
    
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMenu, showConnectors, handleEscape]);

  if (isConnected && address) {
    return (
      <div className="relative" data-wallet-menu>
        <Button
          variant="outline"
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
          {shortenAddress(address)}
        </Button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-[var(--card)] border border-[var(--card-border)] rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[var(--primary)]/10 to-transparent">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Connected</p>
              <p className="font-mono text-sm font-medium">{shortenAddress(address)}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors font-medium"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Get available connectors
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect");
  const injectedConnector = connectors.find((c) => c.type === "injected");

  // Show connector selector
  const handleConnect = () => {
    setShowConnectors(true);
  };

  // Direct connect to a specific connector
  const handleDirectConnect = (connector: typeof connectors[0]) => {
    connect({ connector });
    setShowConnectors(false);
  };

  return (
    <>
      {/* Backdrop */}
      {showConnectors && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setShowConnectors(false)}
        />
      )}
      
      <div className="relative" data-wallet-menu>
        <Button
          onClick={handleConnect}
          disabled={isPending}
          className="font-medium"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Connecting...
            </span>
          ) : (
            "Connect"
          )}
        </Button>

        {showConnectors && (
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] max-w-[calc(100vw-2rem)] sm:max-w-[90vw] bg-[var(--card)] border border-[var(--card-border)] rounded-2xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[var(--card-border)] flex items-center justify-between">
              <h3 className="text-lg font-semibold">Connect Wallet</h3>
              <button
                onClick={() => setShowConnectors(false)}
                className="p-1.5 rounded-lg hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Wallet Options */}
            <div className="p-4 space-y-3">
              {/* Browser Wallet (MetaMask, etc) - show if detected */}
              {injectedConnector && hasInjected && (
                <button
                  onClick={() => handleDirectConnect(injectedConnector)}
                  disabled={isPending}
                  className="w-full text-left p-4 rounded-xl bg-[var(--muted)]/50 hover:bg-[var(--muted)] transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-2xl shadow-lg">
                    🦊
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold group-hover:text-[var(--primary)] transition-colors">Browser Wallet</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      MetaMask, Rabby, Coinbase
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              
              {/* WalletConnect - always show */}
              {walletConnectConnector && (
                <button
                  onClick={() => handleDirectConnect(walletConnectConnector)}
                  disabled={isPending}
                  className="w-full text-left p-4 rounded-xl bg-[var(--muted)]/50 hover:bg-[var(--muted)] transition-all flex items-center gap-4 group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white shadow-lg">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.09 10.5c3.28-3.21 8.54-3.21 11.82 0l.39.38a.4.4 0 010 .58l-1.34 1.31a.21.21 0 01-.3 0l-.54-.53c-2.28-2.24-5.96-2.24-8.24 0l-.58.57a.21.21 0 01-.3 0L5.66 11.5a.4.4 0 010-.58l.43-.42zm14.6 2.72l1.2 1.17a.4.4 0 010 .58l-5.38 5.27a.42.42 0 01-.59 0l-3.82-3.74a.1.1 0 00-.15 0l-3.82 3.74a.42.42 0 01-.59 0L2.16 14.97a.4.4 0 010-.58l1.2-1.17a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0l3.82 3.74a.1.1 0 00.15 0l3.82-3.74a.42.42 0 01.59 0z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold group-hover:text-[var(--primary)] transition-colors">WalletConnect</div>
                    <div className="text-sm text-[var(--muted-foreground)]">
                      Scan with mobile wallet
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Error */}
            {error && (
              <div className="px-4 pb-4">
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error.message}</p>
                </div>
              </div>
            )}
            
            {/* Footer */}
            <div className="px-5 py-4 border-t border-[var(--card-border)] bg-[var(--muted)]/30">
              <p className="text-xs text-center text-[var(--muted-foreground)]">
                By connecting, you agree to the Terms of Service
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
