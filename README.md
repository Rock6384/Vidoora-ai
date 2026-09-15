# Vidoora AI — MVP

## Run locally
1. Install Node.js 20+.
2. Open this folder in a terminal.
3. Run `npm install`
4. Run `npm start`
5. Open http://localhost:3000

The current build is a FREE DEMO. It creates a real job pipeline and scene plan, but it does not spend money or generate a real MP4.

## Going live
A real video provider API key must be stored server-side in `.env`. Do not expose it in `public/`.
The provider adapter should generate short clips, poll each asynchronous task, download the clips, then assemble them with a server-side video renderer.

Current Google Veo 3.1 documentation states generated clips are 4/6/8 seconds, so a 5–10 minute product needs many clips and an assembly pipeline rather than one giant generation request.
