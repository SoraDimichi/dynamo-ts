# DynamoDB Transactional Wallet

**Robust transaction and balance management functions for a digital wallet system built on DynamoDB and TypeScript.**

## Balance Reader (`getUserBalance`)

The `getUserBalance` function fetches the current balance for a user:

- Returns the `balance` if found.
- If not found, returns a **default balance of 100**.
- Throws an error if the user is missing or on request failure.

## Transaction Function (`transact`)

The `transact` function processes **debit** and **credit** transactions atomically:

- **Credits** add funds to a user's balance, creating it if it doesn't exist.
- **Debits** subtract funds, but only if the balance is sufficient and already exists.
- Returns `true` on success or throws precise errors on failure (insufficient funds or duplicate transaction).

## Getting Started

**1. Install dependencies**

```bash
npm install
```

**2. Run tests to check functionality**

```bash
npm test
```
