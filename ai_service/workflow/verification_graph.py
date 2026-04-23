from langgraph.graph import StateGraph, END
from .state import AgentState
from .verification_nodes import (
    id_verification_node,
    liveness_node,
    cert_verification_node,
    scoring_node
)

def create_verification_workflow():
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("verify_id", id_verification_node)
    workflow.add_node("verify_liveness", liveness_node)
    workflow.add_node("verify_cert", cert_verification_node)
    workflow.add_node("score", scoring_node)
    
    # Define Entry Point - Start all three in parallel (conceptually in LangGraph we add edges)
    # However, to properly model parallel branches in LangGraph, we can use a fan-out.
    workflow.set_entry_point("verify_id")
    
    # Simple sequence for now (Gemini rate limits might prefer this), 
    # but the nodes are designed to be independent.
    workflow.add_edge("verify_id", "verify_liveness")
    workflow.add_edge("verify_liveness", "verify_cert")
    workflow.add_edge("verify_cert", "score")
    workflow.add_edge("score", END)
    
    return workflow.compile()

# Global Instance
verification_workflow = create_verification_workflow()
