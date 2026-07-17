export default async function handler(req, res) {
  const SHEETS_URL = "https://script.google.com/macros/s/AKfycbwY2234S5C6LQGxBvOt2GPlUEC1x1cfS958YayfGEgyvSctWyQsU9qqVNCSeSt9j1yZ/exec";

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET") {
    const response = await fetch(SHEETS_URL, { redirect: "follow" });
    const data = await response.json();
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const response = await fetch(SHEETS_URL, {
      method: "POST",
      body: JSON.stringify(req.body),
      redirect: "follow",
    });
    const data = await response.json();
    return res.status(200).json(data);
  }
}
