import os
import io
import base64
import random
import pytest
import requests
from PIL import Image, ImageDraw

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if os.environ.get('REACT_APP_BACKEND_URL') else 'https://copper-strip-astm.preview.emergentagent.com'


def _make_copper_jpeg_data_url(seed: int = 42) -> str:
    """Generate a realistic copper-toned JPEG with visible texture."""
    random.seed(seed)
    w, h = 480, 320
    img = Image.new("RGB", (w, h), (205, 119, 62))
    draw = ImageDraw.Draw(img)
    # add horizontal streaks & noise for texture
    for y in range(h):
        shade = 205 + random.randint(-25, 25)
        r = max(0, min(255, shade))
        g = max(0, min(255, 119 + random.randint(-20, 20)))
        b = max(0, min(255, 62 + random.randint(-15, 15)))
        draw.line([(0, y), (w, y)], fill=(r, g, b))
    # scatter darker specks (tarnish patches)
    for _ in range(600):
        x = random.randint(0, w - 1); y = random.randint(0, h - 1)
        rad = random.randint(1, 4)
        col = (random.randint(90, 180), random.randint(50, 100), random.randint(30, 70))
        draw.ellipse([x, y, x + rad, y + rad], fill=col)
    # draw a rectangular strip border
    draw.rectangle([20, 60, w - 20, h - 60], outline=(80, 40, 20), width=3)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88)
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/jpeg;base64,{b64}"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def copper_data_url():
    return _make_copper_jpeg_data_url()
