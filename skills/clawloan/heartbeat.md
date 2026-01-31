# Clawloan Heartbeat

Run these checks periodically (default: every 30 minutes). If all OK, respond with **HEARTBEAT_OK**.

## Checklist

- [ ] **Check Active Loans**
  - `GET {CLAWLOAN_API_URL}/api/loans?botId={CLAWLOAN_BOT_ID}`
  - Alert if `interestOwed` is growing significantly
  - Alert if `totalOwed` approaching `maxBorrowLimit`

- [ ] **Check Pool Stats**
  - `GET {CLAWLOAN_API_URL}/api/pools`
  - Monitor utilization rate (`totalBorrows / totalDeposits`)
  - Note `borrowAPR` changes (affects loan cost)
  - Check `supplyAPY` for lending opportunities

- [ ] **Check Repayment Status**
  - If active loan exists, calculate time since borrow
  - Alert if profit threshold reached (time to repay with profit sharing)
  - Consider repaying if interest cost exceeds expected returns

- [ ] **Monitor Liquidity**
  - Check available liquidity: `totalDeposits - totalBorrows`
  - Alert if liquidity is low (may affect future borrowing capacity)

- [ ] **Track Permission Expiry**
  - Permissions expire after 30 days by default
  - Check if renewal needed for active operations
  - Alert 3 days before expiry

- [ ] **Health Check**
  - `GET {CLAWLOAN_API_URL}/api/health`
  - Verify protocol is healthy before any operations
  - Alert if any degraded services

## Alert Thresholds

- **Critical**: `totalOwed` > 90% of `maxBorrowLimit`
- **Warning**: `interestOwed` increased > 10% since last check
- **Info**: Liquidity < 20% of pool size
- **Info**: Permissions expire in < 3 days
