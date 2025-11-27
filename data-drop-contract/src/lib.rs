use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap};
use near_sdk::{
    env, log, near_bindgen, require, AccountId, Allowance, Gas, NearToken, PanicOnDefault,
    Promise, PublicKey,
};

const CALLBACK_GAS: Gas = Gas::from_tgas(100);
pub const ACCESS_KEY_METHODS: &str = "claim";
pub const ACCESS_KEY_ALLOWANCE: NearToken = NearToken::from_near(1);

/// Data Drop structure
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, Clone)]
pub struct Drop {
    /// List of access keys associated with this drop
    keys: Vec<String>,
    /// Encrypted data or content identifier (optional)
    data_cid: Option<String>,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct DataDropContract {
    /// Owner of the contract
    pub owner_id: AccountId,
    /// Next drop ID counter
    pub drop_id: u128,
    /// Map of drop ID to Drop
    pub drop_by_id: UnorderedMap<u128, Drop>,
    /// Map of access key to drop ID
    pub drop_by_key: LookupMap<String, u128>,
    /// Map of data ID to CID (for off-chain data storage)
    pub records: UnorderedMap<String, String>,
}

#[near_bindgen]
impl DataDropContract {
    /// Initialize the contract
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            drop_id: 0,
            drop_by_id: UnorderedMap::new(b"a"),
            drop_by_key: LookupMap::new(b"b"),
            records: UnorderedMap::new(b"r"),
        }
    }

    // Owner methods

    /// Add a new data drop and store data CID
    /// @param data_id Unique identifier for the data
    /// @param cid IPFS Content Identifier
    #[payable]
    pub fn add_drop(
        &mut self,
        data_id: String,
        cid: String,
    ) -> u128 {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can add drop");
        require!(!cid.is_empty(), "CID cannot be empty");
        
        self.drop_id += 1;
        let drop = Drop {
            keys: vec![],
            data_cid: Some(cid.clone()),
        };
        
        self.drop_by_id.insert(&self.drop_id, &drop);
        
        // Store data CID mapping
        self.records.insert(&data_id, &cid);
        
        let account_id = env::predecessor_account_id();
        log!("Drop added: ID={}, data_id={}, cid={}", 
             self.drop_id, data_id, cid);
        log!("DATA_STORED: Account '{}' stored CID '{}' for ID '{}'", account_id, cid, data_id);
        
        self.drop_id
    }

    /// Remove a drop and all associated keys
    pub fn remove_drop(&mut self, drop_id: u128) {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can remove drop");

        let drop = self.drop_by_id.get(&drop_id).expect("Drop not found");
        let promise = env::promise_batch_create(&env::current_account_id());
        
        // Delete all access keys associated with this drop
        for key in &drop.keys {
            let pk: PublicKey = key.parse().expect("Invalid public key");
            env::promise_batch_action_delete_key(promise, &pk);
        }

        self.drop_by_id.remove(&drop_id);
        
        log!("Drop removed: ID={}", drop_id);
    }

    /// Add an access key to a drop
    /// This creates a limited access key that can only call the claim method
    pub fn add_drop_key(&mut self, drop_id: u128, key: String) {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can add key");

        // Check if key already exists
        if self.drop_by_key.get(&key).is_some() {
            log!("Key already exists: {}", key);
            return;
        }

        // Add key to drop
        let mut drop = self.drop_by_id.get(&drop_id).expect("Drop not found").clone();
        drop.keys.push(key.clone());
        self.drop_by_id.insert(&drop_id, &drop);

        // Map key to drop ID
        self.drop_by_key.insert(&key, &drop_id);

        // Create limited access key
        let pk: PublicKey = key.parse().expect("Invalid public key");
        Promise::new(env::current_account_id())
            .delete_key(pk.clone())
            .then(
                Promise::new(env::current_account_id()).add_access_key_allowance(
                    pk,
                    Allowance::limited(ACCESS_KEY_ALLOWANCE).expect("Failed to create allowance"),
                    env::current_account_id(),
                    ACCESS_KEY_METHODS.to_string(),
                ),
            );
        
        log!("Key added to drop: ID={}, key={}", drop_id, key);
    }

    /// Remove a key from a drop
    pub fn remove_key(&mut self, key: String) {
        require!(env::predecessor_account_id() == self.owner_id, "Only owner can remove key");
        self.remove_key_internal(key);
    }

    /// Claim the data drop and get data CID
    /// This method can only be called by the access key associated with the drop
    /// @param data_id Data ID to retrieve CID for
    /// @return Data CID string
    pub fn claim(
        &mut self,
        data_id: String,
    ) -> String {
        let key = String::from(&env::signer_account_pk());
        let drop_id = self.drop_by_key.get(&key).expect("Key not found");
        let _drop = self.drop_by_id.get(&drop_id).expect("Drop not found");

        // Get data CID
        let cid = self.records
            .get(&data_id)
            .unwrap_or_else(|| format!("CID not found for ID: {}", data_id));

        log!("Claiming drop: ID={}, data_id={}, cid={}", 
             drop_id, data_id, cid);

        // Remove the key after claiming to prevent double spending
        self.remove_key_internal(key);

        // Return CID
        cid
    }


    // Internal methods

    /// Internal method to remove a key
    fn remove_key_internal(&mut self, key: String) {
        let drop_id_option = self.drop_by_key.get(&key);
        if drop_id_option.is_none() {
            return;
        }

        let drop_id = drop_id_option.unwrap();
        let mut drop = self.drop_by_id.get(&drop_id).expect("Drop not found").clone();
        
        // Remove key from drop's keys list
        drop.keys.retain(|s| s != &key);
        self.drop_by_id.insert(&drop_id, &drop);

        // Remove key from lookup map
        self.drop_by_key.remove(&key);

        // Delete the access key
        let pk: PublicKey = key.parse().expect("Invalid public key");
        Promise::new(env::current_account_id()).delete_key(pk);
        
        log!("Key removed: drop_id={}, key={}", drop_id, key);
    }

    // View methods

    /// Get all drop IDs
    pub fn get_drops(&self) -> Vec<u128> {
        self.drop_by_id.keys().collect()
    }

    /// Get keys for a specific drop
    pub fn get_keys(&self, drop_id: u128) -> Vec<String> {
        let drop = self.drop_by_id.get(&drop_id).expect("Drop not found");
        drop.keys.clone()
    }

    /// Get drop details
    pub fn get_drop(&self, drop_id: u128) -> Option<Drop> {
        self.drop_by_id.get(&drop_id)
    }
}

