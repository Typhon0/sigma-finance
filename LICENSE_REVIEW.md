# Market Data License Review

Date: 2026-05-12  
Scope: SigmaFinance market-data pack build and distribution policy

## Reviewed Sources

### Binance Public Data

- Status: reviewed candidate for public crypto daily pack.
- Current policy file: `packs/licenses/binance-public-data.yaml`
- Notes:
  - Re-check terms before each public release cycle.
  - Confirm terms apply to data archives, not only tooling/docs.

### ECB Statistics

- Status: reviewed candidate for public FX daily pack.
- Current policy file: `packs/licenses/ecb-statistics.yaml`
- Notes:
  - Derived pairs must be clearly marked as derived.
  - Attribution requirements must be preserved in metadata/docs.

## Blocked or Local-Only Sources

### Yahoo Finance

- Status: blocked for public redistribution.
- Policy file: `packs/licenses/yahoo-finance.yaml`
- `redistribution_allowed=false`

### EODHD

- Status: local-only unless written redistribution approval exists.
- Policy file: `packs/licenses/eodhd-local-only.yaml`
- `redistribution_allowed=false`

### Other Stock Providers

- Default status: local-only until explicit written redistribution license is documented.

## Hard Rule

No explicit redistribution license means no public pack.
