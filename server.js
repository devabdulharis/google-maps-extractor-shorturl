import express from "express";
import axios from "axios";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

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
    /window\.APP_INITIALIZATION_STATE=\[\[\[\d+.\d+,(-?\d+\.\d+),(-?\d+\.\d+)/;
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
      description:
        "API untuk extract latitude & longitude dari link Google Maps (shortlink & direct link).",
    },
    servers: [{ url: "https://google-maps-extractor-shorturl.vercel.app" }],
  },
  apis: ["./server.js"], // kalau mau kasih JSDoc bisa otomatis masuk
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ====================================================
// Endpoint utama
// ====================================================
app.get("/api/resolve", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    // coba parse langsung dari URL
    const coords = extractLatLngFromUrl(url);
    if (coords) return res.status(200).json(coords);

    // kalau gagal → fetch HTML (untuk shortlink gmaps)
    const response = await axios.get(url);
    const coordsFromHtml = extractLatLngFromHtml(response.data);
    if (!coordsFromHtml) {
      return res.status(404).json({ error: "Coordinates not found" });
    }

    res.status(200).json(coordsFromHtml);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});

// ====================================================
// Export untuk Vercel
// ====================================================
export default app;
