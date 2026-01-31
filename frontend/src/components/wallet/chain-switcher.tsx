"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useState, useEffect, useCallback } from "react";
import { SUPPORTED_CHAINS } from "@/config/wagmi";

export function ChainSwitcher() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();
  const [isOpen, setIsOpen] = useState(false);

  // Close on escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") setIsOpen(false);
  }, []);

  // Close dropdown when clicking anywhere
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = () => setIsOpen(false);
    
    // Use timeout to avoid closing immediately when opening
    const timer = setTimeout(() => {
      window.addEventListener("click", handleClick);
      window.addEventListener("keydown", handleEscape);
    }, 0);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, handleEscape]);

  if (!isConnected) return null;

  const currentChain = SUPPORTED_CHAINS.find(c => c.id === chainId);
  
  // Filter to show only chains with deployed contracts or testnets
  const availableChains = SUPPORTED_CHAINS.filter(c => 
    c.id === 84532 || // Base Sepolia (live)
    c.id === 421614 || // Arbitrum Sepolia
    c.id === 11155420 || // Optimism Sepolia
    c.id === 8453 || // Base Mainnet
    c.id === 42161 || // Arbitrum
    c.id === 10 // Optimism
  );

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md border border-[var(--border)] hover:bg-[var(--muted)] transition-colors"
        disabled={isPending}
      >
        <span>{currentChain?.icon || "🔗"}</span>
        <span className="hidden sm:inline">{currentChain?.name || "Unknown"}</span>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute right-0 top-full mt-2 z-50 w-52 bg-[var(--card)] border border-[var(--card-border)] rounded-lg shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2">
            <p className="px-2 py-1.5 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-medium">
              Testnets
            </p>
            {availableChains.filter(c => c.testnet).map(chain => {
              const isSelected = chain.id === chainId;
              const isLive = chain.id === 84532;
              
              return (
                <button
                  key={chain.id}
                  onClick={() => {
                    switchChain?.({ chainId: chain.id });
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[var(--muted)] transition-colors whitespace-nowrap ${
                    isSelected ? "bg-[var(--muted)]" : ""
                  }`}
                >
                  <span className="text-base">{chain.icon}</span>
                  <span className="flex-1 text-left">{chain.name}</span>
                  {isLive && (
                    <span className="text-[10px] text-green-400 font-medium">● Live</span>
                  )}
                </button>
              );
            })}
            
            <div className="border-t border-[var(--border)] my-2" />
            
            <p className="px-2 py-1.5 text-[10px] text-[var(--muted-foreground)] uppercase tracking-wider font-medium">
              Mainnets
            </p>
            {availableChains.filter(c => !c.testnet).map(chain => (
              <button
                key={chain.id}
                onClick={() => {
                  switchChain?.({ chainId: chain.id });
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-[var(--muted)] transition-colors whitespace-nowrap opacity-60 ${
                  chain.id === chainId ? "bg-[var(--muted)]" : ""
                }`}
              >
                <span className="text-base">{chain.icon}</span>
                <span className="flex-1 text-left">{chain.name}</span>
                <span className="text-[10px] text-[var(--muted-foreground)]">Soon</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
