import os
import fitz  # PyMuPDF
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

class EvidenceRecord(BaseModel):
    evidence_id: str = Field(description="Unique ID like EV-001")
    zone_id: str = Field(description="Survey block or zone ID mentioned in text, e.g. SZ-01")
    page_number: int = Field(description="Exact 1-indexed PDF page number where this evidence appears")
    survey_date: str = Field(description="YYYY-MM-DD or YYYY format date of survey")
    methodology: str = Field(description="Field survey method used (e.g. Pedestrian Walkover 25m)")
    finding_type: str = Field(description="Must be POSITIVE, NEGATIVE, or UNCERTAIN")
    summary: str = Field(description="Concise factual summary of recorded findings or negative observation")
    verbatim_quote: str = Field(description="Exact short quote from the PDF supporting this record")
    limitations: str = Field(description="Recorded methodological, depth, or visibility limitations")
    visibility_poor: bool = Field(description="True if report notes poor ground visibility or dense vegetation")
    coordinates_present_in_text: bool = Field(description="True ONLY if explicit lat/lon numbers appear in text")

class SurveyExtractionReport(BaseModel):
    project_name: str
    survey_organization: str
    records: list[EvidenceRecord]

def extract_evidence_from_pdf(pdf_path: str) -> dict:
    doc = fitz.open(pdf_path)
    pages_text = []
    for i, page in enumerate(doc):
        pages_text.append(f"--- PAGE {i + 1} ---\n{page.get_text('text')}")
    full_annotated_text = "\n\n".join(pages_text)

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")

    client = genai.Client(api_key=api_key)
    prompt = f"""You are an archaeological evidence provenance auditor.
Extract all surveyed zones, positive archaeological findings, and documented negative-survey observations from the report below.
STRICT RULES:
1. Preserve exact page_number from the --- PAGE X --- markers.
2. Treat documented negative findings ("no findings recorded") as first-class records with finding_type="NEGATIVE".
3. NEVER invent geographic coordinates or conclusions not explicitly stated in the text.

REPORT TEXT:
{full_annotated_text}"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=SurveyExtractionReport,
            temperature=0.1,
        ),
    )
    return response.parsed.model_dump()
