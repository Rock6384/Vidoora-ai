import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const jobs = new Map();

// Generate API - Calls Replicate Video Model
app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const jobId = "job_" + Date.now();
  jobs.set(jobId, { status: "starting", progress: 10, videoUrl: null });
  res.json({ jobId });

  runVideoPipeline(jobId, prompt);
});

async function runVideoPipeline(jobId, userPrompt) {
  const token = process.env.REPLICATE_API_TOKEN;
  const job = jobs.get(jobId);

  if (!token) {
    job.status = "failed";
    job.error = "REPLICATE_API_TOKEN missing in Render Environment";
    return;
  }

  try {
    job.status = "generating_ai_video";
    job.progress = 25;

    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Token ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        version: "c223a48e7751d08e9a265ecb37f40cf2e2ffccffb6baad3dcf7ab583348c4df5",
        input: {
          prompt: userPrompt
        }
      })
    });

    const prediction = await response.json();

    if (!response.ok || prediction.error) {
      job.status = "failed";
      job.error = prediction.detail || prediction.error || "Replicate API error";
      return;
    }

    const checkUrl = prediction.urls.get;
    let completed = false;

    while (!completed) {
      await new Promise(r => setTimeout(r, 4000));
      
      const pollRes = await fetch(checkUrl, {
        headers: { "Authorization": `Token ${token}` }
      });
      const pollData = await pollRes.json();

      if (pollData.status === "processing" || pollData.status === "starting") {
        job.progress = Math.min((job.progress || 25) + 5, 92);
        job.status = "rendering_video_frames";
      } else if (pollData.status === "succeeded") {
        completed = true;
        job.progress = 100;
        job.status = "completed";
        job.videoUrl = Array.isArray(pollData.output) ? pollData.output[0] : pollData.output;
      } else if (pollData.status === "failed" || pollData.status === "canceled") {
        completed = true;
        job.status = "failed";
        job.error = pollData.error || "Video rendering failed";
      }
    }
  } catch (err) {
    job.status = "failed";
    job.error = err.message;
  }
}

app.get("/api/jobs/:id", (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
