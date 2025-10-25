import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { CountryDropdown, RegionDropdown } from "react-country-region-selector";


export default function Profile() {
  const fileRef = useRef(null);
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    about_me: "",
    country: "",
    city: "",
    languages: "",       // now a plain comma-separated string
    gender: "",          // free text input
    profile_picture: ""
  });
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    async function init() {
      const u = await api.ownerMe();
      setMe(u);
      setForm({
        name: u.name || "",
        phone: u.phone || "",
        about_me: u.about_me || "",
        country: u.country || "",
        city: u.city || "",
        languages: u.languages || "",  // keep whatever is stored (string)
        gender: u.gender || "",
        profile_picture: u.profile_picture || ""
      });
    }
    init();
  }, []);

  async function handleUploadProfile(fileList) {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploading(true);
    setUploadErr("");
    try {
      const presign = await api.presignProfileUpload({
        filename: file.name,
        contentType: file.type || "application/octet-stream"
      });

      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      if (!putRes.ok) throw new Error(`S3 PUT failed ${putRes.status}`);

      // Update preview with the new URL
      setForm(prev => ({ ...prev, profile_picture: presign.publicUrl }));
      setMsg("Profile image uploaded. Remember to Save changes.");
    } catch (e) {
      console.error(e);
      setUploadErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  
  async function save(e) {
    e.preventDefault();
    setMsg("");
    const payload = {
      name: form.name || null,
      phone: form.phone || null,
      about_me: form.about_me || null,
      country: form.country || null,
      city: form.city || null,
      // backend accepts a string for languages (comma-separated)
      languages: form.languages || null,
      gender: form.gender || null,
      profile_picture: form.profile_picture || null
    };
    await api.profileUpdate(payload)
    setMsg("Saved");
  }

  if (!me) return <div className="container py-4">Loading...</div>;

  return (
    <div className="container py-4">
      <div className="row g-4">
        <div className="col-12 col-md-4">
          <div className="card">
            <div className="card-body d-flex flex-column align-items-center">
              <div className="rounded-circle overflow-hidden" style={{ width: 128, height: 128 }}>
                <img
                  src={form.profile_picture || "https://placehold.co/128x128?text=Profile"}
                  alt="profile"
                  className="w-100 h-100"
                  style={{ objectFit: "cover" }}
                />
              </div>
              <input
                ref={fileRef}
                type="file"
                className="d-none"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.length) handleUploadProfile(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="btn btn-outline-secondary mt-3"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload new image"}
              </button>
              {uploadErr && <div className="text-danger small mt-2">{uploadErr}</div>}
            </div>
          </div>
        </div>

        <div className="col-12 col-md-8">
          <div className="card">
            <div className="card-body">
              <h6 className="fw-bold mb-3">Profile</h6>
              <form onSubmit={save}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Name</label>
                    <input
                      className="form-control"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">Phone</label>
                    <input
                      className="form-control"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label">About me</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={form.about_me}
                      onChange={e => setForm({ ...form, about_me: e.target.value })}
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Country</label>
                    <CountryDropdown
                      value={form.country}
                      onChange={(val) => setForm(prev => ({ ...prev, country: val, city: "" }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label">City</label>
                    <RegionDropdown
                      country={form.country}
                      value={form.city}
                      onChange={(val) => setForm(prev => ({ ...prev, city: val }))}
                      className="form-select"
                      disableWhenEmpty
                      defaultOptionLabel="Select Region"
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Gender</label>
                    <input
                      className="form-control"
                      value={form.gender}
                      onChange={e => setForm({ ...form, gender: e.target.value })}
                      placeholder="female, male, or don't want to tell"
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Languages</label>
                    <input
                      className="form-control"
                      value={form.languages}
                      onChange={e => setForm({ ...form, languages: e.target.value })}
                      placeholder="Comma separated, e.g., English, Mandarin"
                    />
                  </div>

                  <div className="col-12 d-flex justify-content-end gap-2">
                    <button className="btn btn-danger" type="submit">Save</button>
                    {msg && <span className="text-success align-self-center">{msg}</span>}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
