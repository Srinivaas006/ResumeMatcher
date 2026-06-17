# MatchIQ — Resume × JD Analyzer

An AI-powered tool that scores your resume against a job description, identifies skill gaps, missing ATS keywords, and generates tailored interview prep questions.

**Stack:** React + Tailwind (frontend) · FastAPI + Python (backend) · Groq LLaMA3-70B (AI) · Docker

---

## Quickstart

### 1. Get a free Groq API key
Sign up at [console.groq.com](https://console.groq.com) — it's free, no credit card needed.

### 2. Set up environment
```bash
cp .env.example .env
# Edit .env and add your GROQ_API_KEY
```

### 3. Run with Docker
```bash
docker-compose up --build
```

- Frontend: http://localhost:3000  
- Backend API: http://localhost:8000  
- API Docs: http://localhost:8000/docs

---

## Run without Docker

**Backend:**
```bash
cd backend
pip install -r requirements.txt
GROQ_API_KEY=your_key uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Features

- Upload resume as PDF or TXT
- Paste any job description
- Get overall match score (0–100) with verdict
- Matched and missing skills with importance ratings
- ATS keyword gap analysis
- Specific resume improvement suggestions per section
- Tailored interview questions based on your gaps

---

## Project Structure

```
resume-matcher/
├── backend/
│   ├── main.py           # FastAPI app — PDF parsing, Groq API call
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── UploadForm.jsx
│   │   │   ├── ResultsPanel.jsx
│   │   │   └── ScoreRing.jsx
│   │   ├── hooks/useAnalyze.js
│   │   └── utils/api.js
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```
