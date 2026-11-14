import os, json, shutil, math
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from shapely.geometry import shape, mapping, LineString, Polygon
from shapely.ops import transform, unary_union
import pyproj
from backend.pdf_extractor import extract_evidence_from_pdf

app = FastAPI(title="SthalaTrace Core Intelligence Engine")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
os.makedirs("uploads", exist_ok=True)
STATE_FILE = "data/platform_state.json"

PROJECT_TO_METERS = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform
PROJECT_TO_WGS84 = pyproj.Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True).transform

INITIAL_PROJECTS = {
    "malabar-rail": {
        "id": "malabar-rail",
        "name": "Malabar Hinterland Semi-High-Speed Rail Spur",
        "region": "Kozhikode – Malappuram, Kerala",
        "client": "Southern Rail Infrastructure Corp.",
        "default_engineering": "Deep Cut-and-Fill",
        "surveys": [
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-101", "zone_id": "SZ-01", "source_doc": "synthetic_survey_report_2018.pdf",
                    "page_number": 2, "survey_date": "2018-08-16", "methodology": "Systematic Pedestrian Walkover (25m)",
                    "finding_type": "POSITIVE", "summary": "Iron Age BRW pottery & laterite hero-stones (KL-KZD-014)",
                    "verbatim_quote": "POSITIVE FINDING (Site ID: KL-KZD-014): At coordinates 11.2015 N, 75.8320 E, two weathered laterite hero-stones (Veerakkal) and scattered Iron Age BRW potsherds were documented.",
                    "limitations": "Surface walkover only; statutory exclusion buffer required", "visibility_poor": False, "verified": True, "verified_by": "Dr. R. Menon (Senior Archaeologist)"
                },
                "geometry": {"type": "Polygon", "coordinates": [[[75.815, 11.190], [75.845, 11.190], [75.845, 11.215], [75.815, 11.215], [75.815, 11.190]]]}
            },
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-102", "zone_id": "SZ-02", "source_doc": "synthetic_survey_report_2018.pdf",
                    "page_number": 3, "survey_date": "2018-09-04", "methodology": "Pedestrian Walkover (40m)",
                    "finding_type": "NEGATIVE", "summary": "No archaeological findings recorded across laterite plateau",
                    "verbatim_quote": "NO ARCHAEOLOGICAL FINDINGS RECORDED. Valid for shallow surface embankment works; deep cut-and-fill exceeding 2.0m depth would penetrate undisturbed horizons.",
                    "limitations": "Valid for surface works only; sub-surface >2m unassessed", "visibility_poor": False, "verified": True, "verified_by": "Dr. R. Menon (Senior Archaeologist)"
                },
                "geometry": {"type": "Polygon", "coordinates": [[[75.845, 11.215], [75.875, 11.215], [75.875, 11.245], [75.845, 11.245], [75.845, 11.215]]]}
            },
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-103", "zone_id": "SZ-03", "source_doc": "synthetic_survey_report_2018.pdf",
                    "page_number": 4, "survey_date": "2018-09-21", "methodology": "Opportunistic Track Reconnaissance",
                    "finding_type": "NEGATIVE", "summary": "No surface findings recorded, but <15% visibility due to monsoon",
                    "verbatim_quote": "Ground Visibility: SEVERELY POOR (<15% visibility due to dense post-monsoon undergrowth and waterlogged rubber plantations).",
                    "limitations": "Severely poor visibility (<15%); 80% off-track uninspected", "visibility_poor": True, "verified": False, "verified_by": None
                },
                "geometry": {"type": "Polygon", "coordinates": [[[75.875, 11.245], [75.905, 11.245], [75.905, 11.275], [75.875, 11.275], [75.875, 11.245]]]}
            }
        ],
        "original_route": {"type": "Feature", "properties": {"name": "2018 Baseline Alignment"}, "geometry": {"type": "LineString", "coordinates": [[75.820, 11.195], [75.840, 11.210], [75.860, 11.230], [75.890, 11.260]]}},
        "revised_route": {"type": "Feature", "properties": {"name": "2026 Revised Alignment"}, "geometry": {"type": "LineString", "coordinates": [[75.822, 11.196], [75.832, 11.202], [75.855, 11.225], [75.885, 11.235], [75.910, 11.255], [75.895, 11.268]]}}
    },
    "nh66-bypass": {
        "id": "nh66-bypass",
        "name": "NH-66 Beypore–Feroke 6-Lane Viaduct & Bypass",
        "region": "Chaliyar River Basin, Kozhikode",
        "client": "National Highways Corridor Authority",
        "default_engineering": "Deep Pier Piling (>12m)",
        "surveys": [
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-201", "zone_id": "CH-NORTH", "source_doc": "NH66_EIA_Addendum_2022.pdf",
                    "page_number": 11, "survey_date": "2022-02-14", "methodology": "Systematic Transect + GPR Sub-Surface Scan",
                    "finding_type": "NEGATIVE", "summary": "No archaeological anomalies detected in alluvial terrace (2022 dry season)",
                    "verbatim_quote": "Combined 20m pedestrian transect and 400MHz GPR profiling confirmed sterile riverine sand/clay strata down to 4.5m.",
                    "limitations": "Valid for standard embankments; deep caissons >10m require watching brief", "visibility_poor": False, "verified": True, "verified_by": "A. Nair (EIA Lead)"
                },
                "geometry": {"type": "Polygon", "coordinates": [[[75.805, 11.175], [75.830, 11.175], [75.830, 11.195], [75.805, 11.195], [75.805, 11.175]]]}
            },
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-202", "zone_id": "CH-PORT", "source_doc": "Chaliyar_Heritage_Recon_2015.pdf",
                    "page_number": 7, "survey_date": "2015-11-19", "methodology": "Coastal & Riverbank Walkover",
                    "finding_type": "POSITIVE", "summary": "Medieval maritime trade ceramics (Chinese Celadon & West Asian glazed ware)",
                    "verbatim_quote": "Dense concentration of 13th-15th century maritime trade sherds eroding along the southern Chaliyar creek bank.",
                    "limitations": "Tidal siltation obscures full inland extent of port settlement", "visibility_poor": False, "verified": True, "verified_by": "A. Nair (EIA Lead)"
                },
                "geometry": {"type": "Polygon", "coordinates": [[[75.810, 11.155], [75.838, 11.155], [75.838, 11.175], [75.810, 11.175], [75.810, 11.155]]]}
            }
        ],
        "original_route": {"type": "Feature", "properties": {"name": "2022 Approved Widening"}, "geometry": {"type": "LineString", "coordinates": [[75.812, 11.192], [75.818, 11.180], [75.825, 11.168]]}},
        "revised_route": {"type": "Feature", "properties": {"name": "2026 Eastern Bridge Realignment"}, "geometry": {"type": "LineString", "coordinates": [[75.814, 11.193], [75.824, 11.182], [75.833, 11.168], [75.846, 11.156]]}}
    },
    "palakkad-freight": {
        "id": "palakkad-freight",
        "name": "Palakkad Gap Industrial Freight & Utility Corridor",
        "region": "Walayar – Kanjikode Pass, Kerala",
        "client": "Industrial Corridor Development Board",
        "default_engineering": "Surface Embankment",
        "surveys": [
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-301", "zone_id": "PLK-WEST", "source_doc": "Walayar_Megalithic_Survey_2021.pdf",
                    "page_number": 5, "survey_date": "2021-03-10", "methodology": "Systematic Drone Photogrammetry + Pedestrian Walkover",
                    "finding_type": "NEGATIVE", "summary": "Cleared dry-season laterite scrubland; zero megalithic circles observed",
                    "verbatim_quote": "High-visibility March transect confirmed disturbed scrubland free of surface cairn circles or urn burials.",
                    "limitations": "Surface walkover only", "visibility_poor": False, "verified": True, "verified_by": "S. Krishnan (Field Director)"
                },
                "geometry": {"type": "Polygon", "coordinates": [[[76.720, 10.780], [76.760, 10.780], [76.760, 10.810], [76.720, 10.810], [76.720, 10.780]]]}
            },
            {
                "type": "Feature",
                "properties": {
                    "evidence_id": "EV-302", "zone_id": "PLK-PASS", "source_doc": "Walayar_Megalithic_Survey_2021.pdf",
                    "page_number": 9, "survey_date": "2021-03-18", "methodology": "Pedestrian Walkover (20m)",
                    "finding_type": "POSITIVE", "summary": "Cluster of 14 Iron Age Cist Burials & Menhir alignment (PLK-WLY-08)",
                    "verbatim_quote": "Intact megalithic cist burial complex spanning 220m north of the existing rail line.",
                    "limitations": "Requires strict statutory buffer and alignment deflection", "visibility_poor": False, "verified": True, "verified_by": "S. Krishnan (Field Director)"
                },
                "geometry": {"type": "Polygon", "coordinates": [[[76.760, 10.790], [76.795, 10.790], [76.795, 10.820], [76.760, 10.820], [76.760, 10.790]]]}
            }
        ],
        "original_route": {"type": "Feature", "properties": {"name": "2021 Baseline Freight Line"}, "geometry": {"type": "LineString", "coordinates": [[76.725, 10.795], [76.755, 10.795], [76.775, 10.785]]}},
        "revised_route": {"type": "Feature", "properties": {"name": "2026 Northern Industrial Spur"}, "geometry": {"type": "LineString", "coordinates": [[76.725, 10.795], [76.755, 10.802], [76.780, 10.808], [76.815, 10.815]]}}
    }
}

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    save_state(INITIAL_PROJECTS)
    return INITIAL_PROJECTS

def save_state(state):
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)

COST_DELAY_RATES = {
    "DIRECT_HERITAGE_CONFLICT": {"lakhs_per_km": 4.50, "base_days": 45, "protocol": "Salvage Excavation / NMA NOC + Alignment Deflection Study"},
    "OUTDATED_OR_LIMITED_EVIDENCE": {"lakhs_per_km": 1.65, "base_days": 21, "protocol": "Targeted Sub-Surface GPR / Dry-Season Re-Walkover"},
    "UNSURVEYED_GAP": {"lakhs_per_km": 1.20, "base_days": 28, "protocol": "Full Phase-1 Pedestrian Transect + Drone LiDAR/Photogrammetry"},
    "COVERED_BY_PRIOR_SURVEY": {"lakhs_per_km": 0.15, "base_days": 3, "protocol": "Desk Verification + Construction Watching Brief Only"}
}

def evaluate_relevance(props: dict, engineering_type: str, max_age_years: int, strict_visibility: bool, current_year: int = 2026):
    finding_type = props.get("finding_type")
    survey_year = int(str(props.get("survey_date", "2000"))[:4])
    age = current_year - survey_year
    visibility_poor = props.get("visibility_poor", False)
    limitations = props.get("limitations", "")

    if finding_type == "POSITIVE":
        return (
            "DIRECT_HERITAGE_CONFLICT",
            f"Intersects documented heritage zone {props['zone_id']}: {props['summary']} (Source: {props['source_doc']}, Page {props['page_number']})."
        )

    reasons = []
    if age > max_age_years:
        reasons.append(f"survey age ({age} yrs) exceeds policy threshold ({max_age_years} yrs)")
    if strict_visibility and visibility_poor:
        reasons.append("severely degraded seasonal ground visibility (<15%)")
    if ("surface" in limitations.lower()) and ("deep" in engineering_type.lower()):
        reasons.append(f"surface-only methodology incompatible with '{engineering_type}'")

    if reasons:
        return (
            "OUTDATED_OR_LIMITED_EVIDENCE",
            f"Overlaps negative zone {props['zone_id']}, but evidence reliability degraded: {'; '.join(reasons)} (Page {props['page_number']})."
        )

    return (
        "COVERED_BY_PRIOR_SURVEY",
        f"Validated negative survey coverage ({props['zone_id']}, {survey_year}) meets current policy criteria (Page {props['page_number']})."
    )

def run_spatial_engine(surveys: list[dict], route_geom_dict: dict, engineering_type: str, max_age_years: int, buffer_meters: int, strict_visibility: bool):
    route_geom_m = transform(PROJECT_TO_METERS, shape(route_geom_dict))
    total_length_m = route_geom_m.length

    chainage_markers = []
    dist = 0.0
    while dist <= total_length_m:
        pt_m = route_geom_m.interpolate(dist)
        pt_wgs = transform(PROJECT_TO_WGS84, pt_m)
        chainage_markers.append({"label": f"Km {dist/1000:.1f}", "coords": [pt_wgs.y, pt_wgs.x]})
        dist += 2000.0

    results, covered_geoms_m = [], []
    total_est_lakhs = 0.0
    max_delay_days = 0

    for feat in surveys:
        if not feat.get("geometry"):
            continue
        poly_m = transform(PROJECT_TO_METERS, shape(feat["geometry"]))
        if feat["properties"]["finding_type"] == "POSITIVE" and buffer_meters > 0:
            poly_m = poly_m.buffer(buffer_meters)

        inter = route_geom_m.intersection(poly_m)
        if not inter.is_empty and inter.length > 0.1:
            covered_geoms_m.append(inter.buffer(0.05))
            status, reason = evaluate_relevance(feat["properties"], engineering_type, max_age_years, strict_visibility)
            km = inter.length / 1000.0
            rate = COST_DELAY_RATES[status]
            est_cost = round(km * rate["lakhs_per_km"], 2)
            total_est_lakhs += est_cost
            max_delay_days = max(max_delay_days, rate["base_days"])

            # Compute start/end chainage along route
            start_km = round(route_geom_m.project(inter.boundary.geoms[0] if hasattr(inter.boundary, "geoms") and len(inter.boundary.geoms) > 0 else inter.centroid) / 1000.0, 2)

            results.append({
                "segment_status": status,
                "length_meters": round(inter.length, 1),
                "percentage_of_route": round((inter.length / total_length_m) * 100, 1),
                "approx_chainage": f"Km {start_km:.1f}",
                "zone_id": feat["properties"]["zone_id"],
                "source_citation": f"{feat['properties']['source_doc']} (Page {feat['properties']['page_number']})",
                "explanation": reason,
                "est_fieldwork_lakhs": est_cost,
                "est_delay_days": rate["base_days"],
                "recommended_protocol": rate["protocol"],
                "geometry_wgs84": mapping(transform(PROJECT_TO_WGS84, inter))
            })

    unsurveyed_geom_m = route_geom_m.difference(unary_union(covered_geoms_m)) if covered_geoms_m else route_geom_m
    if not unsurveyed_geom_m.is_empty and unsurveyed_geom_m.length > 0.1:
        km = unsurveyed_geom_m.length / 1000.0
        rate = COST_DELAY_RATES["UNSURVEYED_GAP"]
        est_cost = round(km * rate["lakhs_per_km"], 2)
        total_est_lakhs += est_cost
        max_delay_days = max(max_delay_days, rate["base_days"])

        results.append({
            "segment_status": "UNSURVEYED_GAP",
            "length_meters": round(unsurveyed_geom_m.length, 1),
            "percentage_of_route": round((unsurveyed_geom_m.length / total_length_m) * 100, 1),
            "approx_chainage": "Multiple",
            "zone_id": "NONE",
            "source_citation": "No prior survey coverage",
            "explanation": "Segment falls outside all documented baseline survey boundaries. Mandatory Phase-1 field reconnaissance required.",
            "est_fieldwork_lakhs": est_cost,
            "est_delay_days": rate["base_days"],
            "recommended_protocol": rate["protocol"],
            "geometry_wgs84": mapping(transform(PROJECT_TO_WGS84, unsurveyed_geom_m))
        })

    return {
        "chainage_markers": chainage_markers,
        "analysis": {
            "engineering_type": engineering_type,
            "total_length_meters": round(total_length_m, 1),
            "total_est_lakhs": round(total_est_lakhs, 2),
            "critical_path_days": max_delay_days,
            "segments": results
        }
    }

@app.get("/api/projects")
def list_projects():
    db = load_state()
    return [{"id": p["id"], "name": p["name"], "region": p["region"], "default_engineering": p["default_engineering"]} for p in db.values()]

@app.post("/api/reset-state")
def reset_all_state():
    save_state(INITIAL_PROJECTS)
    return {"status": "reset"}

@app.post("/api/simulate/{project_id}")
def simulate_corridor(project_id: str, payload: dict = Body(...)):
    db = load_state()
    proj = db[project_id]
    surveys = proj["surveys"]
    route_geom = payload.get("custom_route_geom") or proj["revised_route"]["geometry"]
    eng_type = payload.get("engineering_type", proj["default_engineering"])
    max_age = int(payload.get("max_age_years", 7))
    buffer_m = int(payload.get("buffer_meters", 150))
    strict_vis = bool(payload.get("strict_visibility", True))

    computed = run_spatial_engine(surveys, route_geom, eng_type, max_age, buffer_m, strict_vis)
    return {
        "project": {"id": proj["id"], "name": proj["name"], "region": proj["region"], "client": proj["client"]},
        "surveys": {"type": "FeatureCollection", "features": [s for s in surveys if s.get("geometry")]},
        "all_records": [s["properties"] for s in surveys],
        "original_route": proj["original_route"],
        "revised_route": {"type": "Feature", "properties": {"name": payload.get("route_name", proj["revised_route"]["properties"]["name"])}, "geometry": route_geom},
        "chainage_markers": computed["chainage_markers"],
        "analysis": computed["analysis"]
    }

@app.post("/api/suggest-deflection/{project_id}")
def suggest_deflection_bypass(project_id: str, payload: dict = Body(...)):
    """Computes a geometric deflection alignment avoiding POSITIVE heritage buffer zones."""
    db = load_state()
    proj = db[project_id]
    route_coords = list(proj["revised_route"]["geometry"]["coordinates"])
    buffer_m = int(payload.get("buffer_meters", 150))

    # Deflect waypoints that fall inside POSITIVE survey polygons
    deflected_coords = []
    for lon, lat in route_coords:
        pt_m = transform(PROJECT_TO_METERS, shape({"type": "Point", "coordinates": [lon, lat]}))
        shifted = False
        for feat in proj["surveys"]:
            if feat.get("geometry") and feat["properties"]["finding_type"] == "POSITIVE":
                poly_m = transform(PROJECT_TO_METERS, shape(feat["geometry"])).buffer(buffer_m + 150)
                if poly_m.contains(pt_m):
                    # Shift southeast outside the statutory exclusion zone
                    minx, miny, maxx, maxy = poly_m.bounds
                    bypass_pt_wgs = transform(PROJECT_TO_WGS84, shape({"type": "Point", "coordinates": [maxx + 200, miny - 200]}))
                    deflected_coords.append([round(bypass_pt_wgs.x, 5), round(bypass_pt_wgs.y, 5)])
                    shifted = True
                    break
        if not shifted:
            deflected_coords.append([lon, lat])

    return {"deflected_geometry": {"type": "LineString", "coordinates": deflected_coords}}

@app.post("/api/verify-record/{project_id}/{evidence_id}")
def toggle_verify(project_id: str, evidence_id: str):
    db = load_state()
    for feat in db[project_id]["surveys"]:
        if feat["properties"]["evidence_id"] == evidence_id:
            curr = bool(feat["properties"].get("verified"))
            feat["properties"]["verified"] = not curr
            feat["properties"]["verified_by"] = "Lead Heritage Auditor (Session)" if not curr else None
    save_state(db)
    return {"status": "ok"}

@app.post("/api/attach-polygon/{project_id}/{evidence_id}")
def attach_polygon(project_id: str, evidence_id: str, payload: dict = Body(...)):
    db = load_state()
    for feat in db[project_id]["surveys"]:
        if feat["properties"]["evidence_id"] == evidence_id:
            feat["geometry"] = payload["geometry"]
            feat["properties"]["verified"] = True
            feat["properties"]["verified_by"] = "GIS Digitized & Verified"
    save_state(db)
    return {"status": "attached"}

@app.get("/api/demo-pdf")
def get_demo_pdf():
    return FileResponse("data/synthetic_survey_report_2018.pdf", media_type="application/pdf")

@app.post("/api/ingest-pdf/{project_id}")
async def ingest_pdf(project_id: str, file: UploadFile = File(...)):
    save_path = os.path.join("uploads", file.filename)
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    extracted = extract_evidence_from_pdf(save_path)
    db = load_state()
    for idx, rec in enumerate(extracted.get("records", [])):
        rec["source_doc"] = file.filename
        rec["evidence_id"] = f"EV-{datetime.now().strftime('%H%M')}-{idx+1}"
        rec["verified"] = False
        rec["verified_by"] = None
        db[project_id]["surveys"].append({"type": "Feature", "properties": rec, "geometry": None})
    save_state(db)
    return {"filename": file.filename, "extraction": extracted}
