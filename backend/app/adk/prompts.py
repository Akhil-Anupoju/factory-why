from __future__ import annotations
import hashlib
from typing import Dict, Any, List


# Schema/version identifiers used for auditing
WHY_SCHEMA_VERSION = "why.v1"
CRITIC_SCHEMA_VERSION = "critic.v1"


WHY_PROMPT_TEMPLATE = """
SYSTEM / ROLE:
You are a domain expert WHY Agent for industrial incident investigation. Be concise and only rely on supplied information.

TASK:
Generate 2-3 competing causal hypotheses that could explain the incident. Each hypothesis must include: hypothesis_id, description, status (one of SUPPORTED|LIKELY|COMPETING|UNRESOLVED|CONTRADICTED), confidence (0.0-1.0), supporting_evidence_ids (list), counter_evidence_ids (list), missing_evidence (list), next_discriminating_check (optional string).

INCIDENT CONTEXT:
{incident_context}

OBSERVED EVIDENCE:
List each evidence item present in the EvidenceBundle with the following fields: evidence_id, source, timestamp, asset, component, observation, provenance. Do NOT include binary payloads. Use only the supplied evidence; do not invent observations or numeric values.

REQUIRED OUTPUT SCHEMA:
Return ONLY a JSON object with a single key "hypotheses" whose value is an ARRAY of 2-3 hypothesis objects matching the schema described above.

GROUNDING RULES:
- Every supporting_evidence_id and every counter_evidence_id you reference MUST be present in the supplied EvidenceBundle.
- Do NOT invent evidence IDs. If you need to reference missing evidence, put the id in missing_evidence (free text description is allowed) but do NOT assert it as observed.
- Do NOT invent numeric values; any numeric simulation values must come from a deterministic simulation provided separately and should not be fabricated.

SAFETY RULES:
- Do NOT produce explanations that rely on hidden ground truth or data not present in the EvidenceBundle.
- Do NOT issue approval or action decisions.
- Do not include any URLs or external references.

RETURN:
Return exactly the JSON object required; do not include surrounding commentary or markdown.
"""


CRITIC_PROMPT_TEMPLATE = """
SYSTEM / ROLE:
You are a domain expert Critic Agent. Your task is to evaluate an existing set of hypotheses against the supplied evidence bundle.

TASK:
Assess the leading hypothesis (or hypotheses) and produce a structured CriticFinding documenting contradictions, ignored evidence, falsification checks, most discriminating missing evidence, optional confidence revision, and an optional request_more_evidence object that uses an allowlisted tool.

INCIDENT CONTEXT:
{incident_context}

OBSERVED EVIDENCE:
As above, list evidence items: evidence_id, source, timestamp, asset, component, observation, provenance.

REQUIRED OUTPUT SCHEMA:
Return a JSON object matching the CriticOutputModel with keys: critic_id, target_hypothesis_id, contradictions (list of {point, conflicting_evidence_ids, rationale}), ignored_evidence_ids (list), falsification_check (string), most_discriminating_missing_evidence (string), confidence_revision (float|optional), request_more_evidence (optional dict with keys: tool (one of allowlisted tools), params (object)).

GROUNDING RULES:
- Any referenced evidence IDs MUST exist in the supplied EvidenceBundle.
- If you request_more_evidence, the tool MUST be one of the allowlisted tools and params MUST NOT contain arbitrary URLs or SQL statements.
- Do NOT invent evidence IDs.

SAFETY RULES:
- Do NOT make approval or action decisions.
- Do NOT include arbitrary URLs or SQL in output.
- Do NOT return credentials or access tokens.

RETURN:
Return exactly the JSON object required; do not include surrounding commentary or markdown.
"""


def compute_prompt_hash(template: str) -> str:
    """Return a deterministic sha256 hash for the given template string.

    The hash is computed over the raw template bytes (UTF-8) and returned
    as a hex string. This hash is used in audit metadata to identify the
    prompt/template version.
    """
    h = hashlib.sha256()
    h.update(template.encode("utf-8"))
    return h.hexdigest()


def render_why_prompt(incident_context: Dict[str, Any], evidence: List[Dict[str, Any]]) -> str:
    ctx = _format_incident_context(incident_context)
    ev_text = _format_evidence_list(evidence)
    return WHY_PROMPT_TEMPLATE.format(incident_context=ctx + "\n" + ev_text)


def render_critic_prompt(incident_context: Dict[str, Any], evidence: List[Dict[str, Any]], hypotheses: Any = None) -> str:
    ctx = _format_incident_context(incident_context)
    ev_text = _format_evidence_list(evidence)
    hyp_text = "\n" + ("Existing hypotheses summary: " + str(hypotheses) if hypotheses else "")
    return CRITIC_PROMPT_TEMPLATE.format(incident_context=ctx + "\n" + ev_text + hyp_text)


def _format_incident_context(incident_context: Dict[str, Any]) -> str:
    # Accept dict-like objects or pydantic BaseModel instances
    if not incident_context:
        return "(no incident context provided)"

    # If it's a pydantic model, prefer model_dump() for a plain dict
    ctx_obj = incident_context
    if hasattr(incident_context, "model_dump"):
        try:
            ctx_obj = incident_context.model_dump()
        except Exception:
            # fall back to string representation
            return str(incident_context)
    elif hasattr(incident_context, "dict") and not isinstance(incident_context, dict):
        try:
            ctx_obj = incident_context.dict()
        except Exception:
            return str(incident_context)

    if isinstance(ctx_obj, dict):
        parts = []
        for k, v in ctx_obj.items():
            parts.append(f"{k}: {v}")
        return "\n".join(parts)

    # As a last resort, attempt to use the object's __dict__ if present
    try:
        d = getattr(incident_context, "__dict__", None)
        if isinstance(d, dict):
            parts = [f"{k}: {v}" for k, v in d.items()]
            return "\n".join(parts)
    except Exception:
        pass

    # Fallback to string representation if we couldn't extract a mapping
    return str(incident_context)


def _format_evidence_list(evidence: List[Dict[str, Any]]) -> str:
    if not evidence:
        return "(no evidence supplied)"
    lines = []
    for e in evidence:
        # Only include safe metadata fields
        eid = e.get("evidence_id")
        src = e.get("source")
        ts = e.get("timestamp")
        asset = e.get("asset")
        comp = e.get("component")
        obs = e.get("observation")
        prov = e.get("provenance")
        lines.append(f"- evidence_id: {eid}; source: {src}; timestamp: {ts}; asset: {asset}; component: {comp}; observation: {obs}; provenance: {prov}")
    return "\n".join(lines)
