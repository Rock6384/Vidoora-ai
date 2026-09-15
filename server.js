import express from "express";
import cors from "cors";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({limit:"1mb"}));

// Serve static files from current directory
app.use(express.static(__dirname));

// Serve index.html on root URL
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const jobs = new Map();

app.post("/api/generate", async (req,res)=>{
  const {prompt, language="Hindi", duration="5 minutes", aspectRatio="16:9"} = req.body || {};
  if(!prompt || prompt.trim().length < 5) return res.status(400).json({error:"Enter a longer prompt."});

  const id = crypto.randomUUID();
  const job = {
    id, prompt: prompt.trim(), language, duration, aspectRatio,
    status:"queued", progress:0, scenes:[], result:null,
    createdAt:new Date().toISOString()
  };
  jobs.set(id,job);

  const timer = setInterval(()=>{
    const j=jobs.get(id);
    if(!j){clearInterval(timer);return}
    j.progress=Math.min(100,j.progress+10);
    if(j.progress===20) j.status="writing_script";
    if(j.progress===40) j.status="planning_scenes";
    if(j.progress===60) j.status="generating_clips";
    if(j.progress===80) j.status="assembling";
    if(j.progress===100){
      j.status="completed";
      j.scenes=makeScenes(j.prompt,j.duration);
      j.result={mode:"demo",videoUrl:null,message:"Demo pipeline completed. Add a video-provider API key to generate a real MP4."};
      clearInterval(timer);
    }
  },700);

  res.status(202).json({jobId:id});
});

app.get("/api/jobs/:id",(req,res)=>{
  const j=jobs.get(req.params.id);
  if(!j) return res.status(404).json({error:"Job not found"});
  res.json(j);
});

function makeScenes(prompt,duration){
  const minutes=parseInt(duration)||5;
  const count=Math.max(10,Math.min(60,minutes*6));
  return Array.from({length:count},(_,i)=>({
    scene:i+1,
    durationSeconds:10,
    prompt:`Cinematic scene ${i+1} for: ${prompt}`
  }));
}

app.get("/api/config",(req,res)=>res.json({
  app:"Vidoora AI",
  mode:"demo",
  liveVideoProviderConfigured:Boolean(process.env.VIDEO_API_KEY)
}));

const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`Vidoora AI running on http://localhost:${port}`));
