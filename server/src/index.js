import "express-async-errors";
import express from "express";
import cookieParser from "cookie-parser";
import { waitForDb, migrate } from "./db.js";
import { initOidc } from "./oidc.js";
import authRoutes from "./routes/auth.js";
import oidcRoutes from "./routes/oidc.js";
import adminRoutes from "./routes/admin.js";
import pagesRoutes from "./routes/pages.js";
import categoriesRoutes from "./routes/categories.js";
import resourcesRoutes from "./routes/resources.js";
import mediaRoutes from "./routes/media.js";
import dataRoutes from "./routes/data.js";
import settingsRoutes from "./routes/settings.js";

const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());

app.use("/api/auth/oidc", oidcRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/pages", pagesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/resources", resourcesRoutes);
app.use("/api/uploads", mediaRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/settings", settingsRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  if (err.message && /image/i.test(err.message)) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

waitForDb()
  .then(migrate)
  .then(initOidc)
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
  })
  .catch((err) => {
    console.error("Could not start server", err);
    process.exit(1);
  });
