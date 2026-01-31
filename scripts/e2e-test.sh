#!/bin/bash
# End-to-end test script for Clawloan
# Tests both human (lender) and bot (borrower) flows

set -e

API_URL="${API_URL:-http://localhost:3000}"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🦞 Clawloan E2E Test Suite"
echo "=========================="
echo "API URL: $API_URL"
echo ""

# Helper functions
pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

# Test 1: Health Check
echo "1. Health Check"
HEALTH=$(curl -s "$API_URL/api/health")
if echo "$HEALTH" | grep -q '"status":"healthy"'; then
  pass "API is healthy"
else
  fail "API health check failed"
fi

# Test 2: Get Pool Stats
echo ""
echo "2. Pool Stats"
POOLS=$(curl -s "$API_URL/api/pools")
if echo "$POOLS" | grep -q '"totalDeposits"'; then
  TVL=$(echo "$POOLS" | grep -o '"totalDeposits":"[^"]*"' | cut -d'"' -f4)
  UTIL=$(echo "$POOLS" | grep -o '"utilization":[0-9.]*' | cut -d':' -f2)
  pass "Pool stats retrieved (TVL: $TVL, Utilization: $UTIL)"
else
  fail "Failed to get pool stats"
fi

# Test 3: Register Bot (Agent Flow)
echo ""
echo "3. Bot Registration (Agent Flow)"
BOT_NAME="E2ETestBot_$(date +%s)"
BOT_RESPONSE=$(curl -s -X POST "$API_URL/api/bots" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"$BOT_NAME\",\"description\":\"E2E test bot\",\"operatorAddress\":\"0xE2E$(date +%s)E2E\",\"tags\":[\"test\",\"e2e\"]}")

if echo "$BOT_RESPONSE" | grep -q '"bot"'; then
  BOT_ID=$(echo "$BOT_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  pass "Bot registered: $BOT_ID"
else
  fail "Failed to register bot"
fi

# Test 4: Borrow USDC (Bot Flow)
echo ""
echo "4. Borrow Request (Bot Flow)"
BORROW_AMOUNT="25000000" # 25 USDC
BORROW_RESPONSE=$(curl -s -X POST "$API_URL/api/borrow" \
  -H "Content-Type: application/json" \
  -d "{\"botId\":\"$BOT_ID\",\"amount\":\"$BORROW_AMOUNT\"}")

if echo "$BORROW_RESPONSE" | grep -q '"loan"'; then
  LOAN_ID=$(echo "$BORROW_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  pass "Loan created: $LOAN_ID (Amount: $BORROW_AMOUNT)"
else
  fail "Failed to create loan: $BORROW_RESPONSE"
fi

# Test 5: Check Loan Status
echo ""
echo "5. Loan Status Check"
LOANS_RESPONSE=$(curl -s "$API_URL/api/loans?botId=$BOT_ID")
if echo "$LOANS_RESPONSE" | grep -q '"ACTIVE"'; then
  TOTAL_OWED=$(echo "$LOANS_RESPONSE" | grep -o '"totalOwed":"[^"]*"' | head -1 | cut -d'"' -f4)
  pass "Loan is active (Total owed: $TOTAL_OWED)"
else
  fail "Loan not found or not active"
fi

# Test 6: x402 Task Execution
echo ""
echo "6. x402 Task Execution"
info "Testing without payment header..."
NO_PAYMENT=$(curl -s -X POST "$API_URL/api/task" \
  -H "Content-Type: application/json" \
  -d '{"task":"test"}')
if echo "$NO_PAYMENT" | grep -q 'Payment required'; then
  pass "402 returned without payment header"
else
  fail "Expected 402 error: $NO_PAYMENT"
fi

info "Testing with payment header..."
WITH_PAYMENT=$(curl -s -X POST "$API_URL/api/task" \
  -H "Content-Type: application/json" \
  -H "X-Payment-402: test_payment_token" \
  -H "X-Bot-Id: $BOT_ID" \
  -d '{"task":"arbitrage_check"}')
if echo "$WITH_PAYMENT" | grep -q '"success":true'; then
  COST=$(echo "$WITH_PAYMENT" | grep -o '"cost":"[^"]*"' | cut -d'"' -f4)
  pass "Task executed (Cost: $COST)"
else
  fail "Task execution failed: $WITH_PAYMENT"
fi

# Test 7: Repay Loan
echo ""
echo "7. Loan Repayment"
REPAY_RESPONSE=$(curl -s -X POST "$API_URL/api/repay" \
  -H "Content-Type: application/json" \
  -d "{\"botId\":\"$BOT_ID\",\"amount\":\"$BORROW_AMOUNT\"}")

if echo "$REPAY_RESPONSE" | grep -q '"success":true'; then
  TOTAL_REPAID=$(echo "$REPAY_RESPONSE" | grep -o '"totalRepaid":"[^"]*"' | cut -d'"' -f4)
  pass "Loan repaid (Total: $TOTAL_REPAID)"
else
  fail "Failed to repay: $REPAY_RESPONSE"
fi

# Test 8: Repay with Profit (Revenue Share)
echo ""
echo "8. Profit Sharing Flow"
info "Creating new loan for profit test..."
PROFIT_BORROW=$(curl -s -X POST "$API_URL/api/borrow" \
  -H "Content-Type: application/json" \
  -d "{\"botId\":\"$BOT_ID\",\"amount\":\"10000000\"}")

if echo "$PROFIT_BORROW" | grep -q '"loan"'; then
  PROFIT_LOAN_ID=$(echo "$PROFIT_BORROW" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  pass "Test loan created: $PROFIT_LOAN_ID"

  info "Repaying with profit..."
  PROFIT_REPAY=$(curl -s -X POST "$API_URL/api/repay" \
    -H "Content-Type: application/json" \
    -d "{\"botId\":\"$BOT_ID\",\"amount\":\"10000000\",\"profit\":\"2000000\"}")

  if echo "$PROFIT_REPAY" | grep -q '"success":true'; then
    pass "Repaid with profit (2 USDC profit shared)"
  else
    fail "Profit repay failed: $PROFIT_REPAY"
  fi
else
  fail "Could not create loan for profit test: $PROFIT_BORROW"
fi

# Test 9: List All Bots
echo ""
echo "9. Bot Directory"
BOTS=$(curl -s "$API_URL/api/bots")
BOT_COUNT=$(echo "$BOTS" | grep -o '"id"' | wc -l | tr -d ' ')
pass "Retrieved $BOT_COUNT bots"

# Test 10: Skill Endpoint
echo ""
echo "10. Agent Skill Endpoint"
SKILL=$(curl -s "$API_URL/api/skill")
if echo "$SKILL" | grep -q "clawloan"; then
  pass "Skill file accessible"
else
  fail "Skill file not found"
fi

# Summary
echo ""
echo "=========================="
echo -e "${GREEN}🦞 All E2E tests passed!${NC}"
echo ""
echo "Test bot ID: $BOT_ID"
echo "API URL: $API_URL"
