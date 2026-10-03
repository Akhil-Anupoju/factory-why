from __future__ import annotations
from dataclasses import dataclass
import os


@dataclass
class Settings:
    gcp_project: str = None
    firestore_db: str = None
    bigquery_dataset: str = None
    bigquery_table: str = None
    gcs_bucket: str = None
    region: str = None
    runtime_mode: str = None

    def __init__(
        self,
        gcp_project: str | None = None,
        firestore_db: str | None = None,
        bigquery_dataset: str | None = None,
        bigquery_table: str | None = None,
        gcs_bucket: str | None = None,
        region: str | None = None,
        runtime_mode: str | None = None,
    ) -> None:
        self.gcp_project = gcp_project or os.getenv("GCP_PROJECT", "factory-why-hackathon")
        self.firestore_db = firestore_db or os.getenv("FIRESTORE_DB", "(default)")
        self.bigquery_dataset = bigquery_dataset or os.getenv("BIGQUERY_DATASET", "factory_why")
        self.bigquery_table = bigquery_table or os.getenv("BIGQUERY_TABLE", "telemetry_raw")
        self.gcs_bucket = gcs_bucket or os.getenv("GCS_BUCKET", "factory-why-hackathon-artifacts")
        self.region = region or os.getenv("GCP_REGION", "asia-south1")
        self.runtime_mode = (runtime_mode or os.getenv("RUNTIME_MODE", "LOCAL")).upper()


def get_settings() -> Settings:
    return Settings()
