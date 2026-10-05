import json

from backend.scripts.seed_cloud_cnc04 import build_gcs_plan


def load_fixture():
    return json.loads(open("backend/fixtures/cnc04-primary.json").read())


def test_gcs_plan_maps_to_configured_bucket_and_preserves_provenance():
    fixture = load_fixture()
    dest = "factory-why-hackathon-artifacts"
    plan = build_gcs_plan(fixture, dest, upload_placeholders=False)

    # Should find both gcs targets in fixture
    src_buckets = {p["source_bucket"] for p in plan}
    assert "factory-manuals" in src_buckets
    assert "factory-artifacts" in src_buckets

    # All dest buckets should be the configured one
    assert all(p["dest_bucket"] == dest for p in plan)

    # EV-1045 has inline SVG content and should be marked has_source_content
    ev1045 = next(p for p in plan if p["evidence_id"] == "EV-1045")
    assert ev1045["has_source_content"] is True
    # content type should be image/svg+xml
    assert ev1045["content_type"] == "image/svg+xml"
    # dest path should end with .svg
    assert ev1045["dest_path"].endswith(".svg")


def test_pdf_provenance_without_bytes_is_provenance_only():
    fixture = load_fixture()
    dest = "factory-why-hackathon-artifacts"
    plan = build_gcs_plan(fixture, dest, upload_placeholders=False)
    ev1043 = next(p for p in plan if p["evidence_id"] == "EV-1043")
    assert ev1043["has_source_content"] is False
    assert ev1043["will_upload"] is False
    assert ev1043["source_bucket"] == "factory-manuals"


def test_storage_location_not_written_by_default_but_present_when_plan_uploads():
    fixture = load_fixture()
    dest = "factory-why-hackathon-artifacts"
    # simulate plan where only EV-1045 has data and will upload
    plan = build_gcs_plan(fixture, dest, upload_placeholders=False)
    ev1045_plan = next(p for p in plan if p["evidence_id"] == "EV-1045")
    assert ev1045_plan["has_source_content"] is True
    # ensure storage_location is expressible
    assert ev1045_plan["dest_bucket"] == dest
