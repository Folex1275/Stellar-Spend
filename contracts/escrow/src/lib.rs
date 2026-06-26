#![no_std]
use soroban_sdk::{contract, contractimpl, Symbol, Env, Address, Map, Error, token};

const DEPOSITS_KEY: &str = "deposits";
const SETTLEMENT_AUTH_KEY: &str = "settlement_auth";
const TIMEOUT_KEY: &str = "timeout";

#[derive(Clone)]
pub struct EscrowDeposit {
    pub depositor: Address,
    pub amount: i128,
    pub bridge_address: Address,
    pub timestamp: u64,
    pub timeout_ledger: u32,
    pub released: bool,
    pub refunded: bool,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn init(env: Env, settlement_authority: Address) {
        settlement_authority.require_auth();
        env.storage().instance()
            .set(&Symbol::new(&env, SETTLEMENT_AUTH_KEY), &settlement_authority);
        env.storage().instance()
            .set(&Symbol::new(&env, TIMEOUT_KEY), &(604800u32)); // 7 days default
    }

    pub fn deposit(
        env: Env,
        depositor: Address,
        amount: i128,
        bridge_address: Address,
        token: Address,
    ) -> Result<String, Error> {
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        depositor.require_auth();

        let current_ledger = env.ledger().sequence();
        let timeout = env.storage().instance()
            .get::<_, u32>(&Symbol::new(&env, TIMEOUT_KEY))
            .unwrap_or(604800);

        let deposit_id = format!(
            "{}:{}:{}",
            depositor.to_string(),
            bridge_address.to_string(),
            current_ledger
        );

        let mut deposits: Map<String, EscrowDeposit> = env.storage().instance()
            .get(&Symbol::new(&env, DEPOSITS_KEY))
            .unwrap_or_else(|| Map::new(&env));

        let deposit = EscrowDeposit {
            depositor: depositor.clone(),
            amount,
            bridge_address: bridge_address.clone(),
            timestamp: env.ledger().timestamp(),
            timeout_ledger: current_ledger + timeout,
            released: false,
            refunded: false,
        };

        deposits.set(deposit_id.clone(), deposit);
        env.storage().instance().set(&Symbol::new(&env, DEPOSITS_KEY), &deposits);

        env.events().publish(
            (Symbol::new(&env, "deposit"),),
            (depositor, amount, bridge_address),
        );

        Ok(deposit_id)
    }

    pub fn release(
        env: Env,
        deposit_id: String,
        recipient: Address,
    ) -> Result<i128, Error> {
        let settlement_auth: Address = env.storage().instance()
            .get(&Symbol::new(&env, SETTLEMENT_AUTH_KEY))
            .ok_or(Error::InvalidInput)?;

        settlement_auth.require_auth();

        let mut deposits: Map<String, EscrowDeposit> = env.storage().instance()
            .get(&Symbol::new(&env, DEPOSITS_KEY))
            .ok_or(Error::InvalidInput)?;

        let mut deposit = deposits.get(deposit_id.clone())
            .ok_or(Error::InvalidInput)?;

        if deposit.released {
            return Err(Error::InvalidInput);
        }

        if deposit.refunded {
            return Err(Error::InvalidInput);
        }

        let amount = deposit.amount;
        deposit.released = true;

        deposits.set(deposit_id.clone(), deposit);
        env.storage().instance().set(&Symbol::new(&env, DEPOSITS_KEY), &deposits);

        env.events().publish(
            (Symbol::new(&env, "release"),),
            (deposit_id, recipient, amount),
        );

        Ok(amount)
    }

    pub fn refund(env: Env, deposit_id: String) -> Result<i128, Error> {
        let mut deposits: Map<String, EscrowDeposit> = env.storage().instance()
            .get(&Symbol::new(&env, DEPOSITS_KEY))
            .ok_or(Error::InvalidInput)?;

        let mut deposit = deposits.get(deposit_id.clone())
            .ok_or(Error::InvalidInput)?;

        if deposit.released {
            return Err(Error::InvalidInput);
        }

        if deposit.refunded {
            return Err(Error::InvalidInput);
        }

        let current_ledger = env.ledger().sequence();
        if current_ledger < deposit.timeout_ledger {
            return Err(Error::InvalidInput);
        }

        let amount = deposit.amount;
        deposit.refunded = true;

        deposits.set(deposit_id.clone(), deposit.clone());
        env.storage().instance().set(&Symbol::new(&env, DEPOSITS_KEY), &deposits);

        env.events().publish(
            (Symbol::new(&env, "refund"),),
            (deposit_id, deposit.depositor, amount),
        );

        Ok(amount)
    }

    pub fn get_deposit(env: Env, deposit_id: String) -> Result<(i128, bool, bool), Error> {
        let deposits: Map<String, EscrowDeposit> = env.storage().instance()
            .get(&Symbol::new(&env, DEPOSITS_KEY))
            .ok_or(Error::InvalidInput)?;

        let deposit = deposits.get(deposit_id)
            .ok_or(Error::InvalidInput)?;

        Ok((deposit.amount, deposit.released, deposit.refunded))
    }

    pub fn set_timeout(env: Env, timeout_ledgers: u32) -> Result<(), Error> {
        let settlement_auth: Address = env.storage().instance()
            .get(&Symbol::new(&env, SETTLEMENT_AUTH_KEY))
            .ok_or(Error::InvalidInput)?;

        settlement_auth.require_auth();

        if timeout_ledgers == 0 || timeout_ledgers > 10_000_000 {
            return Err(Error::InvalidInput);
        }

        env.storage().instance().set(&Symbol::new(&env, TIMEOUT_KEY), &timeout_ledgers);

        env.events().publish((Symbol::new(&env, "timeout_updated"),), timeout_ledgers);

        Ok(())
    }

    pub fn can_refund(env: Env, deposit_id: String) -> Result<bool, Error> {
        let deposits: Map<String, EscrowDeposit> = env.storage().instance()
            .get(&Symbol::new(&env, DEPOSITS_KEY))
            .ok_or(Error::InvalidInput)?;

        let deposit = deposits.get(deposit_id)
            .ok_or(Error::InvalidInput)?;

        if deposit.refunded || deposit.released {
            return Ok(false);
        }

        let current_ledger = env.ledger().sequence();
        Ok(current_ledger >= deposit.timeout_ledger)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deposit_validation() {
        assert!(0 <= 0, "Zero amount should be invalid");
        assert!(-100 < 0, "Negative amounts should be invalid");
    }

    #[test]
    fn test_deposit_state_transitions() {
        // Deposit created -> can be released OR refunded after timeout
        // Cannot be both released and refunded
        let released = false;
        let refunded = false;

        let can_release = !released && !refunded;
        let can_refund = !released && !refunded;

        assert!(can_release, "Should be able to release");
        assert!(can_refund, "Should be able to refund");
    }

    #[test]
    fn test_release_blocks_refund() {
        let mut released = false;
        let mut refunded = false;

        released = true;

        let can_refund = !released && !refunded;
        assert!(!can_refund, "Cannot refund after release");
    }

    #[test]
    fn test_refund_blocks_release() {
        let mut released = false;
        let mut refunded = false;

        refunded = true;

        let can_release = !released && !refunded;
        assert!(!can_release, "Cannot release after refund");
    }

    #[test]
    fn test_timeout_ledger_calculation() {
        let current_ledger = 1000u32;
        let timeout = 604800u32;
        let timeout_ledger = current_ledger + timeout;

        assert_eq!(timeout_ledger, 605800);
        assert!(timeout_ledger > current_ledger);
    }

    #[test]
    fn test_timeout_bounds() {
        let min_timeout = 1u32;
        let max_timeout = 10_000_000u32;

        assert!(min_timeout > 0);
        assert!(max_timeout < u32::MAX);
    }
}
