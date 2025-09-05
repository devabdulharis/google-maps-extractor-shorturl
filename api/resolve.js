import axios from "axios";

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
  const regex =
    /window\.APP_INITIALIZATION_STATE=\[\[\[\d+.\d+,(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match = html.match(regex);
  if (match) {
    return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
  }
  return null;
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  try {
    // coba parse dari URL langsung
    const coords = extractLatLngFromUrl(url);
    if (coords) return res.status(200).json(coords);

    // kalau gagal, fetch HTML (shortlink)
    const response = await axios.get(url);
    const coordsFromHtml = extractLatLngFromHtml(response.data);
    if (!coordsFromHtml) {
      return res.status(404).json({ error: "Coordinates not found" });
    }

    res.status(200).json(coordsFromHtml);
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve URL" });
  }
}
