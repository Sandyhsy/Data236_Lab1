import { data } from "react-router-dom";

// Global API helper using Fetch. Cookies included for session-based auth.
const BASE = process.env.REACT_APP_API_URL || "http://localhost:4000/api";

async function req(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export const api = {
  me: () => req("/auth/me"),
  signup: (data) => req("/auth/signup", { method: "POST", body: data }),
  login: (data) => req("/auth/login", { method: "POST", body: data }),
  logout: () => req("/auth/logout", { method: "POST" }),

  ownerMe: () => req("/owner/me"),
  TravelerMe: () => req("/profile"),
  ownerUpdate: (data) => req("/owner/me", { method: "PUT", body: data }),
  dashboard: () => req("/owner/dashboard"),

  myProperties: () => req("/properties/mine"),
  myfavorites: () => req("/favorites"),
  loadAllProperties: () => req("/search"),
  searchProperty: (data) => req("/search/properties", { method: "POST", body: data }),
  createProperty: (data) => req("/properties", { method: "POST", body: data }),
  updateProperty: (id, data) => req(`/properties/${id}`, { method: "PUT", body: data }),
  deleteProperty: (id) => req(`/properties/${id}`, { method: "DELETE" }),
  deleteS3Object: (url) => req("/uploads/s3-delete", { method: "POST", body: { url } }),
  profileUpdate: (data) => req("/profile", { method: "PUT", body: data }),
  getProperty: (id) => req(`/properties/${id}`),
  getbookings: () => req("/bookings"),
  getbookingStatus: () => req("/bookings/status"),
  getBookedDates: (id) => req(`/bookings/bookedDates/${id}`),
  createBooking: (data) => req("/bookings", { method: "POST", body: data }),

  presignUpload: ({ property_id, filename, contentType }) => req("/uploads/s3-presign", { method: "POST", body: { property_id, filename, contentType } }),
  // temp presign for create mode (no property_id yet)
  presignUploadTemp: ({ filename, contentType }) => req("/uploads/s3-presign-temp", { method: "POST", body: { filename, contentType } }),
  // finalize temp uploads after property is created
  finalizeTempUploads: ({ property_id, tempUrls }) => req("/uploads/finalize", { method: "POST", body: { property_id, tempUrls } }),

  // Images for a property
  getPropertyImages: (propertyId) => req(`/properties/${propertyId}/images`),
  setPropertyImages: (propertyId, urls) => req(`/properties/${propertyId}/images`, { method: "PUT", body: { urls } }),

  // Profile picture presign
  presignProfileUpload: ({ filename, contentType }) => req("/uploads/s3-presign-profile", { method: "POST", body: { filename, contentType } }),

 // In api.js
addFavorite: (property_id, user_id) => req("/favorites", { method: "POST", body: { property_id, user_id } }),


  incoming: () => req("/bookings/incoming"),
  history: () => req("/bookings/history"),
  acceptBooking: (id) => req(`/bookings/${id}/accept`, { method: "PATCH" }),
  cancelBooking: (id) => req(`/bookings/${id}/cancel`, { method: "PATCH" })
};