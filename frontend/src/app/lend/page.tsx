"use client";

import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/wallet/connect-button";
import { getContractAddress } from "@/config/wagmi";
import { USDC_ABI, LENDING_POOL_ABI } from "@/lib/contracts";

export default function LendPage() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const [amount, setAmount] = useState("");
  const [needsApproval, setNeedsApproval] = useState(true);

  // Contract addresses
  const usdcAddress = getContractAddress(chainId, "usdc");
  const lendingPoolAddress = getContractAddress(chainId, "lendingPool");

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

  // Read pool stats
  const { data: totalBorrows } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalBorrows",
    query: { enabled: !!lendingPoolAddress },
  });

  const { data: userShares, refetch: refetchShares } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "shares",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!lendingPoolAddress },
  });

  const { data: userDepositValue, refetch: refetchDepositValue } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "getDepositValue",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!lendingPoolAddress },
  });

  const { data: poolTotalDeposits, refetch: refetchPoolDeposits } = useReadContract({
    address: lendingPoolAddress,
    abi: LENDING_POOL_ABI,
    functionName: "totalDeposits",
    query: { enabled: !!lendingPoolAddress },
  });

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
      refetchShares();
      refetchDepositValue();
      refetchPoolDeposits();
      setAmount("");
    }
  }, [isDepositSuccess, refetchShares, refetchDepositValue, refetchPoolDeposits]);

  // Refetch position after withdraw
  useEffect(() => {
    if (isWithdrawSuccess) {
      refetchShares();
      refetchDepositValue();
      refetchPoolDeposits();
    }
  }, [isWithdrawSuccess, refetchShares, refetchDepositValue, refetchPoolDeposits]);

  // Calculate stats
  const tvl = poolTotalDeposits ? formatUnits(poolTotalDeposits, 6) : "0";
  const borrowed = totalBorrows ? formatUnits(totalBorrows, 6) : "0";
  const utilization = poolTotalDeposits && poolTotalDeposits > 0n
    ? ((Number(totalBorrows || 0n) / Number(poolTotalDeposits)) * 100).toFixed(1)
    : "0";
  const balance = usdcBalance ? formatUnits(usdcBalance, 6) : "0";
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

  const handleWithdraw = () => {
    if (!lendingPoolAddress || !userShares) return;
    withdraw({
      address: lendingPoolAddress,
      abi: LENDING_POOL_ABI,
      functionName: "withdraw",
      args: [userShares], // Withdraw all shares
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
                → Switch to Base Sepolia
              </span>
            )}
          </div>
        )}
      </div>

      {/* Pool Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-[var(--primary)]">
            ${Number(tvl).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">TVL</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold text-[var(--success)]">
            ${Number(borrowed).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">Borrowed</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--card-border)] rounded-lg p-4 text-center">
          <p className="text-xl font-bold">{utilization}%</p>
          <p className="text-xs text-[var(--muted-foreground)]">Utilization</p>
        </div>
      </div>

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
            Switch to Base Sepolia (testnet) to test
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
                    (Switch to Base Sepolia for test USDC)
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
                <span className="text-[var(--muted-foreground)]">Shares</span>
                <span>{userShares ? formatUnits(userShares, 6) : "0"}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handleWithdraw}
                disabled={isWithdrawing || isWithdrawConfirming || !userShares || userShares === 0n}
              >
                {isWithdrawing || isWithdrawConfirming ? "Withdrawing..." : "Withdraw All"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
