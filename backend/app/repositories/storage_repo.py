from __future__ import annotations
from typing import Dict, Any, List, Optional
try:
    from google.cloud import storage

    class GCSStorageRepo:
        def __init__(self, client: storage.Client, bucket_name: str):
            self.client = client
            self.bucket = client.bucket(bucket_name)

        def get_metadata(self, path: str) -> Optional[Dict[str, Any]]:
            blob = self.bucket.blob(path)
            if not blob.exists():
                return None
            return {
                "name": blob.name,
                "size": blob.size,
                "content_type": blob.content_type,
                "updated": blob.updated.isoformat() if blob.updated else None,
            }

        def list_objects(self, prefix: str) -> List[Dict[str, Any]]:
            blobs = self.client.list_blobs(self.bucket, prefix=prefix)
            out = []
            for b in blobs:
                out.append({"name": b.name, "size": b.size, "content_type": b.content_type})
            return out
except Exception:
    class GCSStorageRepo:
        def __init__(self, *args, **kwargs):
            raise RuntimeError("GCSStorageRepo requires google-cloud-storage package")
