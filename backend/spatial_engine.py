import json
from shapely.geometry import shape, mapping
from shapely.ops import transform, unary_union
import pyproj

PROJECT_TO_METERS = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform
PROJECT_TO_WGS84 = pyproj.Transformer.from_crs("EPSG:32643", "EPSG:4326", always_xy=True).transform

def evaluate_evidence_relevance(props: dict, engineering_type: str, current_year: int = 2026) -> tuple[str, str]:
    finding_type = props.get("finding_type")
    survey_year = int(str(props.get("survey_date", "2000"))[:4])
    age = current_year - survey_year
    visibility_poor = props.get("visibility_poor", False)
    limitations = props.get("limitations", "")

    if finding_type == "POSITIVE":
        return ("DIRECT_HERITAGE_CONFLICT", f"Overlaps surveyed zone ({props['zone_id']}) with documented findings: {props['summary']} (Source: {props['source_doc']}, Page {props['page_number']}).")

    reasons = []
    if age > 7: reasons.append(f"survey is {age} years old ({survey_year})")
    if visibility_poor: reasons.append("severely poor ground visibility recorded during survey")
    if "surface" in limitations.lower() and "deep" in engineering_type.lower(): reasons.append(f"prior survey was surface-only, incompatible with '{engineering_type}'")

    if reasons:
        return ("OUTDATED_OR_LIMITED_EVIDENCE", f"Overlaps negative zone ({props['zone_id']}), reliability degraded: {', '.join(reasons)} (Page {props['page_number']}).")
    return ("COVERED_BY_PRIOR_SURVEY", f"Covered by valid negative survey ({props['zone_id']}, {survey_year}) (Page {props['page_number']}).")

def analyze_route_gaps(surveys: list[dict], route_feat: dict):
    route_geom_m = transform(PROJECT_TO_METERS, shape(route_feat["geometry"]))
    eng_type = route_feat["properties"].get("engineering_type", "Surface")
    total_length_m = route_geom_m.length
    results, covered_geoms_m = [], []

    for feat in surveys:
        poly_m = transform(PROJECT_TO_METERS, shape(feat["geometry"]))
        inter = route_geom_m.intersection(poly_m)
        if not inter.is_empty and inter.length > 0.1:
            # Buffer by 1cm to eliminate floating-point boundary slivers
            covered_geoms_m.append(inter.buffer(0.01))
            status, reason = evaluate_evidence_relevance(feat["properties"], eng_type)
            results.append({
                "segment_status": status,
                "length_meters": round(inter.length, 1),
                "percentage_of_route": round((inter.length / total_length_m) * 100, 1),
                "zone_id": feat["properties"]["zone_id"],
                "source_citation": f"{feat['properties']['source_doc']} (Page {feat['properties']['page_number']})",
                "explanation": reason,
                "geometry_wgs84": mapping(transform(PROJECT_TO_WGS84, inter))
            })

    unsurveyed_geom_m = route_geom_m.difference(unary_union(covered_geoms_m)) if covered_geoms_m else route_geom_m
    if not unsurveyed_geom_m.is_empty and unsurveyed_geom_m.length > 0.1:
        results.append({
            "segment_status": "UNSURVEYED_GAP",
            "length_meters": round(unsurveyed_geom_m.length, 1),
            "percentage_of_route": round((unsurveyed_geom_m.length / total_length_m) * 100, 1),
            "zone_id": "NONE",
            "source_citation": "No prior survey coverage",
            "explanation": "Falls outside all baseline survey polygons. Mandatory Phase-1 field reconnaissance required.",
            "geometry_wgs84": mapping(transform(PROJECT_TO_WGS84, unsurveyed_geom_m))
        })

    return {"route_name": route_feat["properties"].get("name", "Revised Route"), "engineering_type": eng_type, "total_length_meters": round(total_length_m, 1), "segments": results}

if __name__ == "__main__":
    with open("data/survey_zones.geojson") as f: s = json.load(f)["features"]
    with open("data/revised_route.geojson") as f: r = json.load(f)["features"][0]
    print(json.dumps(analyze_route_gaps(s, r), indent=2))
