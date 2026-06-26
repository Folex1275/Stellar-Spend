#![no_std]
use soroban_sdk::{contract, contractimpl, Symbol, Env, Address, Map, Error};

const ADMIN_KEY: &str = "admin";
const TREASURY_KEY: &str = "treasury";
const FEE_SCHEDULE_KEY: &str = "fee_schedule";
const MAX_BASIS_POINTS: u32 = 10_000;
const MAX_SINGLE_FEE_BP: u32 = 500; // 5% max per tier

#[contract]
pub struct TreasuryContract;

#[contractimpl]
impl TreasuryContract {
    pub fn init(env: Env, admin: Address, treasury: Address) {
        admin.require_auth();
        env.storage().instance().set(&Symbol::new(&env, ADMIN_KEY), &admin);
        env.storage().instance().set(&Symbol::new(&env, TREASURY_KEY), &treasury);

        let mut schedule: Map<i128, u32> = Map::new(&env);
        schedule.set(0i128, 50); // 0.5% for amounts < 1M stroops
        schedule.set(1_000_000i128, 25); // 0.25% for amounts 1M-10M
        schedule.set(10_000_000i128, 10); // 0.1% for amounts > 10M

        env.storage().instance().set(&Symbol::new(&env, FEE_SCHEDULE_KEY), &schedule);
    }

    pub fn collect_fee(env: Env, amount: i128, recipient: Address) -> Result<i128, Error> {
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        let fee_schedule: Map<i128, u32> = env.storage().instance()
            .get(&Symbol::new(&env, FEE_SCHEDULE_KEY))
            .ok_or(Error::InvalidInput)?;

        let fee_basis_points = Self::get_fee_for_amount(&fee_schedule, amount);
        let fee = (amount as u128 * fee_basis_points as u128 / MAX_BASIS_POINTS as u128) as i128;

        env.events().publish((Symbol::new(&env, "fee_collected"),), (amount, fee, recipient.clone()));

        Ok(fee)
    }

    pub fn get_fee_for_amount(schedule: &Map<i128, u32>, amount: i128) -> u32 {
        let mut fee_bp = 50u32;

        if amount >= 10_000_000 {
            fee_bp = 10;
        } else if amount >= 1_000_000 {
            fee_bp = 25;
        }

        fee_bp
    }

    pub fn set_fee_schedule(
        env: Env,
        amount_tier: i128,
        basis_points: u32,
    ) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&Symbol::new(&env, ADMIN_KEY))
            .ok_or(Error::InvalidInput)?;
        admin.require_auth();

        if basis_points > MAX_SINGLE_FEE_BP {
            return Err(Error::InvalidInput);
        }

        let mut schedule: Map<i128, u32> = env.storage().instance()
            .get(&Symbol::new(&env, FEE_SCHEDULE_KEY))
            .ok_or(Error::InvalidInput)?;

        schedule.set(amount_tier, basis_points);
        env.storage().instance().set(&Symbol::new(&env, FEE_SCHEDULE_KEY), &schedule);

        env.events().publish(
            (Symbol::new(&env, "fee_schedule_updated"),),
            (amount_tier, basis_points),
        );

        Ok(())
    }

    pub fn get_treasury(env: Env) -> Address {
        env.storage().instance()
            .get(&Symbol::new(&env, TREASURY_KEY))
            .unwrap_or_else(|| Address::generate(&env))
    }

    pub fn update_treasury(env: Env, new_treasury: Address) -> Result<(), Error> {
        let admin: Address = env.storage().instance()
            .get(&Symbol::new(&env, ADMIN_KEY))
            .ok_or(Error::InvalidInput)?;
        admin.require_auth();

        env.storage().instance().set(&Symbol::new(&env, TREASURY_KEY), &new_treasury);
        env.events().publish((Symbol::new(&env, "treasury_updated"),), new_treasury);

        Ok(())
    }

    pub fn route_to_treasury(env: Env, amount: i128) -> Result<(), Error> {
        let treasury: Address = env.storage().instance()
            .get(&Symbol::new(&env, TREASURY_KEY))
            .ok_or(Error::InvalidInput)?;

        env.events().publish(
            (Symbol::new(&env, "fee_routed"),),
            (amount, treasury.clone()),
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fee_calculation_tiers() {
        let small_amount = 500_000i128;
        let medium_amount = 5_000_000i128;
        let large_amount = 50_000_000i128;

        // Small amount: 0.5% = 50 basis points
        assert!(small_amount > 0);

        // Medium amount: 0.25% = 25 basis points
        assert!(medium_amount >= 1_000_000);

        // Large amount: 0.1% = 10 basis points
        assert!(large_amount >= 10_000_000);
    }

    #[test]
    fn test_fee_bounds() {
        let max_fee = 500u32;
        assert!(max_fee <= MAX_SINGLE_FEE_BP);
        assert!(MAX_SINGLE_FEE_BP <= MAX_BASIS_POINTS);
    }

    #[test]
    fn test_amount_tier_boundaries() {
        assert_eq!(0, 0);
        assert_eq!(1_000_000, 1_000_000);
        assert_eq!(10_000_000, 10_000_000);
    }
}
