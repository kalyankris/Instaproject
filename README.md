# InstaSave — Deploy Guide (Vercel)

## 1. Push to GitHub (or deploy directly)

### Option A — Vercel CLI (fastest)

```bash
npm i -g vercel
cd instasave-deploy
vercel
```

When asked, add the environment variable:

```
FASTSAVER_API_KEY = fs_sk_9b9h8p2w2i2p1h9x3b9z8p7k8q7m
```

### Option B — GitHub + Vercel Dashboard

1. Create a new GitHub repository
2. Upload all files from this folder
3. Go to [vercel.com](https://vercel.com) → New Project → Import the repo
4. In **Environment Variables** add:

| Name               | Value                                      |
|--------------------|--------------------------------------------|
| FASTSAVER_API_KEY  | fs_sk_9b9h8p2w2i2p1h9x3b9z8p7k8q7m         |

5. Click Deploy

---

## After deployment

You will get a public URL like:

```
https://instasave-xxxx.vercel.app
```

Open this link on your phone and it will work.

---

## Project structure

```
instasave-deploy/
├── index.html          ← Full frontend (single file)
├── api/
│   └── download.js     ← Serverless API
├── package.json
├── vercel.json
└── README.md
```
