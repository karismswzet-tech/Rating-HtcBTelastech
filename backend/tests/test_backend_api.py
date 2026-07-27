"""End-to-end backend tests for the Copper Strip Corrosion Analyzer API."""
import time
import pytest

VALID_RATINGS = {"1a", "1b", "2a", "2b", "2c", "2d", "2e", "3a", "3b", "4a", "4b", "4c"}
CATEGORY_MAP = {
    "1a": "Slight Tarnish", "1b": "Slight Tarnish",
    "2a": "Moderate Tarnish", "2b": "Moderate Tarnish", "2c": "Moderate Tarnish",
    "2d": "Moderate Tarnish", "2e": "Moderate Tarnish",
    "3a": "Dark Tarnish", "3b": "Dark Tarnish",
    "4a": "Corrosion", "4b": "Corrosion", "4c": "Corrosion",
}


# ---------- Root ----------
class TestRoot:
    def test_root_welcome(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- ASTM reference ----------
class TestAstmReference:
    def test_reference_has_12(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/astm/reference")
        assert r.status_code == 200
        data = r.json()
        assert "ratings" in data
        ratings = data["ratings"]
        assert len(ratings) == 12
        seen = set()
        for item in ratings:
            for k in ("rating", "category", "color", "description"):
                assert k in item, f"missing {k}"
            seen.add(item["rating"])
        assert seen == VALID_RATINGS


# ---------- Analyze + CRUD ----------
class TestAnalyzeAndCRUD:
    created_id = None

    def test_analyze_invalid_data_url(self, api_client, base_url):
        r = api_client.post(f"{base_url}/api/analyze", json={"image_data": "not-a-data-url"})
        assert r.status_code == 400

    def test_analyze_success(self, api_client, base_url, copper_data_url):
        payload = {
            "image_data": copper_data_url,
            "sample_name": "TEST_Sample_A",
            "notes": "TEST test analysis",
        }
        r = api_client.post(f"{base_url}/api/analyze", json=payload, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("id", "created_at", "rating", "category", "description",
                  "confidence", "sample_name", "notes", "image_data"):
            assert k in data, f"missing {k}"
        assert data["rating"] in VALID_RATINGS
        assert data["category"] == CATEGORY_MAP[data["rating"]]
        assert data["sample_name"] == "TEST_Sample_A"
        assert data["notes"] == "TEST test analysis"
        assert data["image_data"].startswith("data:image/")
        TestAnalyzeAndCRUD.created_id = data["id"]

    def test_list_default_excludes_image(self, api_client, base_url):
        assert TestAnalyzeAndCRUD.created_id, "prev test must have created record"
        r = api_client.get(f"{base_url}/api/analyses")
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and "count" in data
        assert data["count"] >= 1
        # newest first
        first = data["items"][0]
        assert "image_data" not in first
        # newest-first by created_at desc
        created_ats = [i["created_at"] for i in data["items"]]
        assert created_ats == sorted(created_ats, reverse=True)

    def test_list_with_include_image(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/analyses", params={"include_image": "true"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any("image_data" in i and i["image_data"] for i in items)

    def test_list_filters_rating_and_search(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/analyses", params={"q": "TEST test analysis"})
        assert r.status_code == 200
        items = r.json()["items"]
        assert any(i["id"] == TestAnalyzeAndCRUD.created_id for i in items)

        # rating filter using the actual rating of the created record
        detail = api_client.get(f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}").json()
        r2 = api_client.get(f"{base_url}/api/analyses", params={"rating": detail["rating"]})
        assert r2.status_code == 200
        for i in r2.json()["items"]:
            assert i["rating"] == detail["rating"]

    def test_list_date_range(self, api_client, base_url):
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc).date().isoformat()
        yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
        r = api_client.get(f"{base_url}/api/analyses",
                           params={"date_from": yesterday, "date_to": today})
        assert r.status_code == 200

    def test_get_single_includes_image(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["image_data"].startswith("data:image/")

    def test_patch_updates(self, api_client, base_url):
        r = api_client.patch(
            f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}",
            json={"sample_name": "TEST_Updated", "notes": "TEST_UpdatedNotes"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["sample_name"] == "TEST_Updated"
        assert d["notes"] == "TEST_UpdatedNotes"
        # verify persistence
        g = api_client.get(f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}").json()
        assert g["sample_name"] == "TEST_Updated"

    def test_export_pdf(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}/pdf")
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert "attachment" in r.headers.get("content-disposition", "").lower()
        assert r.content[:4] == b"%PDF"

    def test_export_csv(self, api_client, base_url):
        r = api_client.get(f"{base_url}/api/analyses/export/csv")
        assert r.status_code == 200
        ctype = r.headers.get("content-type", "")
        assert "text/csv" in ctype
        body = r.text
        assert "ID,Created At,Sample Name,Rating,Category" in body
        assert TestAnalyzeAndCRUD.created_id in body

    def test_delete_and_404(self, api_client, base_url):
        r = api_client.delete(f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}")
        assert r.status_code == 200
        g = api_client.get(f"{base_url}/api/analyses/{TestAnalyzeAndCRUD.created_id}")
        assert g.status_code == 404
