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
          <span className="w-2 h-2 rounded-full bg-green-400"></span>
          {shortenAddress(address)}
        </Button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-xl z-50">
            <div className="p-3 border-b border-[var(--card-border)]">
              <p className="text-xs text-[var(--muted-foreground)]">Connected</p>
              <p className="font-mono text-sm">{shortenAddress(address)}</p>
            </div>
            <div className="p-2">
              <button
                onClick={() => {
                  disconnect();
                  setShowMenu(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-red-400 hover:bg-[var(--muted)] transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Get available connectors - filter to useful ones
  const walletConnectConnector = connectors.find((c) => c.id === "walletConnect");
  const injectedConnector = connectors.find((c) => c.type === "injected");
  
  // Check if on mobile (no window.ethereum usually means mobile browser)
  const isMobile = typeof window !== "undefined" && !(window as unknown as { ethereum?: unknown }).ethereum;

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
    <div className="relative" data-wallet-menu>
      <Button
        onClick={handleConnect}
        disabled={isPending}
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </Button>

      {showConnectors && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-[var(--card-border)]">
            <p className="text-sm font-medium">Connect Wallet</p>
            {isMobile && (
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Use WalletConnect for mobile
              </p>
            )}
          </div>
          <div className="p-2 space-y-1">
            {/* WalletConnect - show first and prominently on mobile */}
            {walletConnectConnector && (
              <button
                onClick={() => handleDirectConnect(walletConnectConnector)}
                disabled={isPending}
                className="w-full text-left px-3 py-3 rounded-md text-sm hover:bg-[var(--muted)] transition-colors flex items-center gap-3 border border-[var(--card-border)]"
              >
                <span className="text-lg">🔗</span>
                <div>
                  <div className="font-medium">WalletConnect</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    Mobile & Desktop wallets
                  </div>
                </div>
              </button>
            )}
            
            {/* Injected (MetaMask, etc) - only show if available */}
            {injectedConnector && !isMobile && (
              <button
                onClick={() => handleDirectConnect(injectedConnector)}
                disabled={isPending}
                className="w-full text-left px-3 py-3 rounded-md text-sm hover:bg-[var(--muted)] transition-colors flex items-center gap-3"
              >
                <span className="text-lg">🦊</span>
                <div>
                  <div className="font-medium">Browser Wallet</div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    MetaMask, Rabby, etc.
                  </div>
                </div>
              </button>
            )}
          </div>
          
          {error && (
            <div className="p-2 border-t border-[var(--card-border)]">
              <p className="text-xs text-red-400">{error.message}</p>
            </div>
          )}
          
          <div className="p-2 border-t border-[var(--card-border)]">
            <button
              onClick={() => setShowConnectors(false)}
              className="w-full text-center px-3 py-2 rounded-md text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
