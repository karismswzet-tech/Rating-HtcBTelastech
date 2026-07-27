from fastapi import FastAPI, APIRouter, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import io
import csv
import json
import base64
import uuid
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors as rl_colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')

# Preload ASTM D130 reference chart image (base64) so the vision model
# can compare uploaded strips against the actual printed standard.
ASTM_REFERENCE_IMAGE_PATH = ROOT_DIR / "assets" / "astm_reference_chart.png"
try:
    with open(ASTM_REFERENCE_IMAGE_PATH, "rb") as _f:
        ASTM_REFERENCE_IMAGE_B64 = base64.b64encode(_f.read()).decode("ascii")
except FileNotFoundError:
    ASTM_REFERENCE_IMAGE_B64 = ""

app = FastAPI(title="Copper Strip Corrosion Rating Analyzer")
api_router = APIRouter(prefix="/api")

# ---------------- ASTM D130 constants ----------------
ASTM_RATINGS = ["1a", "1b", "2a", "2b", "2c", "2d", "2e", "3a", "3b", "4a", "4b", "4c"]

RATING_CATEGORY = {
    "1a": "Slight Tarnish",
    "1b": "Slight Tarnish",
    "2a": "Moderate Tarnish",
    "2b": "Moderate Tarnish",
    "2c": "Moderate Tarnish",
    "2d": "Moderate Tarnish",
    "2e": "Moderate Tarnish",
    "3a": "Dark Tarnish",
    "3b": "Dark Tarnish",
    "4a": "Corrosion",
    "4b": "Corrosion",
    "4c": "Corrosion",
}

RATING_REFERENCE_COLOR = {
    "1a": "#E2955B", "1b": "#CD773E",
    "2a": "#A84C32", "2b": "#795270", "2c": "#57678B", "2d": "#A1A1A5", "2e": "#C5A059",
    "3a": "#8E354A", "3b": "#50594B",
    "4a": "#322B29", "4b": "#1E1E22", "4c": "#111111",
}

RATING_DESCRIPTION = {
    "1a": "Light orange, almost the same as a freshly polished strip.",
    "1b": "Dark orange color.",
    "2a": "Claret red.",
    "2b": "Lavender.",
    "2c": "Multicolored with lavender blue or silver, or both, overlaid on claret red.",
    "2d": "Silvery.",
    "2e": "Brassy or gold.",
    "3a": "Magenta overcast on brassy strip.",
    "3b": "Multicolored with red and green showing (peacock), but no gray.",
    "4a": "Transparent black, dark gray or brown, with peacock green barely showing.",
    "4b": "Graphite or lusterless black.",
    "4c": "Glossy or jet black.",
}

# ---------------- Models ----------------
class AnalysisBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    rating: str
    category: str
    description: str
    confidence: Optional[float] = None
    sample_name: Optional[str] = ""
    notes: Optional[str] = ""
    image_data: str  # data URL: data:image/png;base64,....

class AnalyzeRequest(BaseModel):
    image_data: str  # data URL "data:image/png;base64,...."
    sample_name: Optional[str] = ""
    notes: Optional[str] = ""

class UpdateRequest(BaseModel):
    sample_name: Optional[str] = None
    notes: Optional[str] = None


# ---------------- AI Vision Analysis ----------------
async def analyze_with_ai(image_data_url: str) -> dict:
    """
    Analyze copper strip image via GPT-5.2 vision.
    Returns dict {rating, category, description, confidence}
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY not configured")

    # Extract mime + base64 payload
    if not image_data_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="image_data must be data URL")
    try:
        header, b64 = image_data_url.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid data URL")

    system_msg = (
        "You are a precise laboratory assistant certified in ASTM D130 / IP 154 copper strip corrosion testing. "
        "You analyze copper strip test photos and classify them into one of these 12 ratings: "
        "1a, 1b, 2a, 2b, 2c, 2d, 2e, 3a, 3b, 4a, 4b, 4c. "
        "Category mapping: 1a-1b=Slight Tarnish, 2a-2e=Moderate Tarnish, 3a-3b=Dark Tarnish, 4a-4c=Corrosion. "
        "Reference color descriptions:\n"
        "1a: Light orange, almost the same as freshly polished strip.\n"
        "1b: Dark orange.\n"
        "2a: Claret red.\n"
        "2b: Lavender.\n"
        "2c: Multicolored with lavender blue or silver, or both, overlaid on claret red.\n"
        "2d: Silvery.\n"
        "2e: Brassy or gold.\n"
        "3a: Magenta overcast on brassy strip.\n"
        "3b: Multicolored with red and green showing (peacock), but no gray.\n"
        "4a: Transparent black, dark gray or brown, with peacock green barely showing.\n"
        "4b: Graphite or lusterless black.\n"
        "4c: Glossy or jet black.\n"
        "Reply ONLY with strict minified JSON. No markdown, no code fence, no commentary. "
        'Schema: {"rating":"<one of 1a|1b|2a|2b|2c|2d|2e|3a|3b|4a|4b|4c>",'
        '"category":"<Slight Tarnish|Moderate Tarnish|Dark Tarnish|Corrosion>",'
        '"description":"<one sentence explaining the observed color/tarnish>",'
        '"confidence":<0-1 float>}'
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"copper-{uuid.uuid4()}",
        system_message=system_msg,
    ).with_model("openai", "gpt-5.2")

    image_content = ImageContent(image_base64=b64)

    file_contents = [image_content]
    prompt_text = (
        "Analyze this copper strip photograph per ASTM D130. "
        "Return only the JSON as specified in the system prompt."
    )
    if ASTM_REFERENCE_IMAGE_B64:
        # Provide the printed ASTM D130 color-gradient standard as the second
        # image so the model can compare the sample against the actual chart.
        file_contents.append(ImageContent(image_base64=ASTM_REFERENCE_IMAGE_B64))
        prompt_text = (
            "IMAGE 1 is the copper strip sample photograph to classify. "
            "IMAGE 2 is the official ASTM D130 / IP 154 color-gradient reference chart "
            "showing all 12 standard tarnish patches (1a, 1b, 2a-2e, 3a, 3b, 4a-4c). "
            "Compare IMAGE 1 to the closest patch in IMAGE 2, then return ONLY the JSON "
            "specified in the system prompt."
        )
    user_msg = UserMessage(
        text=prompt_text,
        file_contents=file_contents,
    )

    try:
        reply = await chat.send_message(user_msg)
    except Exception as e:
        logger.exception("LLM call failed")
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {e}")

    text = reply if isinstance(reply, str) else str(reply)
    text = text.strip()
    # Strip markdown fences if any
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()
    # Find JSON braces
    try:
        start = text.index("{")
        end = text.rindex("}") + 1
        parsed = json.loads(text[start:end])
    except Exception:
        raise HTTPException(status_code=502, detail=f"AI returned non-JSON: {text[:200]}")

    rating = str(parsed.get("rating", "")).lower().strip()
    if rating not in ASTM_RATINGS:
        # Fallback: try to salvage
        rating = "2a"
    category = RATING_CATEGORY[rating]
    description = str(parsed.get("description", RATING_DESCRIPTION[rating]))
    try:
        confidence = float(parsed.get("confidence", 0.8))
    except (TypeError, ValueError):
        confidence = 0.8
    confidence = max(0.0, min(1.0, confidence))

    return {
        "rating": rating,
        "category": category,
        "description": description,
        "confidence": confidence,
    }


# ---------------- Routes ----------------
@api_router.get("/")
async def root():
    return {"message": "Copper Strip Corrosion Rating Analyzer API"}


@api_router.get("/astm/reference")
async def astm_reference():
    """Returns full ASTM D130 reference chart for the frontend."""
    return {
        "ratings": [
            {
                "rating": r,
                "category": RATING_CATEGORY[r],
                "color": RATING_REFERENCE_COLOR[r],
                "description": RATING_DESCRIPTION[r],
            }
            for r in ASTM_RATINGS
        ]
    }


@api_router.post("/analyze")
async def analyze(req: AnalyzeRequest):
    result = await analyze_with_ai(req.image_data)
    doc = AnalysisBase(
        rating=result["rating"],
        category=result["category"],
        description=result["description"],
        confidence=result["confidence"],
        sample_name=req.sample_name or "",
        notes=req.notes or "",
        image_data=req.image_data,
    )
    await db.analyses.insert_one(doc.model_dump())
    return doc.model_dump()


@api_router.get("/analyses")
async def list_analyses(
    rating: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    q: Optional[str] = Query(None, description="Search sample_name or notes"),
    include_image: bool = False,
):
    query = {}
    if rating:
        query["rating"] = rating.lower()
    if date_from or date_to:
        rng = {}
        if date_from:
            rng["$gte"] = date_from
        if date_to:
            rng["$lte"] = date_to + "T23:59:59"
        query["created_at"] = rng
    if q:
        query["$or"] = [
            {"sample_name": {"$regex": q, "$options": "i"}},
            {"notes": {"$regex": q, "$options": "i"}},
        ]

    projection = {"_id": 0}
    if not include_image:
        projection["image_data"] = 0
    cursor = db.analyses.find(query, projection).sort("created_at", -1)
    items = await cursor.to_list(1000)
    return {"items": items, "count": len(items)}


@api_router.get("/analyses/{analysis_id}")
async def get_analysis(analysis_id: str):
    doc = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return doc


@api_router.patch("/analyses/{analysis_id}")
async def update_analysis(analysis_id: str, body: UpdateRequest):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.analyses.update_one({"id": analysis_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")
    doc = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    return doc


@api_router.delete("/analyses/{analysis_id}")
async def delete_analysis(analysis_id: str):
    res = await db.analyses.delete_one({"id": analysis_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return {"deleted": True}


@api_router.get("/analyses/{analysis_id}/pdf")
async def export_pdf(analysis_id: str):
    doc = await db.analyses.find_one({"id": analysis_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Analysis not found")

    buf = io.BytesIO()
    pdf = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=18*mm, rightMargin=18*mm,
                            topMargin=18*mm, bottomMargin=18*mm)
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('title', parent=styles['Title'], fontSize=20,
                                 textColor=rl_colors.HexColor("#0F172A"))
    h2 = ParagraphStyle('h2', parent=styles['Heading2'], fontSize=12,
                        textColor=rl_colors.HexColor("#475569"))
    body = styles['BodyText']
    story = []

    story.append(Paragraph("Copper Strip Corrosion Analysis Report", title_style))
    story.append(Paragraph("ASTM D130 / IP 154", h2))
    story.append(Spacer(1, 8*mm))

    # Rating giant text
    story.append(Paragraph(
        f'<font size="48" color="#2563EB"><b>{doc["rating"].upper()}</b></font>',
        body
    ))
    story.append(Paragraph(f'<b>Category:</b> {doc["category"]}', body))
    story.append(Spacer(1, 4*mm))

    # Metadata table
    meta = [
        ["Sample Name", doc.get("sample_name") or "-"],
        ["Analysis Date", doc.get("created_at", "-")],
        ["Confidence", f'{(doc.get("confidence") or 0)*100:.1f}%'],
    ]
    t = Table(meta, colWidths=[45*mm, 120*mm])
    t.setStyle(TableStyle([
        ('FONT', (0, 0), (-1, -1), 'Helvetica', 10),
        ('TEXTCOLOR', (0, 0), (0, -1), rl_colors.HexColor("#475569")),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, -1), 0.5, rl_colors.HexColor("#E2E8F0")),
    ]))
    story.append(t)
    story.append(Spacer(1, 5*mm))

    story.append(Paragraph("<b>Description</b>", h2))
    story.append(Paragraph(doc.get("description", ""), body))
    story.append(Spacer(1, 4*mm))

    if doc.get("notes"):
        story.append(Paragraph("<b>Notes</b>", h2))
        story.append(Paragraph(doc["notes"], body))
        story.append(Spacer(1, 4*mm))

    # Image
    try:
        img_data = doc.get("image_data", "")
        if img_data and "," in img_data:
            _, b64 = img_data.split(",", 1)
            raw = base64.b64decode(b64)
            img_buf = io.BytesIO(raw)
            img = RLImage(img_buf, width=140*mm, height=105*mm, kind='proportional')
            story.append(Paragraph("<b>Sample Image</b>", h2))
            story.append(img)
    except Exception as e:
        logger.warning(f"Could not embed image in PDF: {e}")

    pdf.build(story)
    buf.seek(0)
    filename = f'analysis-{doc["rating"]}-{doc["id"][:8]}.pdf'
    return Response(
        content=buf.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/analyses/export/csv")
async def export_csv():
    cursor = db.analyses.find({}, {"_id": 0, "image_data": 0}).sort("created_at", -1)
    rows = await cursor.to_list(10000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["ID", "Created At", "Sample Name", "Rating", "Category",
                     "Confidence", "Description", "Notes"])
    for r in rows:
        writer.writerow([
            r.get("id", ""),
            r.get("created_at", ""),
            r.get("sample_name", ""),
            r.get("rating", ""),
            r.get("category", ""),
            f'{(r.get("confidence") or 0):.3f}',
            r.get("description", ""),
            r.get("notes", ""),
        ])
    buf.seek(0)
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="astm_d130_history.csv"'},
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
