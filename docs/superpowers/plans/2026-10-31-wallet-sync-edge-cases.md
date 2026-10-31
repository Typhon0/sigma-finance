# Blockchain Sync Edge Cases & Financial Accounting Refinements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate edge-case discrepancies and financial accounting distortions across Solana, Bitcoin, and EVM synchronization by implementing persistent Associated Token Account (ATA) owner resolution, signed Solana native transfer and rent calculations, Bitcoin CoinJoin/PayJoin proportional fee attribution with Esplora mempool limit detection, and OP Stack L2 rollup data fee (`l1Fee`) accounting.

**Architecture:** 
1. **Solana ATA Owner Resolution & Persistence**: Maintain a thread-safe registry mapping `ata_pubkey -> (wallet_owner, mint)` populated during `getTokenAccountsByOwner` and augmented during transaction ingestion. Closed token accounts and transactions where the RPC omits `owner` resolve the true wallet authority via this mapping rather than erroneously checking `allAccountKeys[accountIndex] == address`. The mapping persists in `wallet_accounts.discovered_addresses`.
2. **Solana Signed Native Transfer & Rent Accounting**: Compute net native flow using the exact signed equation `netTransfer = (postBalance - preBalance) + fee` for fee payers. Accurately capture incoming payments to fee payers and isolate rent recovery (e.g. ~0.00203928 SOL upon ATA closure) in raw metadata.
3. **Bitcoin Collaborative Transaction Fee Allocation**: Check `totalTxInputSat > walletSpentSat`. In CoinJoin/PayJoin transactions where multiple external parties supply inputs, allocate fee proportionally (`(tx.Fee * walletSpentSat) / totalTxInputSat`) and flag `is_collaborative: true` instead of attributing 100% of the miner fee to the wallet. Detect Esplora's unpaginated 50-mempool-tx limit and record `mempool_truncated: true`.
4. **EVM EIP-1559 and OP Stack Rollup L1 Data Fees**: In Blockscout client, read `effectiveGasPrice` and parse `l1Fee` on Base and Optimism. Record `execution_fee`, `l1_data_fee`, and `total_fee` (`execution_fee + l1_data_fee`) in metadata and attribute the combined total fee to the sender.
5. **Deterministic Verification Fixtures**: Build realistic test fixtures for all 4 scenarios with real transaction payloads.

**Tech Stack:** Go 1.25, PostgreSQL, Bun ORM, `btcutil`, `golang.org/x/time/rate`, `sony/gobreaker`, Docker Compose.

**Spec:** User review feedback on PR/Architecture walkthrough (REF: conversation:d242b0f8-e0da-42f2-bd6e-c9148ff95945).

---

## Global Constraints

- **Keyless-First Zero-Cost Guarantee**: All basic sync operates at €0/month with no mandatory API keys.
- **Precision Integrity**: Preserve exact uint256 / satoshi / lamport strings in `raw_amount` and `raw_balance` (`NUMERIC(78, 0)`). Never truncate into floats.
- **Deterministic Movement Indexing**: Every transfer movement must have a deterministic `movement_index` ensuring idempotent upserts under `idx_wallet_activities_wallet_tx_mvt`.
- **Fail-Safe Balance Protection**: Provider errors, rate limits, or 429s must never overwrite valid balances with zeros.
- **Docker Production Sync**: Always rebuild and recreate the backend container (`docker compose build server && docker compose up -d server`) after backend changes.

---

## Review Focus

1. **Closed Solana Token Accounts**: When an SPL token account is closed in a transaction, RPC `postTokenBalances` omits the account and `preTokenBalances` may omit `owner`. The test must prove `knownATAs` maps `allAccountKeys[accountIndex]` to the wallet address and registers the disposal movement.
2. **Solana Fee-Payer Incoming Payment**: When the wallet is the fee payer (`accIdx == 0`) and also receives SOL, `postBalance - preBalance > 0`. The test must prove `RawAmount == (post - pre) + fee`, avoiding undercounting by the fee.
3. **CoinJoin Multi-Party Fee Distortion**: In a CoinJoin with 5 participants, total fee is 2,500 sat and wallet contributed 20% of inputs. The test must prove the wallet is charged only 500 sat fee (not 2,500 sat) and `is_collaborative` is true.
4. **OP Stack Base/Optimism L1 Data Fee**: In an OP Stack transaction on Base with 21,000 gas, 0.05 Gwei execution gas price, and 0.00001 ETH L1 data fee, the test must prove `FeeAmount` equals `execution_fee + l1_data_fee`.
5. **Esplora Mempool 50-Tx Overflow**: When mempool returns exactly 50 transactions, verify `mempool_truncated: true` is set.

---

### Task 1: Solana Token Account Owner Mapping & Closed Account Resolution

**Files:**
- Modify: `server/internal/service/sync/blockchain/solana/adapter.go`
- Test: `server/internal/service/sync/blockchain/solana/adapter_test.go`

**Interfaces:**
- Consumes: `rpcRequest`, `solanaTokenAccountItem`, `solanaTransactionResult`
- Produces:
  - `knownATAs map[string]map[string]string` in `SolanaAdapter` (`walletAddress -> ataPubkey -> mint`)
  - `RegisterKnownTokenAccount(walletAddress string, ataPubkey string, mint string)`
  - `GetKnownTokenAccounts(walletAddress string) map[string]string`
  - `LoadKnownTokenAccounts(walletAddress string, ataMap map[string]string)`

- [ ] **Step 1: Write failing unit test for closed token account with omitted RPC owner**
```go
func TestSolanaAdapter_ClosedTokenAccountWithOmittedOwner(t *testing.T) {
    // Setup SolanaAdapter with registered ATA for wallet "WalletPubkey111"
    // Mock getTransaction returning PreTokenBalances with Owner: "" and AccountIndex: 2
    // AccountKeys[2] is "ATAPubkey222", Mint is "USDC_MINT"
    // PostTokenBalances is empty (account closed)
    // Assert RawTransferMovement extracted for USDC with RawAmount matching PreTokenBalance
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `go test -v ./server/internal/service/sync/blockchain/solana/... -run TestSolanaAdapter_ClosedTokenAccountWithOmittedOwner`
Expected: FAIL (empty movements because `Owner == ""` and `AccountKeys[2] != "WalletPubkey111"`).

- [ ] **Step 3: Implement ATA registry and owner resolution in `solana/adapter.go`**
  - Add thread-safe `knownATAsMu sync.RWMutex` and `knownATAs map[string]map[string]string` to `SolanaAdapter`.
  - In `FetchBalances`, populate `knownATAs[address][item.Pubkey] = item.Account.Data.Parsed.Info.Mint` for every discovered account.
  - In `FetchTransfers`, replace `allAccountKeys[preTok.AccountIndex] == address` with:
    ```go
    ataPubkey := allAccountKeys[preTok.AccountIndex]
    isOwner := preTok.Owner == address || (preTok.Owner == "" && a.isKnownATA(address, ataPubkey))
    if isOwner && preTok.Mint != "" {
        a.RegisterKnownTokenAccount(address, ataPubkey, preTok.Mint)
    }
    ```
  - Apply the identical resolution to `PostTokenBalances` and closed account loop.

- [ ] **Step 4: Run test to verify it passes**
Run: `go test -v ./server/internal/service/sync/blockchain/solana/... -run TestSolanaAdapter_ClosedTokenAccountWithOmittedOwner`
Expected: PASS.

- [ ] **Step 5: Commit Task 1**
```bash
git add server/internal/service/sync/blockchain/solana/
git commit -m "fix(solana): resolve ATA ownership via registered ATA mapping for closed token accounts"
```

---

### Task 2: Solana Signed Native Movement & Rent Recovery Formula

**Files:**
- Modify: `server/internal/service/sync/blockchain/solana/adapter.go`
- Test: `server/internal/service/sync/blockchain/solana/adapter_test.go`

**Interfaces:**
- Consumes: `PreBalances`, `PostBalances`, `Fee`
- Produces: Signed net transfer calculation `netTransfer = (post - pre) + fee` for fee payers; rent refund detection in `RawMetadataJSON`.

- [ ] **Step 1: Write failing unit test for fee-payer receiving native SOL**
```go
func TestSolanaAdapter_FeePayerReceivingNativeSOL(t *testing.T) {
    // Fee payer (accIdx == 0) pays 5,000 lamports fee
    // PreBalance: 1,000,000, PostBalance: 2,000,000 (net gain of 1,000,000)
    // The actual external payment received was 1,000,000 + 5,000 = 1,005,000 lamports
    // Assert RawAmount == "1005000", FeeAmount == "5000"
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `go test -v ./server/internal/service/sync/blockchain/solana/... -run TestSolanaAdapter_FeePayerReceivingNativeSOL`
Expected: FAIL (returns "1000000" instead of "1005000").

- [ ] **Step 3: Implement signed net formula and rent metadata in `solana/adapter.go`**
  - Calculate `delta := post - pre` (signed).
  - For fee payer (`isFeePayer == true`):
    `netTransfer := delta + int64(fee)`
    - If `netTransfer < 0`: Net outflow. `transferAmt = uint64(-netTransfer)`.
    - If `netTransfer > 0`: Net inflow. `transferAmt = uint64(netTransfer)`. Set `ToAddress = address`, `FromAddress = ""` (or payer), `FeeAmount = feeStr`.
    - If `netTransfer == 0`: Fee-only transaction. `transferAmt = 0`, `FeeAmount = feeStr`.
  - Include `"net_transfer_lamports": netTransfer` and `"rent_recovery_detected": isClosedATA` in `RawMetadataJSON`.

- [ ] **Step 4: Run test to verify it passes**
Run: `go test -v ./server/internal/service/sync/blockchain/solana/... -run TestSolanaAdapter_FeePayerReceivingNativeSOL`
Expected: PASS.

- [ ] **Step 5: Commit Task 2**
```bash
git add server/internal/service/sync/blockchain/solana/
git commit -m "fix(solana): implement signed net native transfer formula and rent metadata"
```

---

### Task 3: Bitcoin Collaborative Transactions (CoinJoin/PayJoin) Proportional Fee Accounting & Mempool Limit

**Files:**
- Modify: `server/internal/service/sync/blockchain/bitcoin/client.go`
- Test: `server/internal/service/sync/blockchain/bitcoin/client_test.go`

**Interfaces:**
- Consumes: `tx.Vin`, `tx.Vout`, `tx.Fee`
- Produces: `isCollaborative` detection, proportional `walletFeeShare`, `mempool_truncated` warning.

- [ ] **Step 1: Write failing unit test for CoinJoin multi-party transaction**
```go
func TestBitcoinClient_CollaborativeTx_ProportionalFee(t *testing.T) {
    // Tx with 5 inputs: total input 500,000 sat, total fee 2,500 sat
    // Our wallet supplied 1 input of 100,000 sat (20% share)
    // Our wallet received 1 change output of 99,500 sat (net spent: 500 sat)
    // Assert FeeAmount == "500" (proportional 20% of 2,500), RawAmount == "0" (self-transfer/consolidation)
    // Assert metadata has is_collaborative: true
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `go test -v ./server/internal/service/sync/blockchain/bitcoin/... -run TestBitcoinClient_CollaborativeTx_ProportionalFee`
Expected: FAIL (FeeAmount is "2500" instead of "500").

- [ ] **Step 3: Implement proportional fee calculation & mempool limit handling in `bitcoin/client.go`**
  - Compute `var totalTxInputSat uint64` by summing `vin.Prevout.Value` for all inputs with non-nil `Prevout`.
  - Check `isCollaborative := totalTxInputSat > walletSpentSat`.
  - If `walletSpentSat > walletReceivedSat`:
    - `netOutflow := walletSpentSat - walletReceivedSat`
    - If `!isCollaborative && walletSpentSat == totalTxInputSat`:
      - Sole spender: `walletFee = tx.Fee`.
      - `externalAmt = netOutflow - walletFee` (if `netOutflow >= walletFee`).
    - If `isCollaborative`:
      - Proportional fee: `walletFee := (tx.Fee * walletSpentSat) / totalTxInputSat`.
      - `externalAmt := uint64(0)`
      - If `netOutflow >= walletFee`: `externalAmt = netOutflow - walletFee`.
    - Record in metadata: `is_collaborative: isCollaborative`, `total_tx_input_sat: totalTxInputSat`, `wallet_spent_sat: walletSpentSat`, `wallet_fee_sat: walletFee`.
  - In `FetchAddressTransactions`:
    - If `len(mempoolTxs) >= 50`, log warning and flag `mempool_truncated: true` in metadata.

- [ ] **Step 4: Run test to verify it passes**
Run: `go test -v ./server/internal/service/sync/blockchain/bitcoin/... -run TestBitcoinClient_CollaborativeTx_ProportionalFee`
Expected: PASS.

- [ ] **Step 5: Commit Task 3**
```bash
git add server/internal/service/sync/blockchain/bitcoin/
git commit -m "fix(bitcoin): implement proportional fee allocation for collaborative txs and mempool limit detection"
```

---

### Task 4: EVM EIP-1559 and OP Stack Rollup L1 Data Fee Accounting

**Files:**
- Modify: `server/internal/service/sync/blockchain/evm/blockscout.go`
- Test: `server/internal/service/sync/blockchain/evm/blockscout_test.go`

**Interfaces:**
- Consumes: `blockscoutTxItem` (`L1Fee`, `EffectiveGasPrice`, `GasUsed`, `GasPrice`)
- Produces: Accurate `FeeAmount = execution_fee + l1_data_fee`, JSON metadata breakdown.

- [ ] **Step 1: Write failing unit test for OP Stack L1 fee calculation**
```go
func TestBlockscoutClient_RollupL1FeeAttribution(t *testing.T) {
    // Tx on Base with GasUsed: "21000", EffectiveGasPrice: "50000000" (execution fee: 1,050,000,000,000 wei)
    // L1Fee: "10000000000000" wei (0.00001 ETH)
    // Total Fee should be 11,050,000,000,000 wei
    // Assert FeeAmount == "11050000000000"
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `go test -v ./server/internal/service/sync/blockchain/evm/... -run TestBlockscoutClient_RollupL1FeeAttribution`
Expected: FAIL (ignores `L1Fee`, reports only execution fee).

- [ ] **Step 3: Implement L1 fee and effective gas price in `evm/blockscout.go`**
  - Add `L1Fee string json:"l1Fee"` and `EffectiveGasPrice string json:"effectiveGasPrice"` to `blockscoutTxItem`.
  - In `FetchTransfers`:
    - For `txlist`, select gas price: `priceStr := tx.EffectiveGasPrice; if priceStr == "" { priceStr = tx.GasPrice }`.
    - Compute `executionFee = gasUsed * gasPrice`.
    - Parse `l1Fee` if non-empty and `> 0`.
    - `totalFee = new(big.Int).Add(executionFee, l1Fee)`.
    - Set `FeeAmount = totalFee.String()`.
    - Store `{ "execution_fee": executionFee.String(), "l1_data_fee": l1Fee.String(), "total_fee": totalFee.String() }` in `rawMeta`.

- [ ] **Step 4: Run test to verify it passes**
Run: `go test -v ./server/internal/service/sync/blockchain/evm/... -run TestBlockscoutClient_RollupL1FeeAttribution`
Expected: PASS.

- [ ] **Step 5: Commit Task 4**
```bash
git add server/internal/service/sync/blockchain/evm/
git commit -m "feat(evm): support OP Stack L1 data fees and effective gas price in Blockscout sync"
```

---

### Task 5: End-to-End Service Integration & Persistent Storage

**Files:**
- Modify: `server/internal/service/sync/blockchain/service.go`
- Modify: `server/internal/service/sync/blockchain/adapter.go`
- Test: `server/internal/service/sync/blockchain/service_test.go`

**Interfaces:**
- Consumes: `wallet_accounts.discovered_addresses`
- Produces: Persistent ATA cache in `discovered_addresses` for Solana accounts.

- [ ] **Step 1: Write unit test for Solana ATA persistence in `WalletSyncService`**
```go
func TestWalletSyncService_PersistsSolanaDiscoveredATAs(t *testing.T) {
    // When syncing a Solana account, discovered ATAs must be serialized to DiscoveredAddresses JSON
    // and reloaded on subsequent syncs so closed accounts resolve correctly across restarts.
}
```

- [ ] **Step 2: Run test to verify it fails**
Run: `go test -v ./server/internal/service/sync/blockchain/... -run TestWalletSyncService_PersistsSolanaDiscoveredATAs`
Expected: FAIL.

- [ ] **Step 3: Connect persistent ATA caching in `service.go`**
  - Define `PersistentTokenAccountProvider` interface in `adapter.go`.
  - In `service.go` `SyncWalletAccount`, when `account.Network == model.BlockchainNetworkSolana`:
    - Load cached ATAs from `account.DiscoveredAddresses` into provider.
    - After `FetchBalances`, export updated ATA registry and update `account.DiscoveredAddresses`.

- [ ] **Step 4: Run test to verify it passes**
Run: `go test -v ./server/internal/service/sync/blockchain/... -run TestWalletSyncService_PersistsSolanaDiscoveredATAs`
Expected: PASS.

- [ ] **Step 5: Commit Task 5**
```bash
git add server/internal/service/sync/blockchain/
git commit -m "feat(sync): persist discovered Solana ATAs to wallet_accounts for resilient cross-session owner resolution"
```

---

### Task 6: Full Verification, Docker Rebuild & Restart

**Files:**
- Verify: Full backend test suite
- Rebuild: `docker compose build server && docker compose up -d server`

- [ ] **Step 1: Run all backend blockchain unit tests**
Run: `go test -v ./server/internal/service/sync/blockchain/...`
Expected: PASS for all tests across solana, bitcoin, evm, alchemy, and service.

- [ ] **Step 2: Rebuild & recreate backend container**
Run: `docker compose build server && docker compose up -d server`
Expected: Container `sigma-server` builds cleanly and starts healthy.

- [ ] **Step 3: Verify container health**
Run: `docker compose ps`
Expected: `sigma-server` status `Up (healthy)`.

- [ ] **Step 4: Update walkthrough artifact**
Document resolved edge cases, test outputs, and verified execution in `walkthrough.md`.

