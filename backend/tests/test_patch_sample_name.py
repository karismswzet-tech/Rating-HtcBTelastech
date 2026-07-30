"""Tests for inline-edit Sample name feature: PATCH /api/analyses/{id} with sample_name."""
import pytest


@pytest.fixture(scope="module")
def created_record(api_client, base_url, copper_data_url):
    r = api_client.post(f"{base_url}/api/analyze", json={
        "image_data": copper_data_url,
        "sample_name": "TEST_Initial",
        "notes": "TEST_notes_original",
    }, timeout=180)
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    # cleanup
    api_client.delete(f"{base_url}/api/analyses/{data['id']}")


class TestPatchSampleName:
    def test_patch_simple_rename(self, api_client, base_url, created_record):
        rid = created_record["id"]
        r = api_client.patch(f"{base_url}/api/analyses/{rid}", json={"sample_name": "TEST_Renamed_1"})
        assert r.status_code == 200
        d = r.json()
        assert d["sample_name"] == "TEST_Renamed_1"
        # Ensure other fields are NOT touched
        assert d["rating"] == created_record["rating"]
        assert d["category"] == created_record["category"]
        assert d["created_at"] == created_record["created_at"]
        assert d["notes"] == created_record["notes"]
        assert d["confidence"] == created_record["confidence"]
        assert d["image_data"] == created_record["image_data"]

    def test_patch_empty_string_clears(self, api_client, base_url, created_record):
        rid = created_record["id"]
        r = api_client.patch(f"{base_url}/api/analyses/{rid}", json={"sample_name": ""})
        assert r.status_code == 200
        assert r.json()["sample_name"] == ""
        # persistence
        g = api_client.get(f"{base_url}/api/analyses/{rid}").json()
        assert g["sample_name"] == ""

    def test_patch_unicode(self, api_client, base_url, created_record):
        rid = created_record["id"]
        name = "Sampel Ω-α β 中文 🧪"
        r = api_client.patch(f"{base_url}/api/analyses/{rid}", json={"sample_name": name})
        assert r.status_code == 200
        assert r.json()["sample_name"] == name
        g = api_client.get(f"{base_url}/api/analyses/{rid}").json()
        assert g["sample_name"] == name

    def test_patch_long_string(self, api_client, base_url, created_record):
        rid = created_record["id"]
        name = "TEST_" + ("x" * 500)
        r = api_client.patch(f"{base_url}/api/analyses/{rid}", json={"sample_name": name})
        assert r.status_code == 200
        assert r.json()["sample_name"] == name

    def test_search_matches_new_name(self, api_client, base_url, created_record):
        rid = created_record["id"]
        marker = "TEST_UniqueSearchable_9821"
        r = api_client.patch(f"{base_url}/api/analyses/{rid}", json={"sample_name": marker})
        assert r.status_code == 200
        # search
        s = api_client.get(f"{base_url}/api/analyses", params={"q": marker})
        assert s.status_code == 200
        items = s.json()["items"]
        assert any(i["id"] == rid for i in items), "Search should match updated sample_name"

    def test_patch_404_unknown(self, api_client, base_url):
        r = api_client.patch(f"{base_url}/api/analyses/nonexistent-id-xxx", json={"sample_name": "x"})
        assert r.status_code == 404
