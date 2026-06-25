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

    # Cap skills to avoid overly long roadmaps that exceed token limit
    skills_capped = skills_list[:6]
    num_weeks = min(len(skills_capped) + 1, 5)

    prompt = f"""
You are an expert career coach helping a student learn skills to land a job.
{"Target role: " + context if context else ""}
Missing skills to cover: {json.dumps(skills_capped)}

Create a {num_weeks}-week roadmap. Max {num_weeks} week objects. Keep each week concise.
Each week: max 2 topics, max 2 resources.

Return ONLY a valid JSON object. No markdown, no explanation, no trailing text. Must be complete valid JSON.
{{
  "total_weeks": {num_weeks},
  "goal_summary": "<1 sentence>",
  "weeks": [
    {{
      "week": 1,
      "focus": "<skill>",
      "daily_hours": 2,
      "topics": ["<topic1>", "<topic2>"],
      "resources": [
        {{
          "title": "<name>",
          "type": "<YouTube|Docs|Course|Article|Practice>",
          "url": "<url>",
          "description": "<1 sentence>"
        }}
      ],
      "milestone": "<what they can do after this week>"
    }}
  ],
  "tips": ["<tip1>", "<tip2>", "<tip3>"]
}}
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=4000,
        )
        raw = response.choices[0].message.content
        cleaned = clean_json_response(raw)
        # Try to extract JSON if there's extra text around it
        json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if json_match:
            cleaned = json_match.group(0)
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned malformed JSON. Please try again. ({str(e)})")
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

    # Fetch README existence for top 5 repos (real check, not assumed)
    repo_summaries = []
    async with httpx.AsyncClient(timeout=15) as http2:
        for r in repos[:10]:
            has_desc = bool(r.get("description", "").strip())
            has_topics = len(r.get("topics", [])) > 0
            stars = r.get("stargazers_count", 0)
            forks = r.get("forks_count", 0)
            # Check README existence for top 5 repos only
            has_readme = False
            if len(repo_summaries) < 5:
                try:
                    rm = await http2.get(
                        f"https://api.github.com/repos/{username}/{r['name']}/readme",
                        headers=gh_headers,
                    )
                    has_readme = rm.status_code == 200
                except Exception:
                    has_readme = False

            repo_summaries.append({
                "name": r.get("name"),
                "description": r.get("description") or "NO DESCRIPTION",
                "language": r.get("language") or "Unknown",
                "stars": stars,
                "forks": forks,
                "has_readme": has_readme,
                "has_description": has_desc,
                "has_topics": has_topics,
                "topics": r.get("topics", []),
                "updated_at": r.get("updated_at", "")[:10],
                "is_fork": r.get("fork", False),
            })

    total_repos = len(repos)
    repos_with_desc = sum(1 for r in repo_summaries if r["has_description"])
    repos_with_readme = sum(1 for r in repo_summaries if r["has_readme"])
    original_repos = sum(1 for r in repo_summaries if not r["is_fork"])
    total_stars = sum(r["stars"] for r in repo_summaries)
    languages_used = list(set(r["language"] for r in repo_summaries if r["language"] != "Unknown"))

    profile_summary = {
        "username": username,
        "name": user_data.get("name") or "",
        "bio": user_data.get("bio") or "NO BIO SET",
        "public_repos": user_data.get("public_repos", 0),
        "followers": user_data.get("followers", 0),
        "following": user_data.get("following", 0),
        "location": user_data.get("location") or "",
        "blog_or_portfolio": user_data.get("blog") or "NONE",
        "profile_picture_set": bool(user_data.get("avatar_url") and "gravatar" not in user_data.get("avatar_url", "")),
        "stats": {
            "total_repos": total_repos,
            "original_repos": original_repos,
            "forked_repos": total_repos - original_repos,
            "repos_with_description": repos_with_desc,
            "repos_checked_for_readme": min(5, len(repo_summaries)),
            "repos_with_readme_of_checked": repos_with_readme,
            "total_stars": total_stars,
            "languages_used": languages_used,
        },
        "repos": repo_summaries,
    }

    prompt = f"""
You are a strict but fair technical recruiter reviewing a student's GitHub profile.
{"Target role: " + target_role if target_role else "General software developer role."}

REAL PROFILE DATA (fetched live from GitHub API):
{json.dumps(profile_summary, indent=2)}

Score this profile HONESTLY based on these exact criteria. Do NOT default to average scores — use the real data above.

SCORING RUBRIC (total 100 points):
- Bio / profile completeness (name, bio, location, portfolio link): 0-15 pts
  * No bio = 0, vague bio = 5, good bio = 10, excellent recruiter-ready bio = 15
- Number of original (non-fork) repos: 0-15 pts
  * 0-2 repos = 3, 3-5 = 8, 6-10 = 12, 11+ = 15
- Repo quality (descriptions, topics, meaningful names): 0-20 pts
  * All repos named "repo1/test/untitled" with no descriptions = 0-5
  * Some descriptions and meaningful names = 6-12
  * Most repos have descriptions and topics = 13-20
- README quality (based on has_readme field in data): 0-20 pts
  * 0 READMEs = 0, 1-2 = 8, 3-4 = 14, 5 = 20
- Project diversity and tech stack breadth: 0-15 pts
  * Only 1 language = 3, 2-3 languages = 8, 4+ languages or full-stack projects = 15
- Stars and community engagement: 0-15 pts
  * 0 stars = 2, 1-5 stars = 6, 6-20 stars = 11, 20+ stars = 15

GRADE:
- A = 85-100, B = 70-84, C = 50-69, D = below 50

Calculate the score strictly from the rubric above using the actual numbers in the data.
A profile with no bio, no descriptions, all forks, no READMEs MUST score below 30.
A profile with good bio, 10+ original repos with descriptions and READMEs MUST score above 80.

Return ONLY a valid JSON object (no markdown):
{{
  "overall_score": <integer 0-100 based strictly on rubric>,
  "grade": "<A|B|C|D>",
  "score_breakdown": {{
    "bio_completeness": <0-15>,
    "repo_count": <0-15>,
    "repo_quality": <0-20>,
    "readme_quality": <0-20>,
    "tech_diversity": <0-15>,
    "community_engagement": <0-15>
  }},
  "summary": "<2-3 sentences referencing actual numbers from the profile>",
  "profile_strengths": [
    {{"title": "<strength>", "detail": "<cite specific repo names or actual data>"}}
  ],
  "profile_weaknesses": [
    {{"title": "<weakness>", "detail": "<cite specific missing things from actual data>"}}
  ],
  "top_repos": [
    {{
      "name": "<actual repo name from data>",
      "why": "<specific observation about this repo>",
      "improvement": "<concrete fix>"
    }}
  ],
  "readme_quality": "<Poor|Basic|Good|Excellent>",
  "readme_tips": ["<tip1>", "<tip2>"],
  "missing_for_role": ["<specific gap for the target role>"],
  "action_items": [
    {{
      "priority": "<High|Medium|Low>",
      "action": "<specific actionable step>",
      "impact": "<why recruiters care>"
    }}
  ],
  "bio_suggestion": "<rewritten bio based on their actual repos and languages>",
  "pinned_repos_suggestion": "<name actual repos from the data that should be pinned>"
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