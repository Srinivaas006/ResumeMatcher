from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pdfplumber
import httpx
import asyncio
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

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"


async def call_gemini(prompt: str) -> str:
    """Call Gemini API via plain HTTP — no SDK needed, works on any Python version."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 4096},
    }
    async with httpx.AsyncClient(timeout=60) as http:
        resp = await http.post(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


def extract_text_from_pdf(file_bytes: bytes) -> str:
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        text = ""
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def extract_structured_pdf(file_bytes: bytes) -> list:
    """Extract lines with font size info to detect headings vs body text."""
    lines_out = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            words = page.extract_words(extra_attrs=["size"])
            if not words:
                continue
            # Group words into lines by y-position
            lines = {}
            for w in words:
                y_key = round(w["top"] / 3) * 3  # cluster nearby y positions
                lines.setdefault(y_key, []).append(w)

            for y_key in sorted(lines.keys()):
                line_words = sorted(lines[y_key], key=lambda w: w["x0"])
                text = " ".join(w["text"] for w in line_words)
                avg_size = sum(w.get("size", 10) for w in line_words) / len(line_words)
                if text.strip():
                    lines_out.append({"text": text.strip(), "size": round(avg_size, 1)})
    return lines_out


@app.post("/extract-editable")
async def extract_editable(resume: UploadFile = File(...)):
    if resume.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    file_bytes = await resume.read()
    try:
        lines = extract_structured_pdf(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse PDF: {str(e)}")

    if not lines:
        raise HTTPException(status_code=422, detail="Could not extract text from this PDF.")

    # Classify lines as heading / subheading / body based on font size
    sizes = [l["size"] for l in lines]
    max_size = max(sizes)
    body_size = sorted(sizes)[len(sizes) // 2]  # median ~ body text size

    for l in lines:
        if l["size"] >= max_size - 0.5 and l["size"] > body_size + 2:
            l["type"] = "heading"
        elif l["size"] > body_size + 1:
            l["type"] = "subheading"
        else:
            l["type"] = "body"

    return JSONResponse(content={"lines": lines})


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

    # ── Step 1: Extract ALL skills from JD deterministically ──
    skills_prompt = f"""
Extract every technical skill, tool, language, framework, and qualification required in this job description.
List ONLY skills — no descriptions, no sentences.
Return ONLY a JSON array of strings. Example: ["Python", "React", "Docker"]

JOB DESCRIPTION:
{job_description}
"""
    try:
        skills_raw = await call_gemini(skills_prompt)
        skills_clean = clean_json_response(skills_raw)
        arr_match = re.search(r'\[.*\]', skills_clean, re.DOTALL)
        jd_skills = json.loads(arr_match.group(0)) if arr_match else []
    except Exception:
        jd_skills = []

    # ── Step 2: Classify each JD skill against the resume ──
    classify_prompt = f"""
You are a resume screener. For each skill below, check if it appears in the resume (directly or equivalent).

RESUME:
{resume_text}

SKILLS TO CHECK (from job description):
{json.dumps(jd_skills)}

Return ONLY a valid JSON object:
{{
  "matched": [
    {{"skill": "<skill>", "context": "<exact phrase from resume showing this skill>"}}
  ],
  "missing": [
    {{"skill": "<skill>", "importance": "<Critical|High|Medium>", "suggestion": "<one sentence on how to get it>"}}
  ]
}}
Rules:
- A skill is matched only if there is clear evidence in the resume text
- Do not infer — if it's not there, mark as missing
- importance: Critical = required/must-have, High = strongly preferred, Medium = nice-to-have
"""
    try:
        classify_raw = await call_gemini(classify_prompt)
        classify_clean = clean_json_response(classify_raw)
        obj_match = re.search(r'\{.*\}', classify_clean, re.DOTALL)
        classify_result = json.loads(obj_match.group(0)) if obj_match else {"matched": [], "missing": []}
    except Exception:
        classify_result = {"matched": [], "missing": []}

    matched_skills = classify_result.get("matched", [])
    missing_skills = classify_result.get("missing", [])

    # ── Step 3: Score in Python from fixed skill list ──
    matched_count = len(matched_skills)
    missing_count = len(missing_skills)
    total = matched_count + missing_count

    skill_ratio = matched_count / total if total > 0 else 0.5
    base = round(skill_ratio * 70)

    critical_missing = sum(1 for s in missing_skills if s.get("importance") == "Critical")
    high_missing = sum(1 for s in missing_skills if s.get("importance") == "High")

    bonus = 0
    if critical_missing == 0: bonus += 15
    elif critical_missing == 1: bonus += 8
    if high_missing == 0: bonus += 10
    elif high_missing <= 2: bonus += 5
    if matched_count >= 8: bonus += 5

    overall_score = min(base + bonus, 100)

    if overall_score >= 80:   verdict = "Strong Match"
    elif overall_score >= 65: verdict = "Good Match"
    elif overall_score >= 45: verdict = "Partial Match"
    else:                     verdict = "Weak Match"

    # ── Step 4: Get narrative feedback ──
    feedback_prompt = f"""
You are a career coach. Based on this resume vs job description analysis, provide feedback.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

MATCHED SKILLS: {json.dumps([s["skill"] for s in matched_skills])}
MISSING SKILLS: {json.dumps([s["skill"] for s in missing_skills])}
SCORE: {overall_score}/100

Return ONLY a valid JSON object (no markdown):
{{
  "summary": "<2-3 sentence honest summary citing specific matched/missing skills>",
  "strengths": [
    {{"title": "<strength>", "detail": "<specific evidence from resume>"}}
  ],
  "gaps": [
    {{"title": "<gap>", "detail": "<impact on fit>"}}
  ],
  "resume_improvements": [
    {{"section": "<section>", "current": "<current text>", "suggestion": "<improvement>"}}
  ],
  "ats_keywords_missing": ["<keyword>"],
  "interview_prep": [
    {{"question": "<question>", "tip": "<how to answer>"}}
  ]
}}
"""
    try:
        fb_raw = await call_gemini(feedback_prompt)
        fb_clean = clean_json_response(fb_raw)
        fb_match = re.search(r'\{.*\}', fb_clean, re.DOTALL)
        feedback = json.loads(fb_match.group(0)) if fb_match else {}
    except Exception:
        feedback = {}

    result = {
        "overall_score": overall_score,
        "verdict": verdict,
        "summary": feedback.get("summary", f"Matched {matched_count} of {total} required skills."),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "strengths": feedback.get("strengths", []),
        "gaps": feedback.get("gaps", []),
        "resume_improvements": feedback.get("resume_improvements", []),
        "ats_keywords_missing": feedback.get("ats_keywords_missing", []),
        "interview_prep": feedback.get("interview_prep", []),
    }

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
        raw = await call_gemini(prompt)
        cleaned = clean_json_response(raw)
        json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if json_match:
            cleaned = json_match.group(0)
        result = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned malformed JSON. Please try again. ({str(e)})")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {str(e)}")

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

    async with httpx.AsyncClient(timeout=30) as http:
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

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Failed to fetch GitHub data: {str(e)}")

        # Check READMEs for top 5 repos in parallel
        top_repos = [r for r in repos[:10] if not r.get("fork", False)][:5]
        if len(top_repos) == 0:
            top_repos = repos[:5]

        async def check_readme(repo_name):
            try:
                r = await http.get(
                    f"https://api.github.com/repos/{username}/{repo_name}/readme",
                    headers=gh_headers,
                )
                return repo_name, r.status_code == 200
            except Exception:
                return repo_name, False

        readme_results = await asyncio.gather(*[check_readme(r["name"]) for r in top_repos])
        readme_map = dict(readme_results)

    # Build repo summaries
    repo_summaries = []
    for r in repos[:10]:
        repo_summaries.append({
            "name": r.get("name"),
            "description": r.get("description") or "NO DESCRIPTION",
            "language": r.get("language") or "Unknown",
            "stars": r.get("stargazers_count", 0),
            "forks": r.get("forks_count", 0),
            "has_readme": readme_map.get(r.get("name"), False),
            "has_description": bool((r.get("description") or "").strip()),
            "has_topics": len(r.get("topics", [])) > 0,
            "topics": r.get("topics", []),
            "updated_at": r.get("updated_at", "")[:10],
            "is_fork": r.get("fork", False),
        })

    total_repos = len(repos)
    repos_with_desc = sum(1 for r in repo_summaries if r["has_description"])
    original_repos = sum(1 for r in repo_summaries if not r["is_fork"])
    total_stars = sum(r["stars"] for r in repo_summaries)
    languages_used = list(set(r["language"] for r in repo_summaries if r["language"] != "Unknown"))
    has_bio = bool((user_data.get("bio") or "").strip())
    has_name = bool((user_data.get("name") or "").strip())
    has_location = bool((user_data.get("location") or "").strip())
    has_blog = bool((user_data.get("blog") or "").strip())

    # ── Calculate score entirely in Python (not AI) ──
    # Bio completeness (0-15)
    bio_score = 0
    if has_bio: bio_score += 8
    if has_name: bio_score += 3
    if has_location: bio_score += 2
    if has_blog: bio_score += 2
    bio_score = min(bio_score, 15)

    # Repo count — original only (0-15)
    if original_repos == 0:   repo_count_score = 0
    elif original_repos <= 2: repo_count_score = 4
    elif original_repos <= 5: repo_count_score = 8
    elif original_repos <= 10: repo_count_score = 12
    else:                      repo_count_score = 15

    # Repo quality — descriptions + topics (0-20)
    desc_ratio = repos_with_desc / max(len(repo_summaries), 1)
    topics_count = sum(1 for r in repo_summaries if r["has_topics"])
    repo_quality_score = round(desc_ratio * 12) + min(topics_count * 2, 8)
    repo_quality_score = min(repo_quality_score, 20)

    # README quality (0-20) — only score against repos actually checked (top 5)
    checked_repos = [r for r in repo_summaries if r["name"] in readme_map]
    num_checked = len(checked_repos)
    repos_with_readme = sum(1 for r in checked_repos if r["has_readme"])

    if num_checked == 0:
        readme_score = 0
    else:
        readme_ratio = repos_with_readme / num_checked
        readme_score = round(readme_ratio * 20)

    # Tech diversity (0-15)
    num_langs = len(languages_used)
    if num_langs == 0:   tech_score = 0
    elif num_langs == 1: tech_score = 4
    elif num_langs == 2: tech_score = 8
    elif num_langs == 3: tech_score = 11
    else:                tech_score = 15

    # Stars / engagement (0-15)
    if total_stars == 0:    stars_score = 2
    elif total_stars <= 5:  stars_score = 6
    elif total_stars <= 20: stars_score = 11
    else:                   stars_score = 15

    score_breakdown = {
        "bio_completeness": bio_score,
        "repo_count": repo_count_score,
        "repo_quality": repo_quality_score,
        "readme_quality": readme_score,
        "tech_diversity": tech_score,
        "community_engagement": stars_score,
    }
    overall_score = sum(score_breakdown.values())
    if overall_score >= 85:   grade = "A"
    elif overall_score >= 70: grade = "B"
    elif overall_score >= 50: grade = "C"
    else:                     grade = "D"

    readme_quality_label = (
        "Excellent" if readme_score >= 18 else
        "Good" if readme_score >= 14 else
        "Basic" if readme_score >= 8 else
        "Poor"
    )

    profile_data = {
        "username": username,
        "name": user_data.get("name") or "",
        "bio": user_data.get("bio") or "NO BIO SET",
        "public_repos": user_data.get("public_repos", 0),
        "followers": user_data.get("followers", 0),
        "blog_or_portfolio": user_data.get("blog") or "NONE",
        "stats": {
            "original_repos": original_repos,
            "repos_with_description": repos_with_desc,
            "repos_with_readme": repos_with_readme,
            "total_stars": total_stars,
            "languages_used": languages_used,
        },
        "repos": repo_summaries,
    }

    prompt = f"""
You are a technical recruiter giving feedback on a student's GitHub profile.
{"Target role: " + target_role if target_role else "General software developer role."}

PROFILE DATA:
{json.dumps(profile_data, indent=2)}

SCORES (already calculated — do NOT change these numbers):
- Overall: {overall_score}/100  Grade: {grade}
- Bio completeness: {bio_score}/15
- Repo count: {repo_count_score}/15
- Repo quality: {repo_quality_score}/20
- README quality: {readme_score}/20
- Tech diversity: {tech_score}/15
- Community engagement: {stars_score}/15

Your job is ONLY to write the text feedback based on these scores and the profile data above.
Reference actual repo names and real numbers in your feedback.

Return ONLY a valid JSON object (no markdown):
{{
  "overall_score": {overall_score},
  "grade": "{grade}",
  "score_breakdown": {json.dumps(score_breakdown)},
  "summary": "<2-3 sentences referencing actual repo names and stats>",
  "profile_strengths": [
    {{"title": "<strength>", "detail": "<cite specific repo names or actual numbers>"}}
  ],
  "profile_weaknesses": [
    {{"title": "<weakness>", "detail": "<specific missing thing and its impact>"}}
  ],
  "top_repos": [
    {{
      "name": "<actual repo name from the data>",
      "why": "<specific observation>",
      "improvement": "<one concrete fix>"
    }}
  ],
  "readme_quality": "{readme_quality_label}",
  "readme_tips": ["<tip1>", "<tip2>"],
  "missing_for_role": ["<gap1 for target role>", "<gap2>"],
  "action_items": [
    {{
      "priority": "<High|Medium|Low>",
      "action": "<specific action>",
      "impact": "<why recruiters care>"
    }}
  ],
  "bio_suggestion": "<rewritten bio using their actual languages and projects>",
  "pinned_repos_suggestion": "<name actual repos from data that should be pinned and why>"
}}
"""

    try:
        raw = await call_gemini(prompt)
        cleaned = clean_json_response(raw)
        json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if json_match:
            cleaned = json_match.group(0)
        result = json.loads(cleaned)
        # Always enforce Python-calculated scores regardless of what AI returns
        result["overall_score"] = overall_score
        result["grade"] = grade
        result["score_breakdown"] = score_breakdown
        result["readme_quality"] = readme_quality_label
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned malformed JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {str(e)}")

    return JSONResponse(content=result)