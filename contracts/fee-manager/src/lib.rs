#![no_std]
use soroban_sdk::{contract, contractimpl, Symbol, Env, Address, Error};

const VERSION: &str = "1.0.0";
const PAUSED_KEY: &str = "paused";
const ADMIN_KEY: &str = "admin";

#[contract]
pub struct FeeManagerContract;

#[contractimpl]
impl FeeManagerContract {
    pub fn init(env: Env, admin: Address) {
        admin.require_auth();
        env.storage().instance().set(&Symbol::new(&env, ADMIN_KEY), &admin);
        env.storage().instance().set(&Symbol::new(&env, PAUSED_KEY), &false);
    }

    pub fn version(env: Env) -> String {
        String::from_slice(&env, VERSION.as_bytes())
    }

    pub fn pause(env: Env, reason: String) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, ADMIN_KEY))
            .ok_or(Error::InvalidInput)?;
        admin.require_auth();

        env.storage().instance().set(&Symbol::new(&env, PAUSED_KEY), &true);
        env.events().publish((Symbol::new(&env, "pause"), reason), ());
        Ok(())
    }

    pub fn unpause(env: Env) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, ADMIN_KEY))
            .ok_or(Error::InvalidInput)?;
        admin.require_auth();

        env.storage().instance().set(&Symbol::new(&env, PAUSED_KEY), &false);
        env.events().publish((Symbol::new(&env, "unpause"),), ());
        Ok(())
    }

    pub fn is_paused(env: Env) -> bool {
        env.storage().instance().get(&Symbol::new(&env, PAUSED_KEY))
            .unwrap_or(false)
    }

    pub fn calculate_fee(env: Env, amount: i128, fee_rate: u32) -> Result<i128, Error> {
        if Self::is_paused(env.clone()) {
            return Err(Error::InvalidInput);
        }
        let fee = (amount as u128 * fee_rate as u128 / 10000) as i128;
        env.events().publish((Symbol::new(&env, "fee_calculated"),), fee);
        Ok(fee)
    }

    pub fn migrate(env: Env, new_version: String) -> Result<(), Error> {
        let admin: Address = env.storage().instance().get(&Symbol::new(&env, ADMIN_KEY))
            .ok_or(Error::InvalidInput)?;
        admin.require_auth();

        env.events().publish((Symbol::new(&env, "migrate"), new_version), ());
        Ok(())
    }
}
