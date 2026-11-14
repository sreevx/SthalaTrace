import json
from fpdf import FPDF

class SurveyReportPDF(FPDF):
    def header(self):
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, "SYNTHETIC DEMO DATA | Malabar Rail Corridor - Baseline Archaeological Survey (2018)", align="R", new_x="LMARGIN", new_y="NEXT")
        self.line(10, 18, 200, 18)
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 10, f"Page {self.page_no()} of {{nb}} | Deccan Heritage & EIA Consultants Pvt. Ltd.", align="C")

pdf = SurveyReportPDF()
pdf.alias_nb_pages()
pdf.set_auto_page_break(auto=True, margin=20)

pages = [
    """ARCHAEOLOGICAL & CULTURAL HERITAGE BASELINE SURVEY REPORT
Project: Proposed Malabar Hinterland Rail Link (Phase-I Alignment)
Client: Southern Infrastructure & Rail Development Authority
Survey Organization: Deccan Heritage & EIA Consultants Pvt. Ltd.
Survey Dates: 14 August 2018 - 28 September 2018
Report Reference: DH-EIA-2018-KL-09 (SYNTHETIC DEMONSTRATION DATASET)

1. EXECUTIVE SUMMARY & SCOPE
This report documents the Phase-I pedestrian reconnaissance and surface archaeological survey conducted along a 500-meter-wide buffer of the 2018 Proposed Railway Alignment (Chainage Km 0+000 to Km 18+500) across Kozhikode and Malappuram districts, Kerala.

Important Methodological Disclaimer:
Investigation was restricted strictly to surface pedestrian walkover along accessible transects. No sub-surface geophysical scanning (GPR/magnetometry) or trial trenching was authorized during Phase-I. Absence of recorded surface material in any survey block does not establish the absence of buried archaeological deposits.""",

    """2. SURVEY BLOCK A: CHERUVANNUR - BEYPORE ALLUVIAL PLAIN (KM 0+000 TO KM 6+200)
Zone ID: SZ-01
Survey Date: 16 August 2018
Methodology: Intensive systematic pedestrian transect walkover at 25-meter intervals.
Ground Visibility: High (75-85% exposed lateritic soil and harvested paddy margins).

Recorded Findings:
POSITIVE FINDING (Site ID: KL-KZD-014): At coordinates 11.2015 N, 75.8320 E (Chainage Km 3+400), two weathered laterite hero-stones (Veerakkal) and scattered Iron Age Black-and-Red Ware (BRW) potsherds were documented within a 120m radius mound locally known as Kottakunnu.

Recommendation for SZ-01:
Mandatory 150-meter statutory exclusion buffer around Site KL-KZD-014. Any alignment shift intersecting Kottakunnu requires salvage excavation prior to earthwork.""",

    """3. SURVEY BLOCK B: MAVOOR - PERUVAYAL LATERITE PLATEAU (KM 6+200 TO KM 12+800)
Zone ID: SZ-02
Survey Date: 04 September 2018
Methodology: Pedestrian field walkover along agricultural bunds and quarry edges (40-meter spacing).
Ground Visibility: Good (65-75% open scrub and laterite outcrop).

Recorded Findings:
NO ARCHAEOLOGICAL FINDINGS RECORDED (Negative Survey Observation).
Across 6.6 linear kilometers of inspected corridor within Block SZ-02, no surface ceramics, megalithic capstone clusters, rock-cut chambers, or structural mounds were observed. Modern laterite quarrying has disturbed the upper 1.5m horizon in several pockets.

Limitations & Caveats for SZ-02:
Valid for shallow surface embankment works along the 2018 alignment. However, deep cut-and-fill or tunnel portals exceeding 2.0m depth would penetrate undisturbed sub-lateritic horizons not assessed by surface walkover.""",

    """4. SURVEY BLOCK C: KUNNAMANGALAM - KODUVALLY FOOTHILLS (KM 12+800 TO KM 18+500)
Zone ID: SZ-03
Survey Date: 21 September 2018 (Late Monsoon Conditions)
Methodology: Rapid opportunistic reconnaissance along existing forest tracks only.
Ground Visibility: SEVERELY POOR (<15% visibility due to dense post-monsoon undergrowth, waterlogged rubber plantations, and thick leaf litter).

Recorded Findings:
NO SURFACE FINDINGS RECORDED (Low-Confidence Negative Observation).
While no surface artifacts were logged along accessible tracks, dense canopy and waterlogging prevented systematic off-track inspection across 80% of Block SZ-03. Furthermore, local oral histories mention rock-cut megalithic caves (Nannangadi / Kudakkallu) on adjacent eastern slopes outside the 2018 survey boundary.

Limitations for SZ-03:
Survey reliability is rated LOW due to seasonal vegetation cover and age (>7 years old). Re-survey during dry season (January-April) with vegetation clearance is mandatory if alignment shifts occur here.""",

    """5. SUMMARY MATRIX OF SURVEYED ZONES & UNSURVEYED HINTERLAND
- Block SZ-01 (Km 0.0 - 6.2): Surveyed Aug 2018 | POSITIVE FINDING (KL-KZD-014, Page 2) | High Confidence.
- Block SZ-02 (Km 6.2 - 12.8): Surveyed Sep 2018 | NO FINDINGS RECORDED (Page 3) | Moderate Confidence (Surface Only).
- Block SZ-03 (Km 12.8 - 18.5): Surveyed Sep 2018 | NO FINDINGS RECORDED (Page 4) | LOW Confidence (Monsoon visibility <15%).
- Eastern Uplands (East of 75.885 E): COMPLETELY UNSURVEYED. Excluded from 2018 scope.

End of Report - Deccan Heritage & EIA Consultants Pvt. Ltd."""
]

for text in pages:
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)
    pdf.multi_cell(0, 6.5, text)

pdf.output("data/synthetic_survey_report_2018.pdf")

survey_zones = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "properties": {
                "evidence_id": "EV-001", "zone_id": "SZ-01", "source_doc": "synthetic_survey_report_2018.pdf",
                "page_number": 2, "survey_date": "2018-08-16", "methodology": "Systematic Pedestrian Walkover (25m)",
                "finding_type": "POSITIVE", "summary": "Iron Age BRW pottery & hero-stones (KL-KZD-014)",
                "limitations": "Surface walkover only; 150m exclusion buffer required", "visibility_poor": False
            },
            "geometry": {"type": "Polygon", "coordinates": [[[75.815, 11.190], [75.845, 11.190], [75.845, 11.215], [75.815, 11.215], [75.815, 11.190]]]}
        },
        {
            "type": "Feature",
            "properties": {
                "evidence_id": "EV-002", "zone_id": "SZ-02", "source_doc": "synthetic_survey_report_2018.pdf",
                "page_number": 3, "survey_date": "2018-09-04", "methodology": "Pedestrian Walkover (40m)",
                "finding_type": "NEGATIVE", "summary": "No archaeological findings recorded across laterite plateau",
                "limitations": "Valid for surface works only; sub-surface >2m unassessed", "visibility_poor": False
            },
            "geometry": {"type": "Polygon", "coordinates": [[[75.845, 11.215], [75.875, 11.215], [75.875, 11.245], [75.845, 11.245], [75.845, 11.215]]]}
        },
        {
            "type": "Feature",
            "properties": {
                "evidence_id": "EV-003", "zone_id": "SZ-03", "source_doc": "synthetic_survey_report_2018.pdf",
                "page_number": 4, "survey_date": "2018-09-21", "methodology": "Opportunistic Track Reconnaissance",
                "finding_type": "NEGATIVE", "summary": "No surface findings recorded, but <15% visibility due to monsoon",
                "limitations": "Severely poor visibility (<15%); 80% off-track uninspected; >7 yrs old", "visibility_poor": True
            },
            "geometry": {"type": "Polygon", "coordinates": [[[75.875, 11.245], [75.905, 11.245], [75.905, 11.275], [75.875, 11.275], [75.875, 11.245]]]}
        }
    ]
}
with open("data/survey_zones.geojson", "w") as f: json.dump(survey_zones, f, indent=2)

original_route = {
    "type": "FeatureCollection",
    "features": [{"type": "Feature", "properties": {"name": "2018 Baseline Alignment", "engineering_type": "Surface Embankment"},
    "geometry": {"type": "LineString", "coordinates": [[75.820, 11.195], [75.840, 11.210], [75.860, 11.230], [75.890, 11.260]]}}]
}
revised_route = {
    "type": "FeatureCollection",
    "features": [{"type": "Feature", "properties": {"name": "2026 Revised Alignment", "engineering_type": "Deep Cut-and-Fill"},
    "geometry": {"type": "LineString", "coordinates": [[75.822, 11.196], [75.832, 11.202], [75.855, 11.225], [75.885, 11.235], [75.910, 11.255], [75.895, 11.268]]}}]
}
with open("data/original_route.geojson", "w") as f: json.dump(original_route, f, indent=2)
with open("data/revised_route.geojson", "w") as f: json.dump(revised_route, f, indent=2)
print("Dataset generated.")
