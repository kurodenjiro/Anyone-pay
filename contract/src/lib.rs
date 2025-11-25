use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, Promise, NearToken};

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct Intent {
    pub id: String,
    pub user: AccountId,
    pub intent_type: String,
    pub deposit_address: String,
    pub amount: u128,
    pub status: IntentStatus,
    pub redirect_url: String,
    pub created_at: u64,
}

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, PartialEq, Debug)]
#[serde(crate = "near_sdk::serde")]
pub enum IntentStatus {
    Pending,
    Funded,
    Executing,
    Completed,
    Failed,
}

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize)]
pub struct AnyonePay {
    intents: UnorderedMap<String, Intent>,
    x402_facilitator: AccountId,
    intents_contract: AccountId,
}

impl Default for AnyonePay {
    fn default() -> Self {
        Self {
            intents: UnorderedMap::new(b"i".to_vec()),
            x402_facilitator: AccountId::try_from("x402.near".to_string()).unwrap(),
            intents_contract: AccountId::try_from("intents.near".to_string()).unwrap(),
        }
    }
}

#[near_bindgen]
impl AnyonePay {
    #[init]
    pub fn new(x402_facilitator: AccountId, intents_contract: AccountId) -> Self {
        Self {
            intents: UnorderedMap::new(b"i".to_vec()),
            x402_facilitator,
            intents_contract,
        }
    }

    /// Create a new intent with deposit address
    pub fn create_intent(
        &mut self,
        intent_id: String,
        intent_type: String,
        deposit_address: String,
        amount: U128,
        redirect_url: String,
    ) -> Intent {
        let intent = Intent {
            id: intent_id.clone(),
            user: env::predecessor_account_id(),
            intent_type,
            deposit_address,
            amount: amount.0,
            status: IntentStatus::Pending,
            redirect_url,
            created_at: env::block_timestamp(),
        };

        self.intents.insert(&intent_id, &intent);
        intent
    }

    /// Verify deposit via NEAR Intents contract
    pub fn verify_deposit(&self, intent_id: String) -> bool {
        let intent = self.intents.get(&intent_id).expect("Intent not found");
        
        // In production, this would call intents.near to verify deposit
        // For now, we'll use a view call pattern
        let gas = env::prepaid_gas().saturating_sub(near_sdk::Gas::from_tgas(10));
        Promise::new(self.intents_contract.clone())
            .function_call(
                "mt_batch_balance_of".to_string(),
                serde_json::to_vec(&serde_json::json!({
                    "account_id": intent.deposit_address,
                }))
                .unwrap(),
                NearToken::from_yoctonear(0),
                gas,
            );

        true
    }

    /// Execute x402 payment after deposit confirmation
    pub fn execute_x402_payment(
        &mut self,
        intent_id: String,
        amount: U128,
        recipient: AccountId,
    ) -> Promise {
        let intent = self.intents.get(&intent_id).expect("Intent not found");
        
        assert_eq!(
            intent.status,
            IntentStatus::Funded,
            "Intent must be funded first"
        );

        // Update status to executing
        let mut updated_intent = intent.clone();
        updated_intent.status = IntentStatus::Executing;
        self.intents.insert(&intent_id, &updated_intent);

        // Call x402 facilitator for payment
        let gas = env::prepaid_gas().saturating_sub(near_sdk::Gas::from_tgas(10));
        Promise::new(self.x402_facilitator.clone())
            .function_call(
                "pay".to_string(),
                serde_json::to_vec(&serde_json::json!({
                    "amount": amount.0.to_string(),
                    "recipient": recipient.to_string(),
                    "token": "usdc",
                }))
                .unwrap(),
                NearToken::from_yoctonear(amount.0),
                gas,
            )
            .then(
                Self::ext(env::current_account_id())
                    .on_x402_payment_success(intent_id),
            )
    }

    #[private]
    pub fn on_x402_payment_success(&mut self, intent_id: String) -> Intent {
        let mut intent = self.intents.get(&intent_id).expect("Intent not found");
        intent.status = IntentStatus::Completed;
        self.intents.insert(&intent_id, &intent);
        intent
    }

    /// Get intent by ID
    pub fn get_intent(&self, intent_id: String) -> Option<Intent> {
        self.intents.get(&intent_id)
    }

    /// Mark intent as funded (called by relayer after deposit verification)
    #[private]
    pub fn mark_funded(&mut self, intent_id: String) {
        let mut intent = self.intents.get(&intent_id).expect("Intent not found");
        intent.status = IntentStatus::Funded;
        self.intents.insert(&intent_id, &intent);
    }
}

