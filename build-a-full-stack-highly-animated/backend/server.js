import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import multer from "multer";
import nodemailer from "nodemailer";
import {
  Project, Event, Volunteer, VolunteerOpportunity, GalleryImage,
  ContactMessage, SurveyResponse, DonationEnquiry, Donation, AdminUser,
  SearchAnalytics, NGO,
} from "./models.js";
import authRouter from "./routes/auth.js";
import ngoRouter from "./routes/ngos.js";
import { requireAuth, requireRole } from "./middleware/auth.js";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is required");

const app = express();
const port = process.env.PORT || 5000;
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) =>
    /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype) &&
    /\.(jpe?g|png|gif|webp)$/i.test(file.originalname)
      ? callback(null, true)
      : callback(new Error("Only image uploads are allowed")),
});
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:3000,http://127.0.0.1:3000")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
const clean = (value) => typeof value === "string" ? value.trim().slice(0, 1000) : value;
const escapeRegex = (value) => String(value).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) =>
    !origin || allowedOrigins.includes(origin)
      ? callback(null, true)
      : callback(new Error("Origin is not allowed")),
}));

// Razorpay webhooks require the untouched request bytes for signature verification.
app.post("/api/payments/razorpay/webhook", rateLimit({ windowMs: 15 * 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }), express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get("x-razorpay-signature");
  if (!secret || !signature || !Buffer.isBuffer(req.body)) return res.sendStatus(400);
  const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
  const supplied = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (supplied.length !== expectedBuffer.length || !crypto.timingSafeEqual(supplied, expectedBuffer)) {
    return res.sendStatus(400);
  }
  try {
    const event = JSON.parse(req.body.toString("utf8"));
    const payment = event.payload?.payment?.entity;
    if (payment?.order_id && event.event === "payment.captured") {
      await Donation.findOneAndUpdate(
        { razorpayOrderId: payment.order_id, status: { $ne: "paid" } },
        { $set: { status: "paid", razorpayPaymentId: payment.id, paidAt: new Date() } },
      );
    } else if (payment?.order_id && event.event === "payment.failed") {
      await Donation.updateOne(
        { razorpayOrderId: payment.order_id, status: { $ne: "paid" } },
        { $set: { status: "failed", failureReason: String(payment.error_description || "Payment failed").slice(0, 300) } },
      );
    }
    return res.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error.message);
    return res.sendStatus(400);
  }
});

app.use(express.json({ limit: "100kb" }));
app.use("/uploads", express.static("uploads"));
app.use(morgan("tiny"));
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

const email = async (to, subject, text) => {
  if (!mailer || !to) return false;
  try {
    await mailer.sendMail({
      from: process.env.MAIL_FROM || "EarthKind <noreply@earthkind.org>",
      to, subject, text,
    });
    return true;
  } catch (error) {
    console.error("Email send failed:", error.message);
    return false;
  }
};

async function verifiedNgoIds() {
  return NGO.find({ status: "VERIFIED" }).distinct("_id");
}

async function paginated(Model, req, res, sort) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(60, Math.max(1, Number(req.query.limit) || 20));
  const filter = {};
  if (req.query.category) filter.category = clean(req.query.category);
  if (req.query.location) filter.location = new RegExp(escapeRegex(req.query.location), "i");

  const verifiedIds = await verifiedNgoIds();
  if (Model === Project) {
    filter.ngo = { $in: verifiedIds };
    filter.status = { $nin: ["draft", "archived"] };
  } else if (Model === Event) {
    filter.ngo = { $in: verifiedIds };
    filter.status = "published";
  } else if (Model === GalleryImage) {
    filter.ngo = { $in: verifiedIds };
  }

  const [data, total] = await Promise.all([
    Model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    Model.countDocuments(filter),
  ]);
  res.json({ data, page, limit, total, pages: Math.ceil(total / limit) });
}

app.get("/api/projects", (req, res, next) =>
  paginated(Project, req, res, { featured: -1, createdAt: -1 }).catch(next),
);
app.get("/api/events", (req, res, next) =>
  paginated(Event, req, res, { date: 1 }).catch(next),
);
app.get("/api/gallery", (req, res, next) =>
  paginated(GalleryImage, req, res, { createdAt: -1 }).catch(next),
);

app.get("/api/search", async (req, res, next) => {
  try {
    const query = clean(req.query.q || "");
    if (query.length < 2) {
      return res.json({ query, projects: [], events: [], volunteer: [], gallery: [], pages: [] });
    }
    const regex = new RegExp(escapeRegex(query), "i");
    const verifiedIds = await verifiedNgoIds();
    const [projects, events, volunteer, gallery] = await Promise.all([
      Project.find({
        ngo: { $in: verifiedIds }, status: { $nin: ["draft", "archived"] },
        $or: [{ name: regex }, { category: regex }, { location: regex }, { description: regex }],
      }).limit(8),
      Event.find({
        ngo: { $in: verifiedIds }, status: "published",
        $or: [{ name: regex }, { location: regex }, { description: regex }],
      }).limit(8),
      VolunteerOpportunity.find({
        ngo: { $in: verifiedIds }, status: "published",
        $or: [{ title: regex }, { skills: regex }, { location: regex }, { description: regex }],
      }).populate("ngo", "name slug").limit(8),
      GalleryImage.find({
        ngo: { $in: verifiedIds },
        $or: [{ tags: regex }, { caption: regex }, { location: regex }],
      }).limit(8),
    ]);

    SearchAnalytics.findOneAndUpdate(
      { query: query.toLowerCase() },
      { $inc: { count: 1 }, lastSearched: new Date() },
      { upsert: true },
    ).catch(() => {});

    res.json({
      query,
      projects,
      events,
      volunteer: volunteer.map((item) => ({
        name: item.title, description: item.description,
        location: item.location, ngo: item.ngo?.name, id: item._id,
      })),
      gallery: gallery.map((item) => ({
        name: item.caption || "EarthKind gallery moment",
        description: (item.tags || []).join(", "), image: item.url,
      })),
      pages: [
        { name: "About EarthKind", description: "Our mission, people and history." },
        { name: "Donate", description: "Help community ideas take root." },
        { name: "Contact", description: "Get in touch with our team." },
      ],
    });
  } catch (error) { next(error); }
});

function valid(fields) {
  return (req, res, next) => {
    for (const field of fields) {
      if (!clean(req.body[field])) return res.status(400).json({ error: `${field} is required` });
    }
    next();
  };
}

app.post("/api/volunteers", valid(["name", "email"]), async (req, res, next) => {
  try {
    const registration = await Volunteer.create({
      name: clean(req.body.name), email: clean(req.body.email),
      project: clean(req.body.project || req.body.skills),
      skills: clean(req.body.skills), availability: clean(req.body.availability),
      location: clean(req.body.location),
    });
    await email(registration.email, "Your EarthKind registration",
      "Thanks for registering. We will send role details shortly.");
    res.status(201).json(registration);
  } catch (error) { next(error); }
});

app.post("/api/contact", valid(["email"]), async (req, res, next) => {
  try {
    const contact = await ContactMessage.create({
      name: clean(req.body.name), email: clean(req.body.email),
      message: clean(req.body.message), status: "new",
      followUpAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    const visitorName = clean(req.body.name) || "there";
    const confirmation = await email(contact.email, "We received your message — EarthKind",
      `Hi ${visitorName},\n\nThank you for contacting EarthKind. We have received your message and our team will follow up with you shortly.\n\nYour message:\n${contact.message || "No message provided"}\n\nThank you,\nEarthKind Team`);
    const notification = await email(process.env.ADMIN_EMAIL, "New EarthKind contact enquiry",
      `New contact enquiry from ${visitorName}\nEmail: ${contact.email}\n\nMessage:\n${contact.message || "No message provided"}\n\nFollow-up is due: ${contact.followUpAt.toISOString()}`);
    res.status(201).json({
      success: true, contactId: contact._id,
      emailSent: confirmation, adminNotified: notification,
    });
  } catch (error) { next(error); }
});

app.post("/api/survey", valid(["name", "community"]), async (req, res, next) => {
  try {
    res.status(201).json(await SurveyResponse.create({
      name: clean(req.body.name), community: clean(req.body.community),
      priority: clean(req.body.priority), notes: clean(req.body.notes),
    }));
  } catch (error) { next(error); }
});


const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
const razorpayAuth = () => "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

app.get("/api/payments/razorpay/config", (req, res) => {
  if (!razorpayConfigured()) return res.status(503).json({ error: "Online donations are temporarily unavailable." });
  res.set("Cache-Control", "no-store").json({ keyId: process.env.RAZORPAY_KEY_ID, currency: "INR" });
});

app.post("/api/payments/razorpay/orders", async (req, res, next) => {
  try {
    if (!razorpayConfigured()) return res.status(503).json({ error: "Online donations are temporarily unavailable." });
    const name = clean(req.body.name);
    const emailAddress = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    const amount = Number(req.body.amount);
    if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      return res.status(400).json({ error: "Enter a valid name and email address." });
    }
    if (!Number.isSafeInteger(Math.round(amount * 100)) || amount < 1 || amount > 100000) {
      return res.status(400).json({ error: "Donation amount must be between ₹1 and ₹1,00,000." });
    }
    const amountPaise = Math.round(amount * 100);
    const receipt = `ek_${crypto.randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: razorpayAuth(), "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amountPaise, currency: "INR", receipt,
        notes: { donor_name: name.slice(0, 120), donor_email: emailAddress },
      }),
      signal: AbortSignal.timeout(12000),
    });
    const order = await response.json();
    if (!response.ok || !order.id) {
      console.error("Razorpay order creation failed:", order.error?.code || response.status);
      return res.status(502).json({ error: "Could not start payment. Please try again." });
    }
    await Donation.create({
      name, email: emailAddress, amountPaise, currency: "INR",
      razorpayOrderId: order.id, status: "created",
    });
    res.status(201).json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    if (error.name === "TimeoutError") return res.status(504).json({ error: "Payment service timed out. Please try again." });
    next(error);
  }
});

app.post("/api/payments/razorpay/verify", async (req, res, next) => {
  try {
    if (!razorpayConfigured()) return res.status(503).json({ error: "Payment verification is unavailable." });
    const orderId = typeof req.body.razorpay_order_id === "string" ? req.body.razorpay_order_id : "";
    const paymentId = typeof req.body.razorpay_payment_id === "string" ? req.body.razorpay_payment_id : "";
    const signature = typeof req.body.razorpay_signature === "string" ? req.body.razorpay_signature : "";
    if (!orderId || !paymentId || !signature || orderId.length > 100 || paymentId.length > 100) {
      return res.status(400).json({ error: "Payment details are incomplete." });
    }
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`).digest("hex");
    const actualBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
      return res.status(400).json({ error: "Payment signature could not be verified." });
    }
    const donation = await Donation.findOne({ razorpayOrderId: orderId });
    if (!donation) return res.status(404).json({ error: "Donation order was not found." });
    if (donation.status === "paid" && donation.razorpayPaymentId === paymentId) {
      return res.json({ success: true, status: "paid", message: "Donation confirmed. Thank you!" });
    }
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: razorpayAuth() }, signal: AbortSignal.timeout(12000),
    });
    const payment = await response.json();
    if (!response.ok || payment.order_id !== orderId || payment.amount !== donation.amountPaise || payment.currency !== "INR") {
      return res.status(400).json({ error: "Payment details do not match this donation." });
    }
    if (payment.status !== "captured") {
      return res.status(202).json({ success: true, status: payment.status, message: "Payment received and is being confirmed. Please check again shortly." });
    }
    donation.status = "paid";
    donation.razorpayPaymentId = paymentId;
    donation.paidAt = new Date();
    await donation.save();
    res.json({ success: true, status: "paid", message: "Donation confirmed. Thank you!" });
  } catch (error) {
    if (error.name === "TimeoutError") return res.status(504).json({ error: "Payment verification timed out. Please try again." });
    next(error);
  }
});

app.get("/api/payments/razorpay/status/:orderId", async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId || "").slice(0, 100);
    const donation = await Donation.findOne({ razorpayOrderId: orderId }).select("status amountPaise currency");
    if (!donation) return res.status(404).json({ error: "Donation order was not found." });
    res.set("Cache-Control", "no-store").json({
      status: donation.status, amount: donation.amountPaise, currency: donation.currency,
    });
  } catch (error) { next(error); }
});

app.post("/api/donation-enquiries", valid(["name", "email"]), async (req, res, next) => {
  try {
    res.status(201).json(await DonationEnquiry.create({
      name: clean(req.body.name), email: clean(req.body.email),
      amount: clean(req.body.amount), message: clean(req.body.message),
    }));
  } catch (error) { next(error); }
});

app.use("/api/auth", authRouter);
app.use("/api/ngos", ngoRouter);
app.use("/api", ngoRouter);

const admin = (req, res, next) =>
  requireAuth(req, res, () => requireRole("ADMIN")(req, res, next));
const models = {
  projects: Project, events: Event, gallery: GalleryImage,
  volunteers: Volunteer, contacts: ContactMessage,
};

app.get("/api/admin/dashboard", admin, async (req, res, next) => {
  try {
    const [projects, events, volunteers, gallery, searches] = await Promise.all([
      Project.countDocuments(), Event.countDocuments(), Volunteer.countDocuments(),
      GalleryImage.countDocuments(), SearchAnalytics.find().sort({ count: -1 }).limit(10),
    ]);
    res.json({ projects, events, volunteers, gallery, searches });
  } catch (error) { next(error); }
});
app.get("/api/admin/stats", admin, async (req, res, next) => {
  try {
    const [projects, events, volunteers, contacts, donationEnquiries] = await Promise.all([
      Project.countDocuments(), Event.countDocuments(), Volunteer.countDocuments(),
      ContactMessage.countDocuments(), DonationEnquiry.countDocuments(),
    ]);
    res.json({ projects, events, volunteers, contacts, donationEnquiries });
  } catch (error) { next(error); }
});
app.get("/api/admin/:collection", admin, async (req, res, next) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.sendStatus(404);
    res.json(await Model.find().sort({ createdAt: -1 }));
  } catch (error) { next(error); }
});
app.post("/api/admin/:collection", admin, async (req, res, next) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.sendStatus(404);
    res.status(201).json(await Model.create(req.body));
  } catch (error) { next(error); }
});
const validId = (req, res, next) =>
  mongoose.isValidObjectId(req.params.id)
    ? next()
    : res.status(400).json({ error: "Invalid resource id" });
app.put("/api/admin/:collection/:id", admin, validId, async (req, res, next) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.sendStatus(404);
    res.json(await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }));
  } catch (error) { next(error); }
});
app.delete("/api/admin/:collection/:id", admin, validId, async (req, res, next) => {
  try {
    const Model = models[req.params.collection];
    if (!Model) return res.sendStatus(404);
    await Model.findByIdAndDelete(req.params.id);
    res.sendStatus(204);
  } catch (error) { next(error); }
});
app.post("/api/admin/upload", admin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Image file is required" });
  res.status(201).json({ url: `/uploads/${req.file.filename}`, filename: req.file.originalname });
});
app.get("/api/admin/export/:type", admin, async (req, res, next) => {
  try {
    const Model = {
      volunteers: Volunteer, contacts: ContactMessage, surveys: SurveyResponse,
    }[req.params.type];
    if (!Model) return res.sendStatus(404);
    const rows = await Model.find().lean();
    const keys = [...new Set(rows.flatMap(Object.keys))].filter((key) => !["_id", "__v"].includes(key));
    const csv = [
      keys.join(","),
      ...rows.map((row) => keys.map((key) =>
        `"${String(row[key] ?? "").replaceAll('"', '""')}"`).join(",")),
    ].join("\n");
    res.type("text/csv").attachment(`${req.params.type}.csv`).send(csv);
  } catch (error) { next(error); }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong" });
});

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/earthkind")
  .then(() => app.listen(port, () => console.log(`EarthKind API on :${port}`)))
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
