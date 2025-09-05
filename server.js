import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import axios from "axios";

const app = express();

// ====================================================
// Fungsi helper untuk extract lat/lng
// ====================================================
function extractLatLngFromUrl(url) {
  let match;

  // Format: @lat,lng
  match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // Format: ?q=lat,lng
  match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // Format: !3dlat!4dlong
  match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  return null;
}

function extractLatLngFromHtml(html) {
  const regex =
    /window\.APP_INITIALIZATION_STATE=\[\[\[\d+,\d+,".*?",(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = html.match(regex);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

// ====================================================
// Swagger Setup
// ====================================================
const swaggerOptions = {
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Google Maps Resolver API",
      version: "1.0.0",
      description: "API untuk extract latitude & longitude dari link Google Maps",
    },
    servers: [{ url: "https://google-maps-extractor-shorturl.vercel.app" }],
  },
  apis: [new URL("./server.js", import.meta.url).pathname],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger route
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ====================================================
// Endpoint utama
// ====================================================
/**
 * @openapi
 * /api/resolve:
 *   get:
 *     summary: Resolve Google Maps URL
 *     description: Ambil latitude & longitude dari link Google Maps
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Google Maps link
 *     responses:
 *       200:
 *         description: Koordinat berhasil ditemukan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lat:
 *                   type: number
 *                   example: -6.2
 *                 lng:
 *                   type: number
 *                   example: 106.816
 *       400:
 *         description: Missing url parameter
 */
app.get("/api/resolve", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    // 1️⃣ coba parse langsung dari URL
    let coords = extractLatLngFromUrl(url);
    if (coords) return res.json(coords);

    // 2️⃣ cek apakah shortlink → resolve redirect
    let finalUrl = url;
    if (/goo\.gl|maps\.app\.goo\.gl/.test(url)) {
      const r = await axios.get(url, {
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
      });
      if (r.headers.location) {
        finalUrl = r.headers.location;
      }
    }

    // 3️⃣ coba parse dari URL hasil redirect
    coords = extractLatLngFromUrl(finalUrl);
    if (coords) return res.json(coords);

    // 4️⃣ terakhir fetch HTML
    const response = await axios.get(finalUrl);
    coords = extractLatLngFromHtml(response.data);
    if (!coords) {
      return res.status(404).json({ error: "Coordinates not found" });
    }

    res.json(coords);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});

// ====================================================
// Export untuk Vercel
// ====================================================
export default app;
