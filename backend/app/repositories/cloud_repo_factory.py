from __future__ import annotations
from typing import Tuple

try:
    from google.cloud import firestore, bigquery, storage
except Exception:
    firestore = bigquery = storage = None  # type: ignore

from .firestore_repo import FirestoreIncidentRepo, FirestoreEvidenceRepo, FirestoreAuditRepo
from .bigquery_repo import BigQueryTelemetryRepo
from .storage_repo import GCSStorageRepo


def create_cloud_repos(project: str, bigquery_dataset: str, bigquery_table: str, gcs_bucket: str) -> Tuple:
    if firestore is None or bigquery is None or storage is None:
        raise RuntimeError("Cloud repositories require google-cloud packages to be installed and available in the runtime.")

    fs_client = firestore.Client(project=project)
    bq_client = bigquery.Client(project=project)
    storage_client = storage.Client(project=project)

    inc_repo = FirestoreIncidentRepo(fs_client)
    ev_repo = FirestoreEvidenceRepo(fs_client)
    au_repo = FirestoreAuditRepo(fs_client)
    te_repo = BigQueryTelemetryRepo(bq_client, dataset=bigquery_dataset, table=bigquery_table)
    st_repo = GCSStorageRepo(storage_client, bucket_name=gcs_bucket)

    return inc_repo, ev_repo, au_repo, te_repo, st_repo
