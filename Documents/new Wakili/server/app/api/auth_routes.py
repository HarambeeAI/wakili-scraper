"""Auth endpoints: signup, login, me, team invites."""

from __future__ import annotations

import logging
import secrets
import smtplib
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.config import settings
from app.database import get_db
from app.models import Invite, Organization, User

log = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


# ---------- Schemas ----------


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    plan: str = "professional"  # professional | team
    org_name: str = ""  # required if plan == team


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class InviteRequest(BaseModel):
    email: EmailStr


class AcceptInviteRequest(BaseModel):
    token: str
    name: str
    password: str


class AuthResponse(BaseModel):
    access_token: str
    user: dict


# ---------- Helpers ----------


def _user_dict(user: User) -> dict:
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "plan": user.plan,
        "org_id": str(user.org_id) if user.org_id else None,
        "is_org_admin": user.is_org_admin,
    }


def _send_invite_email(to_email: str, invite_token: str, org_name: str, inviter_name: str):
    """Send invite email. Fails silently if SMTP not configured."""
    if not settings.SMTP_HOST:
        log.warning(f"SMTP not configured — invite link for {to_email}: {settings.APP_URL}/invite/{invite_token}")
        return

    link = f"{settings.APP_URL}/invite/{invite_token}"
    html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 32px;">
        <h2>You've been invited to Lawlyfy</h2>
        <p><strong>{inviter_name}</strong> has invited you to join <strong>{org_name}</strong> on Lawlyfy AI — the intelligent legal research platform.</p>
        <p><a href="{link}" style="display: inline-block; padding: 12px 24px; background: #7c5cfc; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Accept Invitation</a></p>
        <p style="color: #666; font-size: 12px;">If the button doesn't work, copy this link: {link}</p>
    </div>
    """
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"{inviter_name} invited you to {org_name} on Lawlyfy"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())
        log.info(f"Invite email sent to {to_email}")
    except Exception as e:
        log.error(f"Failed to send invite email to {to_email}: {e}")


# ---------- Endpoints ----------


@router.post("/signup", response_model=AuthResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    """Create a new user account."""
    # Check duplicate email
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    org = None
    org_id = None
    is_org_admin = False

    if req.plan == "team":
        if not req.org_name.strip():
            raise HTTPException(status_code=400, detail="Organization name is required for team plan")
        org = Organization(name=req.org_name.strip())
        db.add(org)
        await db.flush()
        org_id = org.id
        is_org_admin = True

    user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        name=req.name,
        plan=req.plan,
        org_id=org_id,
        is_org_admin=is_org_admin,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=_user_dict(user))


@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Log in with email + password."""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is deactivated")

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=_user_dict(user))


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user profile."""
    return _user_dict(user)


# ---------- Team / Invites ----------


@router.post("/invite")
async def invite_member(
    req: InviteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a colleague to the organization (team plan only)."""
    if user.plan != "team" or not user.org_id:
        raise HTTPException(status_code=403, detail="Only team plan users can invite members")

    if not user.is_org_admin:
        raise HTTPException(status_code=403, detail="Only organization admins can invite members")

    # Check seat limit
    result = await db.execute(
        select(func.count(User.id)).where(User.org_id == user.org_id)
    )
    current_seats = result.scalar() or 0

    result2 = await db.execute(
        select(Organization).where(Organization.id == user.org_id)
    )
    org = result2.scalar_one()

    if current_seats >= org.max_seats:
        raise HTTPException(
            status_code=403,
            detail=f"Seat limit reached ({org.max_seats} seats). Contact support to add more."
        )

    # Check if already a member
    existing_user = await db.execute(
        select(User).where(User.email == req.email, User.org_id == user.org_id)
    )
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="This user is already a member")

    # Check if invite already sent
    existing_invite = await db.execute(
        select(Invite).where(Invite.email == req.email, Invite.org_id == user.org_id, Invite.accepted == False)
    )
    if existing_invite.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Invite already sent to this email")

    invite = Invite(
        org_id=user.org_id,
        email=req.email,
        invited_by=user.id,
        token=secrets.token_urlsafe(48),
    )
    db.add(invite)
    await db.commit()

    _send_invite_email(req.email, invite.token, org.name, user.name)

    return {"message": f"Invite sent to {req.email}", "invite_id": str(invite.id)}


@router.get("/team")
async def get_team_members(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all team members and pending invites."""
    if not user.org_id:
        return {"members": [_user_dict(user)], "invites": [], "max_seats": 1}

    # Members
    result = await db.execute(select(User).where(User.org_id == user.org_id))
    members = [_user_dict(u) for u in result.scalars().all()]

    # Pending invites
    result2 = await db.execute(
        select(Invite).where(Invite.org_id == user.org_id, Invite.accepted == False)
    )
    invites = [
        {"id": str(inv.id), "email": inv.email, "created_at": inv.created_at.isoformat()}
        for inv in result2.scalars().all()
    ]

    # Org info
    result3 = await db.execute(select(Organization).where(Organization.id == user.org_id))
    org = result3.scalar_one()

    return {"members": members, "invites": invites, "max_seats": org.max_seats, "org_name": org.name}


@router.post("/invite/accept", response_model=AuthResponse)
async def accept_invite(req: AcceptInviteRequest, db: AsyncSession = Depends(get_db)):
    """Accept a team invite and create a user account."""
    result = await db.execute(select(Invite).where(Invite.token == req.token, Invite.accepted == False))
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or already used invite")

    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Check if email already has an account
    existing = await db.execute(select(User).where(User.email == invite.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Account already exists for this email. Please log in.")

    user = User(
        email=invite.email,
        password_hash=hash_password(req.password),
        name=req.name,
        plan="team",
        org_id=invite.org_id,
        is_org_admin=False,
    )
    db.add(user)

    invite.accepted = True
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.id)
    return AuthResponse(access_token=token, user=_user_dict(user))


@router.get("/invite/{token}")
async def get_invite_info(token: str, db: AsyncSession = Depends(get_db)):
    """Get invite details (for the accept invite page)."""
    result = await db.execute(select(Invite).where(Invite.token == token, Invite.accepted == False))
    invite = result.scalar_one_or_none()

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid or already used invite")

    result2 = await db.execute(select(Organization).where(Organization.id == invite.org_id))
    org = result2.scalar_one()

    return {"email": invite.email, "org_name": org.name}
