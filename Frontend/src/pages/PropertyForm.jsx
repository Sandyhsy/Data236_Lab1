import React, { useEffect, useState, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";

// Minimal initial form state
const empty = {
  name: "", type: "", description: "", location: "", amenities: "",
  price_per_night: "", bedrooms: "", bathrooms: "",
  availability_start: "", availability_end: ""
};

export default function PropertyForm({ edit }) {
  const { state } = useLocation();
  const nav = useNavigate();
  const { id } = useParams();

  const [form, setForm] = useState(empty);
  const [imageText, setImageText] = useState(""); // persisted URLs, one per line
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const fileRef = useRef(null);
  const [stagedUrls, setStagedUrls] = useState([]); // create-mode temporary URLs

  // New: simple error state for date validation
  const [errors, setErrors] = useState({});

  // Parse persisted URLs
  const urls = useMemo(
    () => imageText.split("\n").map(s => s.trim()).filter(Boolean),
    [imageText]
  );

  // Preview = staged (create mode) + persisted
  const preview = useMemo(() => [...stagedUrls, ...urls], [stagedUrls, urls]);

  useEffect(() => {
    async function init() {
      if (edit && state?.p) {
        const p = state.p;
        setForm({
          name: p.name || "",
          type: p.type || "",
          description: p.description || "",
          location: p.location || "",
          amenities: p.amenities || "",
          price_per_night: p.price_per_night || "",
          bedrooms: p.bedrooms ?? "",
          bathrooms: p.bathrooms ?? "",
          availability_start: p.availability_start || "",
          availability_end: p.availability_end || ""
        });
        const imgs = await api.getPropertyImages(p.property_id).catch(() => []);
        setImageText(imgs.map(i => i.url).join("\n"));
      }
    }
    init();
  }, [edit, state]);

  // Persist image URLs to MySQL property_images
  async function syncUrlsToServer(propertyId, list) {
    await api.setPropertyImages(propertyId, list);
  }

  // Handle S3 upload (edit: properties/{id}/; create: staging/)
  async function handleUploadFiles(fileList) {
    setUploadErr("");
    setUploading(true);
    try {
      if (edit && id) {
        // Edit mode: upload and persist immediately
        let working = [...urls];
        for (const file of Array.from(fileList)) {
          const presign = await api.presignUpload({
            property_id: Number(id),
            filename: file.name,
            contentType: file.type || "application/octet-stream"
          });
          const putRes = await fetch(presign.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file
          });
          if (!putRes.ok) throw new Error(`Upload failed: ${file.name}`);
          working.push(presign.publicUrl);
          await syncUrlsToServer(Number(id), working);
          setImageText(working.join("\n"));
        }
        return;
      }

      // Create mode: upload to staging, show immediately
      const added = [];
      for (const file of Array.from(fileList)) {
        const presign = await api.presignUploadTemp({
          filename: file.name,
          contentType: file.type || "application/octet-stream"
        });
        const putRes = await fetch(presign.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file
        });
        if (!putRes.ok) throw new Error(`Upload failed: ${file.name}`);
        added.push(presign.publicUrl);
      }
      setStagedUrls(prev => [...prev, ...added]);
    } catch (e) {
      console.error(e);
      setUploadErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // Remove an image URL (handles staged or persisted)
  async function removeUrl(u) {
    // Best-effort delete from S3
    try { await api.deleteS3Object(u); } catch (_) {}
    // If staged (create mode), remove locally
    if (stagedUrls.includes(u)) {
      setStagedUrls(stagedUrls.filter(x => x !== u));
      return;
    }
    // Otherwise update persisted list and sync
    const next = urls.filter(x => x !== u);
    setImageText(next.join("\n"));
    if (edit && id) {
      await api.setPropertyImages(Number(id), next);
    }
  }

  // New: validate required dates and ordering
  function validate() {
    const errs = {};
    if (!form.availability_start) errs.availability_start = "Availability start is required.";
    if (!form.availability_end) errs.availability_end = "Availability end is required.";
    if (form.availability_start && form.availability_end) {
      const s = new Date(form.availability_start);
      const e = new Date(form.availability_end);
      if (s > e) errs.dateRange = "End date must be on or after start date.";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      window.alert(Object.values(errs).join("\n")); // simple blocking alert
      return false;
    }
    return true;
  }

  // Create or update property
  const save = async (e) => {
    e.preventDefault();
    setMsg("");

    // Block submit if dates invalid/missing
    if (!validate()) return;

    const payload = {
      ...form,
      price_per_night: form.price_per_night ? Number(form.price_per_night) : null,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null
    };

    if (edit) {
      await api.updateProperty(id, payload);
      await syncUrlsToServer(Number(id), urls);
      setMsg("Saved");
    } else {
      const created = await api.createProperty(payload);
      let finalUploads = [];
      if (stagedUrls.length > 0) {
        const out = await api.finalizeTempUploads({
          property_id: created.property_id,
          tempUrls: stagedUrls
        });
        finalUploads = Array.isArray(out?.finalUrls) ? out.finalUrls : [];
      }
      const all = [...urls, ...finalUploads];
      if (all.length > 0) {
        await syncUrlsToServer(created.property_id, all);
      }
      nav("/properties");
    }
  };

  return (
    <div className="container py-4">
      <div className="card">
        <div className="card-body">
          <h6 className="fw-bold mb-3">{edit ? "Edit property" : "Add property"}</h6>

          <form onSubmit={save}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label">Name</label>
                <input className="form-control" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
              </div>

              <div className="col-md-6">
                <label className="form-label">Type</label>
                <input className="form-control" value={form.type} onChange={e=>setForm({...form, type:e.target.value})} placeholder="Apartment, House, Studio" />
              </div>

              <div className="col-md-6">
                <label className="form-label">Location</label>
                <input className="form-control" value={form.location} onChange={e=>setForm({...form, location:e.target.value})} placeholder="City, Country" />
              </div>

              <div className="col-md-6">
                <label className="form-label">Price per night (USD)</label>
                <input className="form-control" type="number" step="0.01" value={form.price_per_night} onChange={e=>setForm({...form, price_per_night:e.target.value})} />
              </div>

              <div className="col-md-6">
                <label className="form-label">Bedrooms</label>
                <input className="form-control" type="number" value={form.bedrooms} onChange={e=>setForm({...form, bedrooms:e.target.value})} />
              </div>

              <div className="col-md-6">
                <label className="form-label">Bathrooms</label>
                <input className="form-control" type="number" value={form.bathrooms} onChange={e=>setForm({...form, bathrooms:e.target.value})} />
              </div>

              <div className="col-md-6">
                <label className="form-label">Availability start</label>
                <input
                  className={`form-control ${errors.availability_start ? "is-invalid" : ""}`}
                  type="date"
                  value={form.availability_start}
                  onChange={e=>setForm({...form, availability_start:e.target.value})}
                  required
                />
                {errors.availability_start && <div className="invalid-feedback">{errors.availability_start}</div>}
              </div>

              <div className="col-md-6">
                <label className="form-label">Availability end</label>
                <input
                  className={`form-control ${(errors.availability_end || errors.dateRange) ? "is-invalid" : ""}`}
                  type="date"
                  min={form.availability_start || undefined}
                  value={form.availability_end}
                  onChange={e=>setForm({...form, availability_end:e.target.value})}
                  required
                />
                {(errors.availability_end || errors.dateRange) && (
                  <div className="invalid-feedback">
                    {errors.availability_end || errors.dateRange}
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <label className="form-label">Amenities (comma separated)</label>
                <input className="form-control" value={form.amenities} onChange={e=>setForm({...form, amenities:e.target.value})} placeholder="WiFi, Kitchen, Heating" />
              </div>

              <div className="col-md-6">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
              </div>

              {/* Upload images */}
              <div className="col-12">
                <label htmlFor="fileInput" className="form-label">Property images</label>
                <div className="d-flex gap-2 align-items-center">
                  <input
                    id="fileInput"
                    ref={fileRef}
                    className="d-none"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handleUploadFiles(files);
                        e.target.value = "";
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : "Choose files"}
                  </button>
                  <span className="text-secondary small">JPG, PNG, WEBP supported.</span>
                </div>
                {uploadErr && <div className="text-danger small mt-2">{uploadErr}</div>}
              </div>

              {/* Preview grid (no filenames, only Remove button) */}
              <div className="col-12">
                <div className="row g-2">
                  {preview.map(u => (
                    <div className="col-6 col-md-3" key={u}>
                      <div className="card position-relative">
                        <img src={u} alt="preview" className="img-cover" />
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary position-absolute top-0 end-0 m-2"
                          onClick={() => removeUrl(u)}
                          disabled={uploading}
                          title="Remove"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {preview.length === 0 && <div className="text-secondary small">No images yet.</div>}
                </div>
              </div>

              <div className="col-12 d-flex justify-content-end gap-2">
                <button className="btn btn-danger" type="submit">{edit ? "Save" : "Create"}</button>
                {msg && <span className="text-success align-self-center">{msg}</span>}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}