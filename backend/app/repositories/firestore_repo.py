from __future__ import annotations
from typing import Dict, Any, List, Optional
try:
    from google.cloud import firestore


    class FirestoreIncidentRepo:
        def __init__(self, client: firestore.Client):
            self.client = client

        def get_incident(self, incident_id: str) -> Optional[Dict[str, Any]]:
            doc = self.client.collection("incidents").document(incident_id).get()
            if not doc.exists:
                return None
            return doc.to_dict()

        def upsert_incident(self, incident: Dict[str, Any]) -> None:
            self.client.collection("incidents").document(incident["incident_id"]).set(incident)

        def list_incidents(self) -> List[Dict[str, Any]]:
            docs = self.client.collection("incidents").stream()
            return [d.to_dict() for d in docs]


    class FirestoreEvidenceRepo:
        def __init__(self, client: firestore.Client):
            self.client = client

        def list_evidence(self, incident_id: str) -> List[Dict[str, Any]]:
            col = self.client.collection("incidents").document(incident_id).collection("evidence")
            docs = col.stream()
            return [d.to_dict() for d in docs]

        def get_evidence(self, incident_id: str, evidence_id: str) -> Optional[Dict[str, Any]]:
            doc = self.client.collection("incidents").document(incident_id).collection("evidence").document(evidence_id).get()
            if not doc.exists:
                return None
            return doc.to_dict()

        def upsert_evidence(self, incident_id: str, evidence: Dict[str, Any]) -> None:
            self.client.collection("incidents").document(incident_id).collection("evidence").document(evidence["evidence_id"]).set(evidence)


    class FirestoreAuditRepo:
        def __init__(self, client: firestore.Client):
            self.client = client

        def list_audit(self, incident_id: str) -> List[Dict[str, Any]]:
            col = self.client.collection("incidents").document(incident_id).collection("audit")
            docs = col.stream()
            return [d.to_dict() for d in docs]

        def append_audit(self, incident_id: str, event: Dict[str, Any]) -> None:
            # Use auto-id to append
            self.client.collection("incidents").document(incident_id).collection("audit").add(event)

except Exception:
    # google-cloud-firestore not installed; provide placeholder classes that
    # raise on construction to avoid accidental cloud client creation at import
    class FirestoreIncidentRepo:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("FirestoreIncidentRepo requires google-cloud-firestore package")

    class FirestoreEvidenceRepo:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("FirestoreEvidenceRepo requires google-cloud-firestore package")

    class FirestoreAuditRepo:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("FirestoreAuditRepo requires google-cloud-firestore package")
