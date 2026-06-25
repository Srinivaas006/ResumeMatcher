from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pdfplumber
import groq
import os
import json
import re
import io

app = FastAPI(title="Resume Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://frontend:3000","https://resumematcher06.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY"))


def extract_text_from_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        text = ""
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def clean_json_response(text: str) -> str:
    # Strip markdown code fences if present
    text = re.sub(r"```json\s*", "", text)
    text = re.sub(r"```\s*", "", text)
    return text.strip()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    resume: UploadFile = File(...),
    job_description: str = Form(...),
):
    if resume.content_type not in ["application/pdf", "text/plain"]:
        raise HTTPException(status_code=400, detail="Only PDF or plain text resumes are supported.")

    file_bytes = await resume.read()

    if resume.content_type == "application/pdf":
        try:
            resume_text = extract_text_from_pdf(file_bytes)
        except Exception:
            raise HTTPException(status_code=422, detail="Failed to parse PDF. Ensure the file is not scanned/image-based.")
    else:
        resume_text = file_bytes.decode("utf-8", errors="ignore")

    if not resume_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from the resume.")

    prompt = f"""
You are an expert technical recruiter and career coach. Analyze the resume against the job description and return a detailed, honest assessment.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{{
  "overall_score": <integer 0-100>,
  "verdict": "<one of: Strong Match | Good Match | Partial Match | Weak Match>",
  "summary": "<2-3 sentence honest executive summary of fit>",
  "matched_skills": [
    {{"skill": "<skill name>", "context": "<where it appears in resume>"}}
  ],
  "missing_skills": [
    {{"skill": "<skill name>", "importance": "<Critical | High | Medium>", "suggestion": "<how to acquire or demonstrate this>"}}
  ],
  "strengths": [
    {{"title": "<strength title>", "detail": "<specific detail from resume>"}}
  ],
  "gaps": [
    {{"title": "<gap title>", "detail": "<specific gap and its impact on fit>"}}
  ],
  "resume_improvements": [
    {{"section": "<section name e.g. Experience, Skills>", "current": "<what it says now or what's missing>", "suggestion": "<exact improvement to make>"}}
  ],
  "ats_keywords_missing": ["<keyword1>", "<keyword2>"],
  "interview_prep": [
    {{"question": "<likely interview question based on gaps>", "tip": "<how to answer it>"}}
  ]
}}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2048,
        )
        raw = response.choices[0].message.content
        cleaned = clean_json_response(raw)
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed response. Please try again.")
    except groq.APIError as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    return JSONResponse(content=result)