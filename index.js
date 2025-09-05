const express = require("express");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

// helper untuk extract lat/lng dari HTML
function extractLatLng(html) {
  const regex = /window\.APP_INITIALIZATION_STATE=\[\[\[\d+.\d+,(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = html.match(regex);
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
    const response = await axios.get(url);
    const coords = extractLatLng(response.data);

    if (!coords) {
      return res.status(404).json({ error: "Coordinates not found" });
    }

    res.json(coords);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Failed to resolve URL" });
  }
});

app.listen(PORT, () => {
  console.log(`API running at http://localhost:${PORT}`);
});
