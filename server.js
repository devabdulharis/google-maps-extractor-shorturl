import express from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";
import axios from "axios";

const app = express();

// ====================================================
// Fungsi helper untuk extract lat/lng dari URL
// ====================================================
function extractLatLngFromUrl(url) {
  let match;

  // !3dlat!4dlong
  match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // @lat,lng
  match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // q=lat,lng
  match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  return null;
}

// ====================================================
// Fungsi helper untuk extract nama / alamat dari HTML
// ====================================================
function extractPlaceInfoFromHtml(html) {
  const info = {};

  let match = html.match(/<title>([^<]+)<\/title>/i);
  if (match) {
    info.name = match[1].replace(/\s*-\s*Google Maps\s*$/i, "");
  }

  // Ambil <meta content="..." property="og:description">
  match = html.match(/<meta\s+content="([^"]+)"\s+property="og:description">/);
  if (match) info.description = match[1];

  // Ambil <meta content="..." itemprop="name">
  match = html.match(/<meta\s+content="([^"]+)"\s+itemprop="name">/);
  if (match) info.full_address = match[1];

  // Ambil <meta content="..." property="og:image">
  match = html.match(/<meta\s+content="([^"]+)"\s+property="og:image">/);
  if (match) info.image = match[1];

  // Ambil rating + kategori (contoh: ★★★★☆ · Corporate office)
  match = html.match(/<meta\s+content="(★+☆?) · (.*?)"\s+itemprop="description">/);
  if (match) {
    info.rating = match[1];
    info.category = match[2];
  }

  return info;
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
      description: "API untuk extract latitude, longitude & nama tempat dari link Google Maps",
    },
    servers: [
      {
        url: "https://google-maps-extractor-shorturl.vercel.app",
      },
    ],
  },
  apis: ["./server.js"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCssUrl: [
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.css",
    ],
    customJs: [
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.js",
      "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.js",
    ],
  })
);

// ====================================================
// Endpoint utama
// ====================================================
/**
 * @openapi
 * /api/resolve:
 *   get:
 *     summary: Resolve Google Maps URL
 *     description: Ambil latitude, longitude & nama tempat dari link Google Maps
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Google Maps link
 *     responses:
 *       200:
 *         description: Data berhasil ditemukan
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
 *                 name:
 *                   type: string
 *                   example: "Kantor Desa Gumulung Lebak"
 */
app.get("/api/resolve", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    let finalUrl = url;

    // follow redirect shortlink
    if (/goo\.gl|maps\.app\.goo\.gl/.test(url)) {
      try {
        const r = await axios.get(url, {
          maxRedirects: 0,
          validateStatus: (s) => s >= 200 && s < 400,
        });
        if (r.headers.location) {
          finalUrl = r.headers.location;
        }
      } catch (e) {
        if (e.response?.headers?.location) {
          finalUrl = e.response.headers.location;
        }
      }
    }

    // fetch HTML dari Google Maps
    const r = await axios.get(finalUrl, {
      maxRedirects: 3,
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: 8000,
    });

    // extract koordinat dari URL atau HTML
    let coords = extractLatLngFromUrl(finalUrl);
    if (!coords) {
      coords = extractLatLngFromHtml(r.data);
    }

    // extract informasi tempat
    const info = extractPlaceInfoFromHtml(r.data);

    return res.json({
      ...coords,
      ...info,
    });
  } catch (err) {
    console.error("Resolve error:", err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});
// ====================================================
// Export untuk Vercel
// ====================================================
export default app;
