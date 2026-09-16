const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const jobs = new Map();

app.post("/api/generate", (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });

  const jobId = "job_" + Date.now();
  jobs.set(jobId, { status: "starting", progress: 15, videoUrl: null });
  res.json({ jobId });

  generateHfVideo(jobId, prompt);
});

async function generateHfVideo(jobId, prompt) {
  const token = process.env.HF_TOKEN;
  const job = jobs.get(jobId);

  if (!token) {
    job.status = "failed";
    job.error = "HF_TOKEN missing in Render Environment";
    return;
  }

  try {
    job.status = "queued_in_ai_server";
    job.progress = 35;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/damo-vilab/text-to-video-ms-1.7b",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (response.status === 503) {
      const loadInfo = await response.json();
      job.status = "model_loading_warmup";
      job.progress = 55;
      await new Promise((r) => setTimeout(r, (loadInfo.estimated_time || 20) * 1000));
      return generateHfVideo(jobId, prompt);
    }

    if (!response.ok) {
      const errText = await response.text();
      job.status = "failed";
      job.error = "Hugging Face Error: " + errText;
      return;
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64Video = Buffer.from(arrayBuffer).toString("base64");
    job.videoUrl = `data:video/mp4;base64,${base64Video}`;
    job.status = "completed";
    job.progress = 100;
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
