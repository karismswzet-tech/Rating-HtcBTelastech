"""Verify PDF layout fix: rating text should not overlap Category/metadata."""
import io
import os
import base64
import pytest
import requests
import pdfplumber

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for ln in f:
            if ln.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = ln.split("=", 1)[1].strip().strip('"')
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

RED_PNG_B64 = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8"
               "z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==")
DATA_URL = f"data:image/png;base64,{RED_PNG_B64}"


def _fetch_pdf(analysis_id):
    r = requests.get(f"{API}/analyses/{analysis_id}/pdf", timeout=30)
    assert r.status_code == 200, r.text[:200]
    assert r.headers.get("content-type", "").startswith("application/pdf")
    cd = r.headers.get("content-disposition", "")
    assert "attachment" in cd and "filename=" in cd
    return r.content


def _words(pdf_bytes):
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as p:
        page = p.pages[0]
        return page.extract_words(extra_attrs=["size"], use_text_flow=False)


def _find(words, text):
    for w in words:
        if text.lower() in w["text"].lower():
            return w
    return None


@pytest.fixture(scope="module")
def all_items():
    r = requests.get(f"{API}/analyses", timeout=30)
    assert r.status_code == 200
    return r.json()["items"]


@pytest.fixture(scope="module")
def long_id(all_items):
    for it in all_items:
        if it.get("sample_name") and len(it["sample_name"]) >= 20:
            return it["id"]
    pytest.skip("no long-name record")


@pytest.fixture(scope="module")
def empty_id(all_items):
    for it in all_items:
        if not it.get("sample_name"):
            return it["id"]
    pytest.skip("no empty-name record")


@pytest.fixture(scope="module")
def created_id():
    """Try to create a TEST_ record. If backend LLM fails, skip."""
    payload = {"image_data": DATA_URL,
               "sample_name": "TEST_LONG_SAMPLE_NAME_ABCDEFGHIJKL",
               "notes": "Notes for layout verification test."}
    try:
        r = requests.post(f"{API}/analyze", json=payload, timeout=120)
    except Exception as e:
        pytest.skip(f"analyze failed: {e}")
    if r.status_code != 200:
        pytest.skip(f"analyze returned {r.status_code}")
    aid = r.json()["id"]
    yield aid
    requests.delete(f"{API}/analyses/{aid}", timeout=30)


def _assert_layout(pdf_bytes):
    words = _words(pdf_bytes)
    assert words, "no words extracted"

    rating = max(words, key=lambda w: float(w["size"]))
    assert float(rating["size"]) > 30, f"rating font too small: {rating}"

    category = _find(words, "Category")
    sample = _find(words, "Sample")
    analysis_date = _find(words, "Analysis")
    confidence = _find(words, "Confidence")
    assert category, "Category label missing"
    assert sample and analysis_date and confidence, "metadata rows missing"

    # pdfplumber: top increases downward. rating must be above category.
    assert rating["bottom"] <= category["top"] + 1, (
        f"Rating overlaps Category. rating bottom={rating['bottom']} "
        f"category top={category['top']}")

    gap = category["top"] - rating["top"]
    assert gap > 40, f"gap between rating top and category too small: {gap}"

    # No non-rating token in rating's vertical band
    r_top, r_bot = rating["top"], rating["bottom"]
    for w in words:
        if w is rating:
            continue
        overlap = min(r_bot, w["bottom"]) - max(r_top, w["top"])
        if overlap > 5:
            if abs(float(w["size"]) - float(rating["size"])) < 1:
                continue  # same-size rating letters like "4B"
            pytest.fail(f"Token '{w['text']}' (size={w['size']}) overlaps rating band")

    for label, w in [("Sample", sample), ("Analysis", analysis_date), ("Confidence", confidence)]:
        assert category["bottom"] <= w["top"] + 1, (
            f"{label} not below Category (cat bot={category['bottom']}, {label} top={w['top']})")
        cat_overlap = min(category["bottom"], w["bottom"]) - max(category["top"], w["top"])
        assert cat_overlap <= 2, f"{label} shares line with Category"


class TestPdfLayout:
    def test_content_type_and_disposition(self, all_items):
        aid = all_items[0]["id"]
        r = requests.get(f"{API}/analyses/{aid}/pdf", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        cd = r.headers.get("content-disposition", "")
        assert 'filename="analysis-' in cd and cd.endswith('.pdf"')

    def test_long_name_layout(self, long_id):
        _assert_layout(_fetch_pdf(long_id))

    def test_empty_name_layout(self, empty_id):
        _assert_layout(_fetch_pdf(empty_id))

    def test_first_record_layout(self, all_items):
        _assert_layout(_fetch_pdf(all_items[0]["id"]))

    def test_ordering_matches_spec(self, all_items):
        """Verify title > 'ASTM D130 / IP 154' > rating > category > metadata."""
        pdf = _fetch_pdf(all_items[0]["id"])
        words = _words(pdf)
        title = _find(words, "Copper")
        astm = _find(words, "ASTM")
        rating = max(words, key=lambda w: float(w["size"]))
        cat = _find(words, "Category")
        sample = _find(words, "Sample")
        assert title and astm and cat and sample
        assert title["top"] < astm["top"] < rating["top"] < cat["top"] < sample["top"], (
            f"bad order: title={title['top']} astm={astm['top']} rating={rating['top']} "
            f"cat={cat['top']} sample={sample['top']}")

    def test_created_record_with_image(self, created_id):
        pdf = _fetch_pdf(created_id)
        _assert_layout(pdf)
        with pdfplumber.open(io.BytesIO(pdf)) as p:
            page = p.pages[0]
            text = page.extract_text() or ""
            imgs = page.images
        assert "Sample Image" in text
        assert len(imgs) >= 1
