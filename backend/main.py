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
You are an expert technical recruiter. Analyze the resume against the job description.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_description}

Return ONLY a valid JSON object (no markdown) with this exact structure:
{{
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
    {{"section": "<section name>", "current": "<what it says now>", "suggestion": "<exact improvement>"}}
  ],
  "ats_keywords_missing": ["<keyword1>", "<keyword2>"],
  "interview_prep": [
    {{"question": "<likely interview question>", "tip": "<how to answer it>"}}
  ]
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

    # ── Calculate score in Python, not AI ──
    matched = len(result.get("matched_skills", []))
    missing = result.get("missing_skills", [])
    total_skills = matched + len(missing)

    # Base score from skill match ratio
    if total_skills == 0:
        skill_ratio = 0.5
    else:
        skill_ratio = matched / total_skills

    base = round(skill_ratio * 70)  # max 70 from skills

    # Bonus points
    critical_missing = sum(1 for s in missing if s.get("importance") == "Critical")
    high_missing = sum(1 for s in missing if s.get("importance") == "High")

    bonus = 0
    if critical_missing == 0: bonus += 15   # no critical gaps
    elif critical_missing == 1: bonus += 8
    if high_missing == 0: bonus += 10
    elif high_missing <= 2: bonus += 5
    if matched >= 8: bonus += 5             # strong skill breadth

    overall_score = min(base + bonus, 100)

    # Verdict based on score
    if overall_score >= 80:   verdict = "Strong Match"
    elif overall_score >= 65: verdict = "Good Match"
    elif overall_score >= 45: verdict = "Partial Match"
    else:                     verdict = "Weak Match"

    result["overall_score"] = overall_score
    result["verdict"] = verdict

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

    # ── Score in Python — student-fair rubric ──

    # Bio completeness (0-15)
    # Bio is most important — name alone gives decent score
    bio_score = 0
    if has_name: bio_score += 5        # having a real name set
    if has_bio: bio_score += 7         # bio description
    if has_blog: bio_score += 2        # portfolio/website
    if has_location: bio_score += 1    # location (optional, low weight)
    bio_score = min(bio_score, 15)

    # Repo count — original only (0-15)
    # Students typically have 3-8 repos — be fair
    if original_repos == 0:    repo_count_score = 0
    elif original_repos == 1:  repo_count_score = 4
    elif original_repos <= 3:  repo_count_score = 8
    elif original_repos <= 6:  repo_count_score = 11
    elif original_repos <= 10: repo_count_score = 13
    else:                      repo_count_score = 15

    # Repo quality — descriptions + topics (0-20)
    desc_ratio = repos_with_desc / max(len(repo_summaries), 1)
    topics_count = sum(1 for r in repo_summaries if r["has_topics"])
    repo_quality_score = round(desc_ratio * 14) + min(topics_count * 2, 6)
    repo_quality_score = min(repo_quality_score, 20)

    # README quality (0-20) — only score checked repos
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
    elif num_langs == 1: tech_score = 6
    elif num_langs == 2: tech_score = 10
    elif num_langs == 3: tech_score = 13
    else:                tech_score = 15

    # Stars / engagement (0-15)
    # Most students have 0 stars — don't punish, give base points
    if total_stars == 0:    stars_score = 5   # base: shows they're active
    elif total_stars <= 3:  stars_score = 8
    elif total_stars <= 10: stars_score = 11
    elif total_stars <= 30: stars_score = 13
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

    # Student-fair grade boundaries
    if overall_score >= 80:   grade = "A"
    elif overall_score >= 62: grade = "B"
    elif overall_score >= 44: grade = "C"
    else:                     grade = "D"

    readme_quality_label = (
        "Excellent" if readme_score >= 18 else
        "Good" if readme_score >= 12 else
        "Basic" if readme_score >= 6 else
        "Poor"
    )

    profile_data = {
        "username": username,
        "name": user_data.get("name") or "NOT SET",
        "bio": user_data.get("bio") or "NOT SET",
        "public_repos": user_data.get("public_repos", 0),
        "followers": user_data.get("followers", 0),
        "blog_or_portfolio": user_data.get("blog") or "NOT SET",
        "location": user_data.get("location") or "NOT SET",
        "stats": {
            "total_public_repos": total_repos,
            "original_repos": original_repos,
            "forked_repos": total_repos - original_repos,
            "repos_with_description": repos_with_desc,
            "repos_without_description": len(repo_summaries) - repos_with_desc,
            "repos_checked_for_readme": num_checked,
            "repos_with_readme": repos_with_readme,
            "repos_without_readme": num_checked - repos_with_readme,
            "total_stars": total_stars,
            "languages_used": languages_used,
            "num_languages": num_langs,
        },
        "repos": repo_summaries,
    }

    prompt = f"""
You are a senior technical recruiter reviewing a student's GitHub profile for job applications.
{"Target role: " + target_role if target_role else "General software developer role."}

REAL PROFILE DATA (fetched live):
{json.dumps(profile_data, indent=2)}

PRE-CALCULATED SCORES (do NOT change these numbers — just use them to write feedback):
Overall: {overall_score}/100  Grade: {grade}
- Bio & Profile: {bio_score}/15
- Repo Count: {repo_count_score}/15
- Repo Quality (descriptions/topics): {repo_quality_score}/20
- README Quality: {readme_score}/20
- Tech Diversity: {tech_score}/15
- Stars & Engagement: {stars_score}/15

Write SPECIFIC, ACTIONABLE feedback. Do NOT write vague things like "improve your profile."
Instead, say EXACTLY what is missing and EXACTLY what to do — reference actual repo names, actual numbers from the data.

For weaknesses: be direct. If bio is not set, say "Your bio is completely empty — recruiters skip profiles with no bio."
For action items: give the exact step. "Add a description to your ResumeMatcher repo explaining what it does and the tech stack."
For bio_suggestion: write an actual ready-to-use bio based on their repos and languages. Make it 1-2 lines, professional.

Return ONLY valid JSON (no markdown):
{{
  "overall_score": {overall_score},
  "grade": "{grade}",
  "score_breakdown": {json.dumps(score_breakdown)},
  "summary": "<2-3 sentences using actual numbers: X original repos, Y languages, Z stars etc>",
  "profile_strengths": [
    {{"title": "<strength>", "detail": "<cite the actual repo name or stat that shows this strength>"}}
  ],
  "profile_weaknesses": [
    {{"title": "<weakness>", "detail": "<exactly what is missing and why it hurts with recruiters>"}}
  ],
  "top_repos": [
    {{
      "name": "<exact repo name from data>",
      "why": "<what stands out — good or bad>",
      "improvement": "<one precise thing to add or fix in this repo>"
    }}
  ],
  "readme_quality": "{readme_quality_label}",
  "readme_tips": [
    "<exact section to add to README e.g. 'Add a Screenshots section showing the app UI'>",
    "<another exact tip>"
  ],
  "missing_for_role": [
    "<specific thing missing for {target_role if target_role else 'a developer role'} e.g. 'No deployed project links anywhere'>"
  ],
  "action_items": [
    {{
      "priority": "<High|Medium|Low>",
      "action": "<exact step e.g. 'Go to github.com/settings/profile and fill in your bio with your tech stack and goals'>",
      "impact": "<what recruiter thinks when they see this missing>"
    }}
  ],
  "bio_suggestion": "<write a ready-to-use 1-2 line bio based on their actual repos and languages>",
  "pinned_repos_suggestion": "<name 3-6 actual repos from the data that should be pinned, explain why each one>"
}}
"""

    try:
        raw = await call_gemini(prompt)
        cleaned = clean_json_response(raw)
        json_match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if json_match:
            cleaned = json_match.group(0)
        result = json.loads(cleaned)
        # Always enforce Python-calculated scores
        result["overall_score"] = overall_score
        result["grade"] = grade
        result["score_breakdown"] = score_breakdown
        result["readme_quality"] = readme_quality_label
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=502, detail=f"AI returned malformed JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI error: {str(e)}")

    return JSONResponse(content=result)