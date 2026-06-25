from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pdfplumber
import groq
import httpx
import os
import json
import re
import io

app = FastAPI(title="Resume Matcher API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


# ─────────────────────────────────────────────
# NEW: Learning Roadmap
# ─────────────────────────────────────────────
@app.post("/roadmap")
async def learning_roadmap(
    missing_skills: str = Form(...),   # JSON array of skill strings
    context: str = Form(default=""),   # optional: job title or goal
):
    try:
        skills_list = json.loads(missing_skills)
    except Exception:
        raise HTTPException(status_code=400, detail="missing_skills must be a valid JSON array of strings.")

    if not skills_list:
        raise HTTPException(status_code=400, detail="Provide at least one missing skill.")

    prompt = f"""
You are an expert career coach helping a student or fresher learn the skills they need to land a job.

{"Their target role context: " + context if context else ""}

They are missing these skills: {json.dumps(skills_list)}

Create a practical, week-by-week learning roadmap for ALL of these skills combined.
Prioritize the most critical skills first. Be specific — name actual free resources.

Return ONLY a valid JSON object (no markdown) with this structure:
{{
  "total_weeks": <integer>,
  "goal_summary": "<1 sentence describing what they will achieve>",
  "weeks": [
    {{
      "week": <integer>,
      "focus": "<skill or theme for this week>",
      "daily_hours": <integer 1-3>,
      "topics": ["<topic1>", "<topic2>"],
      "resources": [
        {{
          "title": "<resource name>",
          "type": "<YouTube | Docs | Course | Article | Practice>",
          "url": "<actual url>",
          "description": "<1 sentence on what it covers>"
        }}
      ],
      "milestone": "<what they should be able to do by end of week>"
    }}
  ],
  "tips": ["<practical tip1>", "<practical tip2>", "<practical tip3>"]
}}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=3000,
        )
        raw = response.choices[0].message.content
        cleaned = clean_json_response(raw)
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed response. Please try again.")
    except groq.APIError as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    return JSONResponse(content=result)


# ─────────────────────────────────────────────
# NEW: GitHub Profile Analyzer
# ─────────────────────────────────────────────
@app.post("/analyze-github")
async def analyze_github(
    github_username: str = Form(...),
    target_role: str = Form(default=""),
):
    username = github_username.strip().lstrip("https://github.com/").strip("/")

    # Fetch GitHub data via public API
    github_token = os.environ.get("GITHUB_TOKEN")
    gh_headers = {"Accept": "application/vnd.github.v3+json"}
    if github_token:
        gh_headers["Authorization"] = f"Bearer {github_token}"

    async with httpx.AsyncClient(timeout=15) as http:
        try:
            user_resp = await http.get(
                f"https://api.github.com/users/{username}",
                headers=gh_headers,
            )
            if user_resp.status_code == 404:
                raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found.")
            if user_resp.status_code == 403:
                raise HTTPException(status_code=503, detail="GitHub API rate limit exceeded. Please try again later.")
            user_resp.raise_for_status()
            user_data = user_resp.json()

            repos_resp = await http.get(
                f"https://api.github.com/users/{username}/repos?sort=updated&per_page=30",
                headers=gh_headers,
            )
            repos_resp.raise_for_status()
            repos = repos_resp.json()

        except httpx.RequestError as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch GitHub data: {str(e)}")

    # Summarize repo data for AI (avoid sending too much)
    repo_summaries = []
    for r in repos[:15]:
        repo_summaries.append({
            "name": r.get("name"),
            "description": r.get("description") or "",
            "language": r.get("language") or "Unknown",
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "has_readme": True,  # assume true; checking each would need extra API calls
            "topics": r.get("topics", []),
            "updated_at": r.get("updated_at", "")[:10],
        })

    profile_summary = {
        "username": username,
        "name": user_data.get("name") or username,
        "bio": user_data.get("bio") or "",
        "public_repos": user_data.get("public_repos", 0),
        "followers": user_data.get("followers", 0),
        "following": user_data.get("following", 0),
        "location": user_data.get("location") or "",
        "blog": user_data.get("blog") or "",
        "repos": repo_summaries,
    }

    prompt = f"""
You are an expert technical recruiter reviewing a student's GitHub profile to help them get hired.
{"Target role: " + target_role if target_role else ""}

GITHUB PROFILE DATA:
{json.dumps(profile_summary, indent=2)}

Analyze this profile thoroughly and return ONLY a valid JSON object (no markdown) with this structure:
{{
  "overall_score": <integer 0-100>,
  "grade": "<A | B | C | D>",
  "summary": "<2-3 sentence honest summary of the profile's strength for job hunting>",
  "profile_strengths": [
    {{"title": "<strength>", "detail": "<specific observation>"}}
  ],
  "profile_weaknesses": [
    {{"title": "<weakness>", "detail": "<specific issue and its impact on recruiter impression>"}}
  ],
  "top_repos": [
    {{
      "name": "<repo name>",
      "why": "<why this repo stands out or doesn't>",
      "improvement": "<specific thing to improve about this repo>"
    }}
  ],
  "readme_quality": "<Poor | Basic | Good | Excellent>",
  "readme_tips": ["<tip1>", "<tip2>"],
  "missing_for_role": ["<thing1 missing for target role>", "<thing2>"],
  "action_items": [
    {{
      "priority": "<High | Medium | Low>",
      "action": "<specific action to take>",
      "impact": "<why this matters to recruiters>"
    }}
  ],
  "bio_suggestion": "<rewritten bio that would attract recruiters>",
  "pinned_repos_suggestion": "<which repos they should pin and why>"
}}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=2500,
        )
        raw = response.choices[0].message.content
        cleaned = clean_json_response(raw)
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="AI returned malformed response. Please try again.")
    except groq.APIError as e:
        raise HTTPException(status_code=502, detail=f"Groq API error: {str(e)}")

    return JSONResponse(content=result)