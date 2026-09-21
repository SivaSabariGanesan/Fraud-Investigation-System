import logging
from typing import Dict, Any, List
from app.services.tigergraph import tigergraph_service
from app.agent.schemas import AgentEvidenceItem, PolicyEvaluation

logger = logging.getLogger(__name__)

class FraudTools:
    """
    Tool suite used by the Fraud Investigator Agent for evidence collection and policy evaluation.
    """

    async def fetch_graph_evidence(self, case_id: str) -> Dict[str, Any]:
        """Tool to retrieve sub-graph evidence from TigerGraph."""
        logger.info(f"Agent Tool: Fetching graph evidence for case {case_id}")
        return await tigergraph_service.fetch_case_subgraph(case_id)

    def extract_evidence_items(self, graph_data: Dict[str, Any]) -> List[AgentEvidenceItem]:
        """Tool to parse TigerGraph entities into structured evidence items."""
        evidence = []
        entities = graph_data.get("entities", {})
        
        for entity_type, items in entities.items():
            for item in items:
                item_id = item.get("id", "UNKNOWN")
                risk_signal = None
                if entity_type == "DeviceProfile" and item.get("vpn_detected"):
                    risk_signal = "VPN/Proxy Detected"
                elif entity_type == "EmailDomain" and item.get("disposable"):
                    risk_signal = "Disposable Email Domain"
                elif entity_type == "BillingRegion" and item.get("mismatch_flag"):
                    risk_signal = "Regional Geo Mismatch"
                elif entity_type == "ClosedCase" and item.get("verdict") == "FRAUD_CONFIRMED":
                    risk_signal = "Linked to Past Confirmed Fraud"

                evidence.append(
                    AgentEvidenceItem(
                        id=item_id,
                        type=entity_type,
                        details=item,
                        risk_signal=risk_signal
                    )
                )
        return evidence

    def evaluate_policies(self, evidence: List[AgentEvidenceItem]) -> List[PolicyEvaluation]:
        """Tool to evaluate fraud risk policies on collected evidence."""
        evaluations = []
        
        # Check for linked confirmed fraud
        linked_fraud = any(e.type == "ClosedCase" and e.details.get("verdict") == "FRAUD_CONFIRMED" for e in evidence)
        evaluations.append(PolicyEvaluation(
            policy_name="LINKED_HISTORICAL_FRAUD",
            triggered=linked_fraud,
            description="Checks if card/device/customer is linked to past closed fraud cases",
            severity="HIGH"
        ))

        # Check for suspicious device/vpn
        suspicious_device = any(e.type == "DeviceProfile" and e.details.get("vpn_detected") for e in evidence)
        evaluations.append(PolicyEvaluation(
            policy_name="SUSPICIOUS_DEVICE_FINGERPRINT",
            triggered=suspicious_device,
            description="Checks for VPN/Proxy usage or high-risk device fingerprinting",
            severity="HIGH"
        ))

        # Check disposable domain
        disposable_email = any(e.type == "EmailDomain" and e.details.get("disposable") for e in evidence)
        evaluations.append(PolicyEvaluation(
            policy_name="DISPOSABLE_EMAIL_DOMAIN",
            triggered=disposable_email,
            description="Checks if transaction email belongs to disposable domain service",
            severity="MEDIUM"
        ))

        return evaluations

fraud_tools = FraudTools()
