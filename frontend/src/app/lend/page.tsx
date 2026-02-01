"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { base } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/connect-button";
import { ActivityFeed } from "@/components/activity-feed";
import { getTokenAddress, getLendingPoolAddress, SUPPORTED_TOKENS, type TokenSymbol } from "@/config/wagmi";
import { USDC_ABI, LENDING_POOL_ABI } from "@/lib/contracts";

// Default pool for stats display (Base Mainnet USDC)
const DEFAULT_CHAIN_ID = 8453;
const DEFAULT_TOKEN: TokenSymbol = "USDC";

export default function LendPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [needsApproval, setNeedsApproval] = useState(true);
  const [selectedToken, setSelectedToken] = useState<TokenSymbol>("USDC");

  // Contract addresses for user's current chain
  const tokenAddress = getTokenAddress(chainId, selectedToken);
  const lendingPoolAddress = getLendingPoolAddress(chainId, selectedToken);
  
  // For backwards compatibility
  const usdcAddress = tokenAddress;

  // Read USDC balance
  const { data: usdcBalance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddress },
  });

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: "allowance",
    args: address && lendingPoolAddress ? [address, lendingPoolAddress] : undefined,
    query: { enabled: !!address && !!usdcAddress && !!lendingPoolAddress },
  });

  // Read pool stats (always from Base Mainnet for display when no wallet)
  const defaultPoolAddress = getLendingPoolAddress(DEFAULT_CHAIN_ID, DEFAULT_TOKEN);
  
  const { data: globalTotalDeposits, refetch: refetchGlobalDeposits } = useReadContract({
    address: defaultPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalDeposits",
    chainId: base.id,
    query: { enabled: !!defaultPoolAddress },
  });

  const { data: globalTotalBorrows, refetch: refetchGlobalBorrows } = useReadContract({
    address: defaultPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalBorrows",
    chainId: base.id,
    query: { enabled: !!defaultPoolAddress },
  });

  const { data: supplyRate } = useReadContract({
    address: defaultPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "getSupplyRate",
    chainId: base.id,
    query: { enabled: !!defaultPoolAddress },
  });

  // Read user's deposit (returns [shares, rewardDebt])
  const { data: userDeposit, refetch: refetchUserDeposit } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "deposits",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!lendingPoolAddress },
  });

  const { data: poolTotalDeposits, refetch: refetchPoolDeposits } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalDeposits",
    query: { enabled: !!lendingPoolAddress },
  });

  const { data: poolTotalShares, refetch: refetchPoolShares } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalShares",
    query: { enabled: !!lendingPoolAddress },
  });

  // Extract user shares from deposit struct
  const userShares = userDeposit ? (userDeposit as [bigint, bigint])[0] : 0n;

  // Write functions
  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract();
  const { writeContract: deposit, data: depositHash, isPending: isDepositing } = useWriteContract();
  const { writeContract: withdraw, data: withdrawHash, isPending: isWithdrawing } = useWriteContract();

  // Wait for transactions
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });
  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash });

  // Check if approval needed
  useEffect(() => {
    if (allowance !== undefined && amount) {
      const amountWei = parseUnits(amount || "0", 6);
      setNeedsApproval(allowance < amountWei);
    }
  }, [allowance, amount]);

  // Refetch allowance after approval
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess, refetchAllowance]);

  // Refetch position after deposit
  useEffect(() => {
    if (isDepositSuccess) {
      refetchUserDeposit();
      refetchPoolDeposits();
      refetchPoolShares();
      refetchGlobalDeposits();
      refetchGlobalBorrows();
      setAmount("");
    }
  }, [isDepositSuccess, refetchUserDeposit, refetchPoolDeposits, refetchPoolShares, refetchGlobalDeposits, refetchGlobalBorrows]);

  // Refetch position after withdraw
  useEffect(() => {
    if (isWithdrawSuccess) {
      refetchUserDeposit();
      refetchPoolDeposits();
      refetchPoolShares();
      refetchGlobalDeposits();
      refetchGlobalBorrows();
      setWithdrawAmount("");
    }
  }, [isWithdrawSuccess, refetchUserDeposit, refetchPoolDeposits, refetchPoolShares, refetchGlobalDeposits, refetchGlobalBorrows]);

  // Calculate stats (use global stats for display, local for user position)
  const tvl = globalTotalDeposits ? formatUnits(globalTotalDeposits, 6) : "0";
  const borrowed = globalTotalBorrows ? formatUnits(globalTotalBorrows, 6) : "0";
  const utilization = globalTotalDeposits && globalTotalDeposits > 0n
    ? ((Number(globalTotalBorrows || 0n) / Number(globalTotalDeposits)) * 100).toFixed(1)
    : "0";
  
  // Supply APY calculation (rate is in RAY = 1e27)
  const RAY = 1e27;
  const supplyAPY = supplyRate ? ((Number(supplyRate) / RAY) * 100).toFixed(2) : "0.00";
  const balance = usdcBalance ? formatUnits(usdcBalance, 6) : "0";
  
  // Calculate user deposit value: shares * totalDeposits / totalShares
  const userDepositValue = (userShares && poolTotalDeposits && poolTotalShares && poolTotalShares > 0n)
    ? (userShares * poolTotalDeposits) / poolTotalShares
    : 0n;
  const deposited = userDepositValue ? formatUnits(userDepositValue, 6) : "0";

  const handleApprove = () => {
    if (!usdcAddress || !lendingPoolAddress) return;
    const amountWei = parseUnits(amount || "0", 6);
    approve({
      address: usdcAddress,
      abi: USDC_ABI,
      functionName: "approve",
      args: [lendingPoolAddress, amountWei],
    });
  };

  const handleDeposit = () => {
    if (!lendingPoolAddress) return;
    const amountWei = parseUnits(amount || "0", 6);
    deposit({
      address: lendingPoolAddress,
      abi: LENDING_POOL_ABI,
      functionName: "deposit",
      args: [amountWei],
    });
  };

  const handleWithdraw = (withdrawAll: boolean = false) => {
    if (!lendingPoolAddress || !userShares) return;
    
    let sharesToWithdraw = userShares;
    
    if (!withdrawAll && withdrawAmount && poolTotalDeposits && poolTotalShares && poolTotalShares > 0n) {
      // Convert USDC amount to shares: shares = amount * totalShares / totalDeposits
      const amountWei = parseUnits(withdrawAmount, 6);
      sharesToWithdraw = (amountWei * poolTotalShares) / poolTotalDeposits;
      // Cap at user's total shares
      if (sharesToWithdraw > userShares) {
        sharesToWithdraw = userShares;
      }
    }
    
    withdraw({
      address: lendingPoolAddress,
      abi: LENDING_POOL_ABI,
      functionName: "withdraw",
      args: [sharesToWithdraw],
    });
  };

  const isLoading = isApproving || isApproveConfirming || isDepositing || isDepositConfirming;
  const contractsDeployed = !!usdcAddress && !!lendingPoolAddress;

  // Network names
  const networkNames: Record<number, string> = {
    84532: "Base Sepolia",
    8453: "Base",
    59144: "Linea",
    59141: "Linea Sepolia",
    1: "Ethereum",
  };
  const currentNetwork = networkNames[chainId] || `Chain ${chainId}`;
  const isTestnet = chainId === 84532 || chainId === 59141;

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <div className="text-center mb-8">
        <div className="text-4xl mb-4">💵</div>
        <h1 className="text-2xl font-bold mb-2">Lend USDC</h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          Supply USDC and earn yield from agent loans
        </p>
        {isConnected && (
          <div className="mt-3 inline-flex items-center gap-2 text-xs">
            <span className={`px-2 py-1 rounded ${isTestnet ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'}`}>
              {isTestnet ? '🧪' : '🟢'} {currentNetwork}
            </span>
            {!contractsDeployed && (
              <span className="text-[var(--danger)]">
                → Switch to Base
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-2xl font-bold text-[var(--success)]">
            {supplyAPY}%
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Supply APY</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-[var(--primary)]">
            ${Number(tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">TVL</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold">
            ${Number(borrowed).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Borrowed</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold">{utilization}%</p>
          <p className="text-xs text-[var(--muted-foreground)]">Utilization</p>
        </div>
      </div>
      
      {/* APY Explanation */}
      {Number(supplyAPY) === 0 && (
        <div className="mb-6 text-center text-sm text-[var(--muted-foreground)] bg-[var(--muted)]/20 rounded-lg p-3">
          <p>APY is currently 0% because there are no active loans.</p>
          <p className="text-xs mt-1">When agents borrow, you earn up to <span className="text-[var(--success)]">~4.5% APY</span> at optimal utilization.</p>
        </div>
      )}

      {!isConnected ? (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted-foreground)] mb-4">
            Connect wallet to supply USDC
          </p>
          <ConnectButton />
        </div>
      ) : !contractsDeployed ? (
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-8 text-center">
          <p className="text-[var(--muted-foreground)] mb-2">
            Contracts not deployed on this network
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Switch to Base to use the live protocol
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Supply Form */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <h2 className="font-medium mb-4">Supply</h2>
            <div className="mb-4">
              <div className="relative">
                <input
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <span className="text-sm text-[var(--muted-foreground)]">USDC</span>
                  <button
                    onClick={() => setAmount(balance)}
                    className="text-xs text-[var(--primary)] hover:underline"
                  >
                    MAX
                  </button>
                </div>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] mt-2">
                Balance: {Number(balance).toLocaleString()} USDC
                {Number(balance) === 0 && (
                  <span className="text-[var(--warning)] ml-2">
                    (Get USDC on Base to deposit)
                  </span>
                )}
              </p>
            </div>

            {needsApproval ? (
              <Button
                className="w-full"
                onClick={handleApprove}
                disabled={isLoading || !amount || Number(amount) <= 0}
              >
                {isApproving || isApproveConfirming
                  ? "Approving..."
                  : !amount || Number(amount) <= 0
                    ? "Enter amount to approve"
                    : "Approve USDC"}
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handleDeposit}
                disabled={isLoading || !amount || Number(amount) <= 0}
              >
                {isDepositing || isDepositConfirming
                  ? "Supplying..."
                  : !amount || Number(amount) <= 0
                    ? "Enter amount to supply"
                    : "Supply USDC"}
              </Button>
            )}

            {isDepositSuccess && (
              <p className="text-xs text-[var(--success)] mt-2 text-center">
                ✓ Deposit successful!
              </p>
            )}
          </div>

          {/* Position */}
          <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
            <h2 className="font-medium mb-4">Your Position</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Deposited</span>
                <span>${Number(deposited).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Current APY</span>
                <span className="text-[var(--success)]">{supplyAPY}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">Est. yearly earnings</span>
                <span className="text-[var(--success)]">
                  ${(Number(deposited) * Number(supplyAPY) / 100).toFixed(2)}
                </span>
              </div>
            </div>
            
            {/* Withdraw Section */}
            {userShares && userShares > 0n && (
              <div className="mt-4 pt-4 border-t border-[var(--card-border)]">
                <h3 className="text-sm font-medium mb-3">Withdraw</h3>
                <div className="relative mb-3">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full bg-[var(--background)] border border-[var(--border)] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <span className="text-xs text-[var(--muted-foreground)]">USDC</span>
                    <button
                      onClick={() => setWithdrawAmount(deposited)}
                      className="text-xs text-[var(--primary)] hover:underline"
                    >
                      MAX
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleWithdraw(false)}
                    disabled={isWithdrawing || isWithdrawConfirming || !withdrawAmount || Number(withdrawAmount) <= 0}
                  >
                    {isWithdrawing || isWithdrawConfirming ? "Withdrawing..." : "Withdraw"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleWithdraw(true)}
                    disabled={isWithdrawing || isWithdrawConfirming}
                  >
                    All
                  </Button>
                </div>
              </div>
            )}
            
            {isWithdrawSuccess && (
              <p className="text-xs text-[var(--success)] mt-2 text-center">
                ✓ Withdrawal successful!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="mt-8 bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Recent Activity</h2>
          <span className="text-xs text-[var(--muted-foreground)]">Live on Base</span>
        </div>
        <ActivityFeed filter="supply" limit={8} />
      </div>

      {/* Info */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Agents can also lend via API.{" "}
          <a href="/agent" className="text-[var(--primary)] hover:underline">
            See Agent Docs →
          </a>
        </p>
      </div>
    </div>
  );
}
