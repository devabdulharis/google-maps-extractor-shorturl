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

  // 1️⃣ Cari pinpoint dulu: !3dlat!4dlong
  match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // 2️⃣ Kalau nggak ada, cek @lat,lng (viewport)
  match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  // 3️⃣ Kalau nggak ada juga, cek query ?q=lat,lng
  match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };

  return null;
}

function extractLatLngFromHtml(html) {
  // 1️⃣ Cari pattern !3d..!4d..
  let match = html.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // 2️⃣ Kalau gagal, coba APP_INITIALIZATION_STATE (fallback lama)
  match = html.match(/window\.APP_INITIALIZATION_STATE=.*?(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  return null;
}

// ====================================================
// Fungsi helper untuk extract nama tempat / alamat
// ====================================================
function extractPlaceNameFromHtml(html) {
  const match = html.match(/<title>(.*?)· Google Maps<\/title>/);
  if (match) {
    return match[1].trim();
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
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    let coords = extractLatLngFromUrl(url);
    if (coords) {
      return res.json({ ...coords, name: null });
    }

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

    coords = extractLatLngFromUrl(finalUrl);
    if (coords) {
      return res.json({ ...coords, name: null });
    }

    const response = await axios.get(finalUrl);
    coords = extractLatLngFromHtml(response.data);
    const name = extractPlaceNameFromHtml(response.data);

    if (!coords) {
      return res.status(404).json({ error: "Coordinates not found" });
    }

    res.json({ ...coords, name });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});

// ====================================================
// Export untuk Vercel
// ====================================================
export default app;
