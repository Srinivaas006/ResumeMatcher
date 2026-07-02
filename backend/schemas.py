from datetime import datetime
from pydantic import BaseModel, EmailStr

class SignupRequest(BaseModel):
    email: EmailStr
    name: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    name: str
    email: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

class AnalysisHistoryItem(BaseModel):
    id: int
    job_title: str
    score: int
    verdict: str
    analyzed_at: datetime

    class Config:
        from_attributes = True

class AnalysisHistoryDetail(BaseModel):
    id: int
    job_title: str
    job_description: str
    resume_text: str
    score: int
    verdict: str
    result_json: str
    analyzed_at: datetime

    class Config:
        from_attributes = True