"use client";

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";
import { shortenAddress } from "@/lib/utils";
import { SUPPORTED_CHAINS } from "@/config/wagmi";
import { useState } from "react";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [showMenu, setShowMenu] = useState(false);

  const currentChain = SUPPORTED_CHAINS.find((c) => c.id === chainId);

  if (isConnected && address) {
    return (
      <div className="relative">
        <Button
          variant="outline"
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2"
        >
          <span>{currentChain?.icon || "⛓️"}</span>
          {shortenAddress(address)}
        </Button>

        {showMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-2 w-48 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-lg z-50">
              <div className="p-2 border-b border-[var(--card-border)]">
                <p className="text-xs text-[var(--muted-foreground)]">Network</p>
                <p className="font-medium">{currentChain?.name || "Unknown"}</p>
              </div>
              <div className="p-2 space-y-1">
                {SUPPORTED_CHAINS.filter((c) => !c.testnet).map((chain) => (
                  <button
                    key={chain.id}
                    onClick={() => {
                      switchChain({ chainId: chain.id });
                      setShowMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-[var(--muted)] flex items-center gap-2 ${chainId === chain.id ? "bg-[var(--muted)]" : ""
                      }`}
                  >
                    <span>{chain.icon}</span>
                    {chain.name}
                  </button>
                ))}
              </div>
              <div className="p-2 border-t border-[var(--card-border)]">
                <button
                  onClick={() => {
                    disconnect();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded text-sm text-[var(--danger)] hover:bg-[var(--muted)]"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </>
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
