import { Router } from "express";
import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuid } from "uuid";
import dotenv from "dotenv";
import { requireOwner } from "../middleware/requireOwner.js";
import { requireAuth } from "../middleware/requireAuth.js";

dotenv.config();

const router = Router();
const s3 = new S3Client({ region: process.env.AWS_REGION });

function pickExt(nameOrKey) {
  const n = (nameOrKey || "").toLowerCase();
  const allowed = ["jpg", "jpeg", "png", "webp", "gif"];
  const ext = n.includes(".") ? n.split(".").pop() : "";
  return allowed.includes(ext) ? ext : "jpg";
}

// ---------- EDIT MODE: presign directly to properties/{property_id}/ ----------
router.post("/s3-presign", requireOwner, async (req, res) => {
  const { property_id, filename, contentType } = req.body;
  if (!property_id || !filename || !contentType) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!contentType.startsWith("image/")) {
    return res.status(400).json({ error: "Only image/* allowed" });
  }

  const key = `properties/${Number(property_id)}/${uuid()}.${pickExt(filename)}`;
  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable"
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  const publicUrl = `${process.env.S3_PUBLIC_BASE}/${encodeURIComponent(key)}`;

  // Optional: log for troubleshooting
  console.log("[S3 presign edit]", {
    region: process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET,
    key
  });

  res.json({ uploadUrl, key, publicUrl });
});

// ---------- CREATE MODE: presign to staging/{user_id}/ ----------
router.post("/s3-presign-temp", requireOwner, async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) {
    return res.status(400).json({ error: "Missing fields" });
  }
  if (!contentType.startsWith("image/")) {
    return res.status(400).json({ error: "Only image/* allowed" });
  }

  const userId = req.session.user.user_id;
  const key = `staging/${Number(userId)}/${uuid()}.${pickExt(filename)}`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=86400"
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  const publicUrl = `${process.env.S3_PUBLIC_BASE}/${encodeURIComponent(key)}`;

  console.log("[S3 presign temp]", {
    region: process.env.AWS_REGION,
    bucket: process.env.S3_BUCKET,
    key
  });

  res.json({ uploadUrl, key, publicUrl });
});

// ---------- FINALIZE: copy from staging/{user_id}/... to properties/{property_id}/... ----------
router.post("/finalize", requireOwner, async (req, res) => {
  const { property_id, tempUrls } = req.body;
  if (!property_id || !Array.isArray(tempUrls)) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const bucket = process.env.S3_BUCKET;
  const base = process.env.S3_PUBLIC_BASE.replace(/\/+$/, "");
  const userId = req.session.user.user_id;

  const finalUrls = [];

  try {
    for (const u of tempUrls) {
      // Derive source key from public URL
      const srcKey = decodeURIComponent(u.replace(base, "").replace(/^\/+/, ""));

      // Safety: only allow current user's staging prefix
      if (!srcKey.startsWith(`staging/${userId}/`)) {
        console.warn("[Finalize] skipped non-staging key:", srcKey);
        continue;
      }

      const destKey = `properties/${Number(property_id)}/${uuid()}.${pickExt(srcKey)}`;

      // Copy object from staging to final location
      await s3.send(
        new CopyObjectCommand({
          Bucket: bucket,                // destination bucket
          Key: destKey,                  // destination key
          // CopySource must be bucket + "/" + encoded key
          CopySource: `${bucket}/${encodeURIComponent(srcKey)}`,
          CacheControl: "public, max-age=31536000, immutable",
          MetadataDirective: "COPY"
        })
      );

      // Delete the staging object
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: srcKey
        })
      );

      finalUrls.push(`${base}/${encodeURIComponent(destKey)}`);
    }

    res.json({ finalUrls });
  } catch (err) {
    console.error("[Finalize error]", err);
    res.status(500).json({ error: "Finalize failed" });
  }
});

// ---------- Optional: delete by public URL ----------
router.post("/s3-delete", requireOwner, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "Missing url" });

  const base = process.env.S3_PUBLIC_BASE.replace(/\/+$/, "");
  const key = decodeURIComponent(url.replace(base, "").replace(/^\/+/, ""));

  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
  res.json({ deleted: true, key });
});

// POST /api/uploads/s3-presign-profile
router.post("/s3-presign-profile", requireAuth, async (req, res) => {
  const { filename, contentType } = req.body;
  if (!filename || !contentType) return res.status(400).json({ error: "Missing fields" });
  if (!contentType.startsWith("image/")) return res.status(400).json({ error: "Only images allowed" });

  const userId = req.session.user.user_id;
  const key = `profiles/${Number(userId)}/${uuid()}.${pickExt(filename)}`;

  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable"
  });

  // Safety: session must exist
  if (!req.session?.user?.user_id) return res.status(401).json({ error: "Not authenticated" });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 });
  const publicUrl = `${process.env.S3_PUBLIC_BASE}/${encodeURIComponent(key)}`;

  res.json({ uploadUrl, key, publicUrl });
});


export default router;
