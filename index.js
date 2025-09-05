const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// helper untuk extract lat/lng dari HTML shortlink (maps.app.goo.gl / goo.gl/maps)
function extractLatLngFromHtml(html) {
  const regex = /window\.APP_INITIALIZATION_STATE=\[\[\[\d+.\d+,(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = html.match(regex);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

// helper untuk extract lat/lng dari URL langsung
function extractLatLngFromUrl(url) {
  let match;

  // Pola 1: URL dengan @lat,lng
  match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Pola 2: URL dengan ?q=lat,lng
  match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  // Pola 3: embed/share !3dlat!4dlong
  match = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }

  return null;
}

// API endpoint
app.get("/api/resolve", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing url parameter" });

  try {
    // 1. coba parse langsung dari URL
    const coordsFromUrl = extractLatLngFromUrl(url);
    if (coordsFromUrl) {
      return res.json(coordsFromUrl);
    }

    // 2. kalau gagal, fetch isi HTML (untuk shortlink)
    const response = await axios.get(url);
    const coordsFromHtml = extractLatLngFromHtml(response.data);

    if (!coordsFromHtml) {
      return res.status(404).json({ error: "Coordinates not found" });
    }

    res.json(coordsFromHtml);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
