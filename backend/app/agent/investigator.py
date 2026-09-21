import logging
from app.agent.tools import fraud_tools
from app.agent.schemas import AgentInvestigationOutput

logger = logging.getLogger(__name__)

class FraudInvestigatorAgent:
    """
    Core Fraud Investigation Agent Orchestrator.
    Handles step-by-step evidence collection, policy evaluation, and result generation.
    """

    async def investigate_case(self, case_id: str) -> AgentInvestigationOutput:
        """
        Main execution workflow for fraud case investigation.
        """
        logger.info(f"Agent starting investigation for case_id: {case_id}")

        # Step 1 & 2: Query TigerGraph and retrieve sub-graph data
        graph_data = await fraud_tools.fetch_graph_evidence(case_id)

        # Step 3: Collect and extract structured fraud evidence items
        evidence_items = fraud_tools.extract_evidence_items(graph_data)

        # Step 4 & 5: Apply fraud policy evaluation rules
        policy_evaluations = fraud_tools.evaluate_policies(evidence_items)

        # Calculate preliminary metrics based on triggered policies (placeholder logic for foundation)
        triggered_high = [p for p in policy_evaluations if p.triggered and p.severity == "HIGH"]
        triggered_medium = [p for p in policy_evaluations if p.triggered and p.severity == "MEDIUM"]

        if len(triggered_high) >= 2:
            verdict = "DECLINED"
            fraud_prob = 0.94
            pattern = "High-Risk Network & Multi-Device Fraud"
            summary = "Multiple high-severity risk policies triggered including linked historical fraud cases and suspicious device fingerprint."
        elif len(triggered_high) == 1 or len(triggered_medium) >= 1:
            verdict = "NEEDS_REVIEW"
            fraud_prob = 0.68
            pattern = "Suspicious Device Mismatch"
            summary = "Moderate risk signals detected. Requires senior fraud analyst manual review."
        else:
            verdict = "APPROVED"
            fraud_prob = 0.12
            pattern = "Standard Consumer Transaction"
            summary = "Low risk signals across graph entities. Transaction verified against historical pattern."

        # Step 6: Return structured investigation result
        return AgentInvestigationOutput(
            case_id=case_id,
            verdict=verdict,
            fraud_probability=fraud_prob,
            pattern=pattern,
            exposure=4340.50,
            reasoning_summary=summary,
            policies_evaluated=policy_evaluations,
            collected_evidence=evidence_items
        )

investigator_agent = FraudInvestigatorAgent()
