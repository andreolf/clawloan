"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);

  // Close on escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setShowMenu(false);
  }, []);

  // Close dropdown when clicking anywhere
  useEffect(() => {
    if (!showMenu) return;

    const handleClickOutside = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-wallet-menu]')) {
        setShowMenu(false);
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
  }, [showMenu, handleEscape]);

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

  // Get the injected connector (MetaMask, etc.)
  const injectedConnector = connectors.find((c) => c.type === "injected");

  return (
    <Button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isPending || !injectedConnector}
    >
      {isPending ? "Connecting..." : "Connect Wallet"}
    </Button>
  );
}
