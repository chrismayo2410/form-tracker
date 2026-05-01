# Form Tracker

Daily nutrition and fitness tracker with AI-powered meal analysis.

## Deploy to Vercel

1. Install the [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel`
2. Run `npm install` to install dependencies
3. Run `vercel` in the project root and follow the prompts
4. In the Vercel dashboard, go to **Settings → Environment Variables** and add:
   - `ANTHROPIC_API_KEY` — your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
5. Redeploy after adding the environment variable

## Local development

```bash
npm install
npx vercel dev
```

Set `ANTHROPIC_API_KEY` in a `.env` file at the project root for local development — `vercel dev` loads it automatically.
