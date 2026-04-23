from langgraph.graph import StateGraph, END
from .state import AgentState
from .nodes import analyze_request_node, finalize_node

def create_request_workflow():
    workflow = StateGraph(AgentState)
    
    # Add Nodes
    workflow.add_node("analyze", analyze_request_node)
    workflow.add_node("finalize", finalize_node)
    
    # Set Entry Point
    workflow.set_entry_point("analyze")
    
    # Add Edges
    workflow.add_edge("analyze", "finalize")
    workflow.add_edge("finalize", END)
    
    # Compile
    return workflow.compile()

# Global Instance
request_workflow = create_request_workflow()
