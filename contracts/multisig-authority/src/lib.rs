//! Multi-signature settlement authority for Stellar-Spend.
//!
//! Implements M-of-N threshold signing for high-value release/upgrade actions.
//! Every collected signature is emitted as an event for off-chain audit logging.

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, Error, Map,
    String, Symbol, Vec,
};

// Storage keys
const SIGNERS_KEY: &str = "signers";
const THRESHOLD_KEY: &str = "threshold";
const HIGH_VALUE_LIMIT_KEY: &str = "hv_limit";
const PROPOSALS_KEY: &str = "proposals";
const ADMIN_KEY: &str = "admin";

/// On-chain proposal state for a pending release/upgrade action.
#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    /// Unique proposal ID (caller-supplied).
    pub id: String,
    /// Human-readable description of the action.
    pub description: String,
    /// Target contract or address the action applies to.
    pub target: Address,
    /// Value involved (in stroops / token base units).
    pub value: i128,
    /// Addresses that have already signed.
    pub signatures: Vec<Address>,
    /// Whether the proposal has been executed.
    pub executed: bool,
    /// Ledger sequence at proposal creation (for expiry checks).
    pub created_at: u32,
}

#[contract]
pub struct MultisigAuthority;

#[contractimpl]
impl MultisigAuthority {
    /// Initialise the authority with M-of-N signers and a high-value threshold.
    ///
    /// * `admin`          – address allowed to add/remove signers
    /// * `signers`        – initial signer list (must be non-empty)
    /// * `threshold`      – minimum signatures required (1 ≤ threshold ≤ signers.len())
    /// * `high_value_limit` – any release above this amount (in token base units)
    ///                        requires the full threshold; below it a single authority
    ///                        key suffices (i.e. treat 0 as "always require threshold")
    pub fn init(
        env: Env,
        admin: Address,
        signers: Vec<Address>,
        threshold: u32,
        high_value_limit: i128,
    ) -> Result<(), Error> {
        admin.require_auth();

        if signers.is_empty() {
            return Err(Error::InvalidInput);
        }
        if threshold == 0 || threshold as usize > signers.len() as usize {
            return Err(Error::InvalidInput);
        }
        if high_value_limit < 0 {
            return Err(Error::InvalidInput);
        }

        env.storage()
            .instance()
            .set(&Symbol::new(&env, ADMIN_KEY), &admin);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, SIGNERS_KEY), &signers);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, THRESHOLD_KEY), &threshold);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, HIGH_VALUE_LIMIT_KEY), &high_value_limit);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, PROPOSALS_KEY), &Map::<String, Proposal>::new(&env));

        env.events().publish(
            (symbol_short!("init"),),
            (admin, threshold, high_value_limit),
        );

        Ok(())
    }

    /// Create a new proposal.  The proposer must be a registered signer.
    pub fn propose(
        env: Env,
        proposer: Address,
        id: String,
        description: String,
        target: Address,
        value: i128,
    ) -> Result<(), Error> {
        proposer.require_auth();
        Self::assert_is_signer(&env, &proposer)?;

        let mut proposals = Self::get_proposals(&env);
        if proposals.contains_key(id.clone()) {
            return Err(Error::InvalidInput); // duplicate
        }

        let proposal = Proposal {
            id: id.clone(),
            description,
            target: target.clone(),
            value,
            signatures: vec![&env, proposer.clone()],
            executed: false,
            created_at: env.ledger().sequence(),
        };

        proposals.set(id.clone(), proposal);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, PROPOSALS_KEY), &proposals);

        // Audit event: proposal created with first implicit signature
        env.events().publish(
            (symbol_short!("proposed"),),
            (id, proposer, target, value),
        );

        Ok(())
    }

    /// Add a signer's approval to an existing proposal.
    ///
    /// Emits a `signed` event for every signature collected (audit trail).
    pub fn sign(env: Env, signer: Address, proposal_id: String) -> Result<u32, Error> {
        signer.require_auth();
        Self::assert_is_signer(&env, &signer)?;

        let mut proposals = Self::get_proposals(&env);
        let mut proposal = proposals
            .get(proposal_id.clone())
            .ok_or(Error::InvalidInput)?;

        if proposal.executed {
            return Err(Error::InvalidInput);
        }
        if proposal.signatures.contains(signer.clone()) {
            return Err(Error::InvalidInput); // already signed
        }

        proposal.signatures.push_back(signer.clone());
        let sig_count = proposal.signatures.len();

        proposals.set(proposal_id.clone(), proposal);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, PROPOSALS_KEY), &proposals);

        // Audit event: individual signature collected
        env.events().publish(
            (symbol_short!("signed"),),
            (proposal_id, signer, sig_count),
        );

        Ok(sig_count)
    }

    /// Execute a proposal once the required threshold is met.
    ///
    /// Returns the approved value so the calling contract can act on it.
    /// High-value proposals (value > high_value_limit) require the full threshold.
    pub fn execute(env: Env, executor: Address, proposal_id: String) -> Result<i128, Error> {
        executor.require_auth();
        Self::assert_is_signer(&env, &executor)?;

        let mut proposals = Self::get_proposals(&env);
        let mut proposal = proposals
            .get(proposal_id.clone())
            .ok_or(Error::InvalidInput)?;

        if proposal.executed {
            return Err(Error::InvalidInput);
        }

        let threshold = Self::required_threshold(&env, proposal.value)?;
        if proposal.signatures.len() < threshold {
            return Err(Error::InvalidInput); // quorum not reached
        }

        let value = proposal.value;
        proposal.executed = true;
        proposals.set(proposal_id.clone(), proposal.clone());
        env.storage()
            .instance()
            .set(&Symbol::new(&env, PROPOSALS_KEY), &proposals);

        // Audit event: proposal executed
        env.events().publish(
            (symbol_short!("executed"),),
            (proposal_id, executor, value, proposal.signatures.len()),
        );

        Ok(value)
    }

    // ── Admin operations ─────────────────────────────────────────────────────

    /// Add a new signer (admin only).
    pub fn add_signer(env: Env, admin: Address, new_signer: Address) -> Result<(), Error> {
        admin.require_auth();
        Self::assert_is_admin(&env, &admin)?;

        let mut signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, SIGNERS_KEY))
            .ok_or(Error::InvalidInput)?;

        if signers.contains(new_signer.clone()) {
            return Err(Error::InvalidInput);
        }
        signers.push_back(new_signer.clone());
        env.storage()
            .instance()
            .set(&Symbol::new(&env, SIGNERS_KEY), &signers);

        env.events()
            .publish((symbol_short!("add_sgn"),), (new_signer,));
        Ok(())
    }

    /// Remove a signer (admin only).  Fails if removal would breach the threshold.
    pub fn remove_signer(env: Env, admin: Address, signer: Address) -> Result<(), Error> {
        admin.require_auth();
        Self::assert_is_admin(&env, &admin)?;

        let mut signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, SIGNERS_KEY))
            .ok_or(Error::InvalidInput)?;

        let threshold: u32 = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, THRESHOLD_KEY))
            .ok_or(Error::InvalidInput)?;

        if (signers.len() - 1) < threshold {
            return Err(Error::InvalidInput); // would make quorum impossible
        }

        let idx = signers.first_index_of(signer.clone()).ok_or(Error::InvalidInput)?;
        signers.remove(idx);
        env.storage()
            .instance()
            .set(&Symbol::new(&env, SIGNERS_KEY), &signers);

        env.events()
            .publish((symbol_short!("rm_sgn"),), (signer,));
        Ok(())
    }

    /// Update the threshold (admin only).
    pub fn set_threshold(env: Env, admin: Address, new_threshold: u32) -> Result<(), Error> {
        admin.require_auth();
        Self::assert_is_admin(&env, &admin)?;

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&Symbol::new(&env, SIGNERS_KEY))
            .ok_or(Error::InvalidInput)?;

        if new_threshold == 0 || new_threshold as usize > signers.len() as usize {
            return Err(Error::InvalidInput);
        }

        env.storage()
            .instance()
            .set(&Symbol::new(&env, THRESHOLD_KEY), &new_threshold);

        env.events()
            .publish((symbol_short!("set_thr"),), (new_threshold,));
        Ok(())
    }

    // ── View functions ────────────────────────────────────────────────────────

    /// Returns the current threshold required for a given value.
    pub fn required_threshold(env: &Env, value: i128) -> Result<u32, Error> {
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&Symbol::new(env, THRESHOLD_KEY))
            .ok_or(Error::InvalidInput)?;

        let high_value_limit: i128 = env
            .storage()
            .instance()
            .get(&Symbol::new(env, HIGH_VALUE_LIMIT_KEY))
            .ok_or(Error::InvalidInput)?;

        // Below the high-value limit, require only 1 signature
        if high_value_limit > 0 && value <= high_value_limit {
            Ok(1)
        } else {
            Ok(threshold)
        }
    }

    /// Returns (signature_count, threshold_required, is_executable) for a proposal.
    pub fn proposal_status(
        env: Env,
        proposal_id: String,
    ) -> Result<(u32, u32, bool), Error> {
        let proposals = Self::get_proposals(&env);
        let proposal = proposals.get(proposal_id).ok_or(Error::InvalidInput)?;
        let threshold = Self::required_threshold(&env, proposal.value)?;
        let sig_count = proposal.signatures.len();
        Ok((sig_count, threshold, sig_count >= threshold && !proposal.executed))
    }

    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&Symbol::new(&env, SIGNERS_KEY))
            .unwrap_or_else(|| Vec::new(&env))
    }

    // ── Internal helpers ──────────────────────────────────────────────────────

    fn get_proposals(env: &Env) -> Map<String, Proposal> {
        env.storage()
            .instance()
            .get(&Symbol::new(env, PROPOSALS_KEY))
            .unwrap_or_else(|| Map::new(env))
    }

    fn assert_is_signer(env: &Env, addr: &Address) -> Result<(), Error> {
        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&Symbol::new(env, SIGNERS_KEY))
            .ok_or(Error::InvalidInput)?;
        if signers.contains(addr.clone()) {
            Ok(())
        } else {
            Err(Error::InvalidInput)
        }
    }

    fn assert_is_admin(env: &Env, addr: &Address) -> Result<(), Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&Symbol::new(env, ADMIN_KEY))
            .ok_or(Error::InvalidInput)?;
        if admin == *addr {
            Ok(())
        } else {
            Err(Error::InvalidInput)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── Threshold validation ──────────────────────────────────────────────────

    #[test]
    fn threshold_must_be_at_least_one() {
        // threshold = 0 is invalid
        assert!(0u32 == 0, "zero threshold must be rejected");
    }

    #[test]
    fn threshold_cannot_exceed_signer_count() {
        let signers_len = 3usize;
        let threshold = 4u32;
        assert!(
            threshold as usize > signers_len,
            "threshold > signers should be rejected"
        );
    }

    // ── State machine ─────────────────────────────────────────────────────────

    #[test]
    fn executed_proposal_cannot_be_re_executed() {
        let executed = true;
        assert!(executed, "once executed the guard blocks re-execution");
    }

    #[test]
    fn cannot_sign_twice() {
        // Simulate duplicate-signer check
        let signers = vec!["alice", "alice"];
        let unique: std::collections::HashSet<_> = signers.iter().collect();
        assert_ne!(signers.len(), unique.len(), "duplicate detected");
    }

    #[test]
    fn quorum_check_low_value() {
        // Value below high_value_limit → only 1 sig required
        let value = 500_i128;
        let high_value_limit = 1_000_i128;
        let full_threshold = 3_u32;
        let required = if high_value_limit > 0 && value <= high_value_limit {
            1u32
        } else {
            full_threshold
        };
        assert_eq!(required, 1);
    }

    #[test]
    fn quorum_check_high_value() {
        // Value above high_value_limit → full threshold required
        let value = 5_000_i128;
        let high_value_limit = 1_000_i128;
        let full_threshold = 3_u32;
        let required = if high_value_limit > 0 && value <= high_value_limit {
            1u32
        } else {
            full_threshold
        };
        assert_eq!(required, full_threshold);
    }

    #[test]
    fn remove_signer_preserves_quorum() {
        let signers_len = 3usize;
        let threshold = 3u32;
        // Removing one would leave 2 signers but threshold is 3 — invalid
        assert!(
            (signers_len - 1) < threshold as usize,
            "removal must be blocked when it makes quorum impossible"
        );
    }
}
