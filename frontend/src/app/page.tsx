"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  Map as MapIcon, FileText, ClipboardCheck, Upload, CheckCircle2,
  AlertTriangle, ShieldAlert, Printer, Layers, Sliders, ExternalLink,
  Download, Satellite, Compass, FolderGit2, Scale, PenTool, RotateCcw,
  IndianRupee, Clock, Sparkles, MapPin, RefreshCw
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? "" : "http://127.0.0.1:8000");

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  DIRECT_HERITAGE_CONFLICT: { label: "Direct Heritage Conflict", color: "#dc2626", bg: "bg-red-600" },
  OUTDATED_OR_LIMITED_EVIDENCE: { label: "Outdated / Method-Limited", color: "#d97706", bg: "bg-amber-600" },
  UNSURVEYED_GAP: { label: "Unsurveyed Corridor Gap", color: "#7c3aed", bg: "bg-violet-600" },
  COVERED_BY_PRIOR_SURVEY: { label: "Valid Prior Survey Coverage", color: "#059669", bg: "bg-emerald-600" },
};

export default function SthalaTraceCommandCenter() {
  const [activeTab, setActiveTab] = useState<"map" | "ingest" | "report">("map");
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState<string>("malabar-rail");

  // Deterministic Policy Parameters
  const [engineeringType, setEngineeringType] = useState<string>("Deep Cut-and-Fill");
  const [maxAgeYears, setMaxAgeYears] = useState<number>(7);
  const [bufferMeters, setBufferMeters] = useState<number>(150);
  const [strictVisibility, setStrictVisibility] = useState<boolean>(true);

  // Map & Digitizing State
  const [basemap, setBasemap] = useState<"topo" | "satellite">("topo");
  const [showOriginal, setShowOriginal] = useState(true);
  const [showChainage, setShowChainage] = useState(true);
  const [drawMode, setDrawMode] = useState<"none" | "route" | "polygon">("none");
  const [drawnCoords, setDrawnCoords] = useState<number[][]>([]);
  const [digitizingRecord, setDigitizingRecord] = useState<any>(null);
  const [isDeflected, setIsDeflected] = useState(false);

  const [corridorData, setCorridorData] = useState<any>(null);
  const [selectedSegment, setSelectedSegment] = useState<any>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // PDF Provenance State
  const [pdfUrl, setPdfUrl] = useState<string>(`${API_BASE}/api/demo-pdf`);
  const [pdfPage, setPdfPage] = useState<number>(1);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/projects`)
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setErrorMsg("Backend API not reachable on port 8000. Run uvicorn in Terminal 1."));
  }, []);

  useEffect(() => {
    const bodyPayload: any = {
      engineering_type: engineeringType,
      max_age_years: maxAgeYears,
      buffer_meters: bufferMeters,
      strict_visibility: strictVisibility,
    };
    if (drawnCoords.length >= 2 && drawMode !== "polygon") {
      bodyPayload.custom_route_geom = { type: "LineString", coordinates: drawnCoords };
      bodyPayload.route_name = isDeflected ? "AI-Optimized Heritage Bypass Alignment" : "Engineer Custom Realignment Sketch";
    }

    fetch(`${API_BASE}/api/simulate/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyPayload),
    })
      .then((r) => r.json())
      .then((data) => {
        setCorridorData(data);
        setSelectedSegment(data.analysis.segments[0] || null);
      })
      .catch(() => setErrorMsg("Failed to run spatial simulation."));
  }, [projectId, engineeringType, maxAgeYears, bufferMeters, strictVisibility, drawnCoords, drawMode, isDeflected, refreshTrigger]);

  // Render Interactive GIS Map
  useEffect(() => {
    if (activeTab !== "map" || !corridorData || !mapContainerRef.current) return;
    let isMounted = true;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!isMounted || !mapContainerRef.current) return;

      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }

      const map = L.map(mapContainerRef.current).setView([11.232, 75.862], 12);

      const tileUrl =
        basemap === "satellite"
          ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";

      L.tileLayer(tileUrl, { attribution: "Tiles &copy; Esri" }).addTo(map);

      map.on("click", (e: any) => {
        if (drawMode === "route" || drawMode === "polygon") {
          setDrawnCoords((prev) => [...prev, [Number(e.latlng.lng.toFixed(5)), Number(e.latlng.lat.toFixed(5))]]);
        }
      });

      // 1. Survey Polygons
      if (corridorData.surveys) {
        L.geoJSON(corridorData.surveys, {
          style: (feature: any) => {
            const isPos = feature?.properties?.finding_type === "POSITIVE";
            const isPoor = feature?.properties?.visibility_poor;
            return {
              color: isPos ? "#dc2626" : isPoor ? "#d97706" : "#0d9488",
              weight: 2,
              dashArray: "5 5",
              fillOpacity: basemap === "satellite" ? 0.32 : 0.18,
            };
          },
          onEachFeature: (feature: any, layer: any) => {
            const p = feature.properties;
            layer.bindPopup(
              `<div style="font-size:12px;line-height:1.4">
                <strong>${p.zone_id} (${p.finding_type})</strong><br/>
                <strong>Date:</strong> ${p.survey_date} | <strong>Method:</strong> ${p.methodology}<br/>
                <em>${p.summary}</em><br/>
                <span style="color:#b45309">Source: ${p.source_doc} (Page ${p.page_number})</span>
              </div>`
            );
          },
        }).addTo(map);
      }

      // 2. Original Route
      if (showOriginal && corridorData.original_route) {
        L.geoJSON(corridorData.original_route, {
          style: { color: basemap === "satellite" ? "#e2e8f0" : "#475569", weight: 3, dashArray: "6 6" },
        }).addTo(map);
      }

      // 3. Color-coded Revised Route Segments
      const boundsGroup = L.featureGroup();
      corridorData.analysis.segments.forEach((seg: any) => {
        const meta = STATUS_META[seg.segment_status] || { color: "#334155", label: seg.segment_status };
        const layer = L.geoJSON(seg.geometry_wgs84, {
          style: { color: meta.color, weight: 7, opacity: 0.95 },
        });
        layer.on("click", (ev: any) => {
          if (drawMode === "none") {
            L.DomEvent.stopPropagation(ev);
            setSelectedSegment(seg);
          }
        });
        layer.bindTooltip(`${meta.label}: ${(seg.length_meters / 1000).toFixed(2)} km | Est. ₹${seg.est_fieldwork_lakhs}L`);
        layer.addTo(map);
        boundsGroup.addLayer(layer);
      });

      // Draw active sketch vertices or polygon preview
      drawnCoords.forEach(([lon, lat], idx) => {
        L.circleMarker([lat, lon], { radius: 6, color: "#0f172a", fillColor: "#f59e0b", fillOpacity: 1 })
          .bindTooltip(`Vertex ${idx + 1}`)
          .addTo(map);
      });
      if (drawMode === "polygon" && drawnCoords.length >= 3) {
        L.polygon(
          drawnCoords.map(([lon, lat]) => [lat, lon]),
          { color: "#4f46e5", fillOpacity: 0.25 }
        ).addTo(map);
      }

      // 4. Kilometer Chainage Markers
      if (showChainage && corridorData.chainage_markers) {
        corridorData.chainage_markers.forEach((cm: any) => {
          const icon = L.divIcon({
            className: "",
            html: `<div style="background:#0f172a;color:#fff;font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;border:1px solid #f59e0b;white-space:nowrap;transform:translate(-50%,-50%)">${cm.label}</div>`,
          });
          L.marker(cm.coords, { icon }).addTo(map);
        });
      }

      if (drawMode === "none" && boundsGroup.getLayers().length > 0) {
        map.fitBounds(boundsGroup.getBounds().pad(0.22));
      }

      leafletMapRef.current = map;
    })();

    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [activeTab, corridorData, basemap, showOriginal, showChainage, drawMode, drawnCoords]);

  // Trigger Geometric Heritage Bypass Deflection
  const handleOptimizeBypass = async () => {
    const res = await fetch(`${API_BASE}/api/suggest-deflection/${projectId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buffer_meters: bufferMeters }),
    });
    const data = await res.json();
    setDrawnCoords(data.deflected_geometry.coordinates);
    setIsDeflected(true);
    setDrawMode("none");
  };

  // Save Digitized Polygon for an Unmapped PDF Evidence Record
  const saveDigitizedPolygon = async () => {
    if (!digitizingRecord || drawnCoords.length < 3) return;
    const closedRing = [...drawnCoords, drawnCoords[0]];
    await fetch(`${API_BASE}/api/attach-polygon/${projectId}/${digitizingRecord.evidence_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geometry: { type: "Polygon", coordinates: [closedRing] } }),
    });
    setDigitizingRecord(null);
    setDrawnCoords([]);
    setDrawMode("none");
    setRefreshTrigger((n) => n + 1);
  };

  const handleToggleVerify = async (evidenceId: string) => {
    await fetch(`${API_BASE}/api/verify-record/${projectId}/${evidenceId}`, { method: "POST" });
    setRefreshTrigger((n) => n + 1);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);
    setPdfUrl(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/api/ingest-pdf/${projectId}`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (data.extraction.records?.[0]?.page_number) setPdfPage(data.extraction.records[0].page_number);
      setRefreshTrigger((n) => n + 1);
    } catch (err: any) {
      setErrorMsg(err.message || "PDF extraction failed. Verify GEMINI_API_KEY in FastAPI terminal.");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadAuditExport = (format: "geojson" | "csv") => {
    if (!corridorData) return;
    const isJson = format === "geojson";
    const content = isJson
      ? JSON.stringify(
          {
            type: "FeatureCollection",
            features: corridorData.analysis.segments.map((s: any) => ({
              type: "Feature",
              properties: {
                status: s.segment_status,
                length_m: s.length_meters,
                est_lakhs: s.est_fieldwork_lakhs,
                delay_days: s.est_delay_days,
                citation: s.source_citation,
              },
              geometry: s.geometry_wgs84,
            })),
          },
          null,
          2
        )
      : [
          ["Status", "Length (m)", "Share (%)", "Est Cost (INR Lakhs)", "Critical Delay (Days)", "Source Citation", "Protocol"],
          ...corridorData.analysis.segments.map((s: any) => [
            s.segment_status,
            s.length_meters,
            s.percentage_of_route,
            s.est_fieldwork_lakhs,
            s.est_delay_days,
            `"${s.source_citation}"`,
            `"${s.recommended_protocol}"`,
          ]),
        ]
          .map((r) => r.join(","))
          .join("\n");

    const blob = new Blob([content], { type: isJson ? "application/json" : "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `SthalaTrace_${projectId}_Deliverable.${format}`;
    a.click();
  };

  const allRecords = corridorData?.all_records || [];
  const verifiedCount = allRecords.filter((r: any) => r.verified).length;
  const hasConflict = corridorData?.analysis?.segments?.some((s: any) => s.segment_status === "DIRECT_HERITAGE_CONFLICT");

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans">
      {/* Command Header */}
      <header className="bg-slate-950 text-white px-6 py-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">
                Provenance GIS
              </span>
              <h1 className="text-lg font-bold tracking-tight">SthalaTrace</h1>
            </div>
            <p className="text-[11px] text-slate-400">Archaeological Survey Evidence & Corridor Gap Intelligence</p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5">
            <FolderGit2 className="w-4 h-4 text-amber-400" />
            <select
              value={projectId}
              onChange={(e) => {
                const nextId = e.target.value;
                setProjectId(nextId);
                setDrawnCoords([]);
                setIsDeflected(false);
                setDrawMode("none");
                const found = projects.find((p) => p.id === nextId);
                if (found) setEngineeringType(found.default_engineering);
              }}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                  {p.name} ({p.region})
                </option>
              ))}
            </select>
          </div>
        </div>

        <nav className="flex gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
          {[
            { id: "map", label: "1. Corridor GIS & Bypass Optimizer", icon: MapIcon },
            { id: "ingest", label: `2. Evidence Vault (${allRecords.length})`, icon: FileText },
            { id: "report", label: "3. Budget & Regulatory Deliverable", icon: ClipboardCheck },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeTab === tab.id ? "bg-amber-500 text-slate-950 shadow" : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {tab.label}
              </button>
            );
          })}
        </nav>
      </header>

      {errorMsg && (
        <div className="bg-red-600 text-white px-6 py-2 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {errorMsg}
        </div>
      )}

      {/* EXECUTIVE KPI STRIP + CHAINAGE BAR */}
      {corridorData?.analysis && (
        <div className="bg-white border-b border-slate-200 px-6 py-3 space-y-2.5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Active Alignment Length</span>
              <span className="text-base font-extrabold text-slate-900">
                {(corridorData.analysis.total_length_meters / 1000).toFixed(2)} km
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <IndianRupee className="w-3 h-3 text-amber-600" /> Est. Fieldwork Budget
              </span>
              <span className="text-base font-extrabold text-slate-900">
                ₹{corridorData.analysis.total_est_lakhs} Lakhs
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-red-600" /> Critical Clearance Window
              </span>
              <span className="text-base font-extrabold text-slate-900">
                {corridorData.analysis.critical_path_days} Days
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Archaeologist Sign-Off</span>
              <span className="text-base font-extrabold text-emerald-700">
                {verifiedCount} / {allRecords.length} Records Verified
              </span>
            </div>
          </div>

          <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-200">
            {corridorData.analysis.segments.map((seg: any, i: number) => {
              const meta = STATUS_META[seg.segment_status] || { bg: "bg-slate-500", label: seg.segment_status };
              return (
                <div
                  key={i}
                  onClick={() => {
                    setActiveTab("map");
                    setSelectedSegment(seg);
                  }}
                  style={{ width: `${seg.percentage_of_route}%` }}
                  title={`${meta.label}: ${(seg.length_meters / 1000).toFixed(2)} km (${seg.percentage_of_route}%)`}
                  className={`${meta.bg} h-full cursor-pointer hover:opacity-80 transition border-r border-white/40`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 1: CORRIDOR GIS & HERITAGE BYPASS OPTIMIZER */}
      {activeTab === "map" && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-8 flex flex-col relative">
            {/* Policy & Action Toolbar */}
            <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-amber-600" />
                  <select
                    value={engineeringType}
                    onChange={(e) => setEngineeringType(e.target.value)}
                    className="border border-slate-300 rounded px-2 py-1 font-semibold bg-slate-50"
                  >
                    <option value="Deep Cut-and-Fill">Deep Cut-and-Fill (&gt;2m)</option>
                    <option value="Deep Pier Piling (>12m)">Deep Pier Piling (&gt;12m)</option>
                    <option value="Surface Embankment">Shallow Surface (&lt;1.5m)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <Scale className="w-3.5 h-3.5 text-amber-600" />
                  <select
                    value={maxAgeYears}
                    onChange={(e) => setMaxAgeYears(Number(e.target.value))}
                    className="border border-slate-300 rounded px-2 py-1 font-semibold bg-slate-50"
                  >
                    <option value={5}>Max Age: 5 Yrs</option>
                    <option value={7}>Max Age: 7 Yrs</option>
                    <option value={10}>Max Age: 10 Yrs</option>
                    <option value={15}>Max Age: 15 Yrs</option>
                  </select>
                </div>

                <select
                  value={bufferMeters}
                  onChange={(e) => setBufferMeters(Number(e.target.value))}
                  className="border border-slate-300 rounded px-2 py-1 font-semibold bg-slate-50"
                >
                  <option value={0}>Buffer: 0m</option>
                  <option value={100}>Buffer: 100m (ASI)</option>
                  <option value={150}>Buffer: 150m (EIA)</option>
                  <option value={300}>Buffer: 300m (Regulated)</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {hasConflict && (
                  <button
                    onClick={handleOptimizeBypass}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Compute Heritage Bypass
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsDeflected(false);
                    if (drawMode !== "route") {
                      setDrawnCoords([]);
                      setDrawMode("route");
                    } else {
                      setDrawMode("none");
                    }
                  }}
                  className={`px-2.5 py-1 rounded font-bold flex items-center gap-1 ${
                    drawMode === "route" ? "bg-amber-500 text-slate-950" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  }`}
                >
                  <PenTool className="w-3.5 h-3.5" />
                  {drawMode === "route" ? "Done Sketching" : "Sketch Route"}
                </button>

                {(drawnCoords.length > 0 || isDeflected) && (
                  <button
                    onClick={() => {
                      setDrawnCoords([]);
                      setIsDeflected(false);
                      setDrawMode("none");
                    }}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 py-1 rounded font-semibold flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset
                  </button>
                )}

                <button
                  onClick={() => setBasemap(basemap === "topo" ? "satellite" : "topo")}
                  className="bg-slate-900 text-white px-2.5 py-1 rounded font-semibold flex items-center gap-1 hover:bg-slate-800"
                >
                  {basemap === "topo" ? <Satellite className="w-3.5 h-3.5 text-amber-400" /> : <Compass className="w-3.5 h-3.5 text-amber-400" />}
                  {basemap === "topo" ? "Satellite" : "Terrain"}
                </button>
              </div>
            </div>

            {drawMode === "route" && (
              <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-bold flex items-center justify-between">
                <span>ROUTE SANDBOX: Click points on map to test a new alignment ({drawnCoords.length} points).</span>
                <button onClick={() => setDrawMode("none")} className="underline">Finish</button>
              </div>
            )}

            {drawMode === "polygon" && digitizingRecord && (
              <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between">
                <span>
                  DIGITIZING BOUNDARY FOR {digitizingRecord.zone_id} (Page {digitizingRecord.page_number}): Click 3+ corners on map ({drawnCoords.length} vertices).
                </span>
                <div className="flex gap-3">
                  {drawnCoords.length >= 3 && (
                    <button onClick={saveDigitizedPolygon} className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded font-extrabold">
                      Save Polygon & Re-Analyze
                    </button>
                  )}
                  <button onClick={() => { setDrawMode("none"); setDrawnCoords([]); }} className="underline">Cancel</button>
                </div>
              </div>
            )}

            <div ref={mapContainerRef} className="flex-1 min-h-[520px] z-0" />
          </div>

          {/* Right Segment & Cost Inspector */}
          <aside className="lg:col-span-4 bg-white border-l border-slate-200 p-5 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-700" /> Summary by Evidence Category
              </h2>
              <button
                onClick={() => downloadAuditExport("geojson")}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold px-2.5 py-1 rounded flex items-center gap-1"
              >
                <Download className="w-3 h-3" /> GeoJSON
              </button>
            </div>

            {isDeflected && (
              <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-lg text-xs text-emerald-900">
                <strong>Heritage Deflection Active:</strong> Alignment shifted outside statutory exclusion buffer. Direct heritage conflict eliminated.
              </div>
            )}

            <div className="space-y-2">
              {corridorData?.analysis?.segments?.map((seg: any, i: number) => {
                const meta = STATUS_META[seg.segment_status] || { label: seg.segment_status, bg: "bg-slate-600" };
                const isSelected = selectedSegment === seg;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedSegment(seg)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      isSelected ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded text-white ${meta.bg}`}>
                        {meta.label}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-800">
                        {(seg.length_meters / 1000).toFixed(2)} km ({seg.percentage_of_route}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5">
                      <span>Block: <strong>{seg.zone_id}</strong> ({seg.approx_chainage})</span>
                      <span className="font-semibold text-slate-700">
                        Est. ₹{seg.est_fieldwork_lakhs}L &bull; {seg.est_delay_days}d
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedSegment && (
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                    Deterministic Audit Rationale
                  </span>
                  <span className="text-xs font-mono text-slate-400">Block {selectedSegment.zone_id}</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-200">{selectedSegment.explanation}</p>
                <div className="bg-slate-800 p-2.5 rounded text-xs border border-slate-700 space-y-1">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Required Field Protocol:</span>
                  <span className="text-amber-300 font-medium block">{selectedSegment.recommended_protocol}</span>
                  <span className="text-[11px] text-slate-300 block pt-1">
                    Estimated Survey Cost: <strong>₹{selectedSegment.est_fieldwork_lakhs} Lakhs</strong> | Mobilization: <strong>{selectedSegment.est_delay_days} Days</strong>
                  </span>
                </div>
                {selectedSegment.source_citation !== "No prior survey coverage" && (
                  <button
                    onClick={() => {
                      const match = selectedSegment.source_citation.match(/Page (\d+)/);
                      if (match) setPdfPage(parseInt(match[1], 10));
                      setActiveTab("ingest");
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 rounded flex items-center justify-center gap-1.5"
                  >
                    Inspect Source Citation in Evidence Vault <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </aside>
        </main>
      )}

      {/* TAB 2: EVIDENCE VAULT & GEMINI PDF EXTRACTOR */}
      {activeTab === "ingest" && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-6 bg-slate-800 flex flex-col min-h-[600px] border-r border-slate-300">
            <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs flex items-center justify-between">
              <span>Source Survey Report (Page {pdfPage})</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPdfPage(p)}
                    className={`px-2 py-0.5 rounded ${pdfPage === p ? "bg-amber-500 text-slate-950 font-bold" : "bg-slate-800"}`}
                  >
                    P.{p}
                  </button>
                ))}
              </div>
            </div>
            <iframe key={`${pdfUrl}-${pdfPage}`} src={`${pdfUrl}#page=${pdfPage}`} className="w-full flex-1" />
          </div>

          <div className="lg:col-span-6 p-5 overflow-y-auto space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Persistent Evidence Provenance Vault</h2>
                <p className="text-xs text-slate-500">
                  Ingest PDFs with <strong>Gemini 2.5 Flash</strong>, verify citations, or digitize unmapped survey zones onto the GIS canvas.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    await fetch(`${API_BASE}/api/reset-state`, { method: "POST" });
                    setRefreshTrigger((n) => n + 1);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1"
                  title="Reset demo database"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  {isUploading ? "Extracting..." : "Ingest New PDF"}
                  <input type="file" accept=".pdf" onChange={handlePdfUpload} className="hidden" disabled={isUploading} />
                </label>
              </div>
            </div>

            {allRecords.map((rec: any) => {
              const hasGeom = corridorData?.surveys?.features?.some((f: any) => f.properties.evidence_id === rec.evidence_id);
              return (
                <div key={rec.evidence_id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded">{rec.zone_id}</span>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          rec.finding_type === "POSITIVE" ? "bg-red-100 text-red-800" : "bg-teal-100 text-teal-800"
                        }`}
                      >
                        {rec.finding_type}
                      </span>
                      <button
                        onClick={() => setPdfPage(rec.page_number)}
                        className="text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200"
                      >
                        {rec.source_doc} &bull; Page {rec.page_number} &rarr;
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setDigitizingRecord(rec);
                          setDrawnCoords([]);
                          setDrawMode("polygon");
                          setActiveTab("map");
                        }}
                        className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        {hasGeom ? "Redraw Zone" : "Digitize on Map"}
                      </button>
                      <button
                        onClick={() => handleToggleVerify(rec.evidence_id)}
                        className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded border ${
                          rec.verified ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-700 border-slate-300"
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {rec.verified ? "Verified" : "Verify"}
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-semibold text-slate-900">{rec.summary}</p>
                  <blockquote className="text-xs italic bg-slate-50 border-l-2 border-slate-400 pl-2.5 py-1 text-slate-600">
                    &ldquo;{rec.verbatim_quote}&rdquo;
                  </blockquote>
                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <strong>Date:</strong> {rec.survey_date} &bull; <strong>Method:</strong> {rec.methodology}
                    </span>
                    {rec.verified_by && (
                      <span className="text-emerald-700 font-semibold">Signed off by: {rec.verified_by}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      )}

      {/* TAB 3: AUDITABLE DELIVERABLE & BUDGET REPORT */}
      {activeTab === "report" && corridorData && (
        <main className="max-w-5xl mx-auto w-full p-6">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600">
                  SthalaTrace Regulatory & Engineering Deliverable
                </span>
                <h2 className="text-2xl font-bold text-slate-900 mt-1">{corridorData.project.name}</h2>
                <p className="text-xs text-slate-600 mt-1">
                  Client: <strong>{corridorData.project.client}</strong> &bull; Works:{" "}
                  <strong>{corridorData.analysis.engineering_type}</strong> &bull; Total Est. Fieldwork:{" "}
                  <strong>₹{corridorData.analysis.total_est_lakhs} Lakhs</strong>
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <button
                  onClick={() => downloadAuditExport("csv")}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button
                  onClick={() => downloadAuditExport("geojson")}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> GeoJSON
                </button>
                <button
                  onClick={() => window.print()}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-800"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-xs text-amber-950 flex gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-700" />
              <div>
                <strong>Epistemic & Legal Safeguard:</strong> Absence of recorded findings in prior surveys does not
                establish the absence of buried archaeological remains. This report partitions documentary and spatial
                evidence under deterministic policy rules to guide statutory specialist fieldwork.
              </div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b-2 border-slate-300 uppercase text-slate-500">
                  <th className="py-2 pr-3">Audit Status</th>
                  <th className="py-2 px-3">Length</th>
                  <th className="py-2 px-3">Est. Cost</th>
                  <th className="py-2 px-3">Delay</th>
                  <th className="py-2 px-3">Source Citation</th>
                  <th className="py-2 pl-3">Deterministic Rationale & Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {corridorData.analysis.segments.map((seg: any, idx: number) => {
                  const meta = STATUS_META[seg.segment_status] || { label: seg.segment_status, bg: "bg-slate-600" };
                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-3 pr-3 font-bold">
                        <span className={`inline-block px-2 py-1 rounded text-white ${meta.bg}`}>{meta.label}</span>
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">{(seg.length_meters / 1000).toFixed(2)} km</td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">₹{seg.est_fieldwork_lakhs}L</td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">{seg.est_delay_days}d</td>
                      <td className="py-3 px-3 font-medium text-slate-700">{seg.source_citation}</td>
                      <td className="py-3 pl-3 text-slate-600 space-y-1">
                        <p>{seg.explanation}</p>
                        <p className="font-semibold text-slate-900">Protocol: {seg.recommended_protocol}</p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </main>
      )}
    </div>
  );
}

