from decimal import Decimal
from datetime import datetime, timedelta, timezone as dt_timezone
import uuid
import json
import re
import difflib
import requests
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from django.conf import settings
from django.db import transaction
from django.db.models import Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from google import genai
from google.genai import types
from .gemini_client import resolve_gemini_model_name
from .models import (
    ServiceRequest, RequestImage, Category, Provider, RateCard,
    Job, Bid, Request, SystemSettings
)
from .tasks import process_service_request
from .utils import calculate_match_score, calculate_distance
from .notifications import send_notification
from .audit import log_audit, AuditLog
from .security import require_verified_email

MIN_PROVIDER_MARGIN_PCT = Decimal("0.20")


def _to_decimal(value, default="0"):
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _safe_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def _estimate_for_request(category, severity, provider_count):
    rate_card = RateCard.objects.filter(
        category=category,
        min_severity__lte=severity,
        max_severity__gte=severity
    ).first()
    if not rate_card:
        rate_card = RateCard.objects.filter(category=category).first()
    base_fee = _to_decimal(getattr(rate_card, "base_fee", 0), "50")
    hourly_rate = _to_decimal(getattr(rate_card, "hourly_rate", 0), "40")

    past_jobs = Job.objects.filter(
        request__category=category,
        status='completed'
    )
    avg_budget = past_jobs.aggregate(avg=Avg('request__budget'))['avg']
    historical_budget = _to_decimal(avg_budget, "0")

    past_bids = Bid.objects.filter(request__category=category, status='accepted')
    avg_bid = past_bids.aggregate(avg=Avg('amount'))['avg']
    historical_bid = _to_decimal(avg_bid, "0")

    est_hours = Decimal("1.5") + Decimal(severity) * Decimal("0.35")
    est_hours = max(est_hours, Decimal("1.0"))
    market_anchor = max(historical_budget, historical_bid, base_fee + (hourly_rate * est_hours))

    floor_budget = (base_fee + (hourly_rate * est_hours)) * (Decimal("1.0") + MIN_PROVIDER_MARGIN_PCT)
    recommended_budget = max(floor_budget, market_anchor)
    if provider_count <= 1:
        recommended_budget *= Decimal("1.05")

    return {
        "est_hours": float(round(est_hours, 2)),
        "budget_floor": float(round(floor_budget, 2)),
        "budget_recommended": float(round(recommended_budget, 2)),
    }


def _rank_providers(payload, category, budget_recommended):
    require_verified = bool(getattr(SystemSettings.get_settings(), "require_provider_verification", True))
    providers = Provider.objects.filter(
        categories=category,
        availability_status='available'
    ).select_related('user')
    if require_verified:
        providers = providers.filter(verification_status='verified')
    ranked = []
    for provider in providers:
        score = calculate_match_score(payload, provider)
        if score <= 0:
            continue
        completed_jobs = Job.objects.filter(provider=provider, status='completed').count()
        avg_earnings = Job.objects.filter(provider=provider, status='completed').aggregate(
            avg=Avg('provider_earnings')
        )['avg']
        avg_earnings = _to_decimal(avg_earnings, "0")
        min_profitable_quote = max(_to_decimal(budget_recommended) * Decimal("0.75"), avg_earnings * Decimal("0.8"))
        distance_km = None
        if payload.get('latitude') and payload.get('longitude') and hasattr(provider.user, 'profile'):
            distance_km = calculate_distance(
                payload['latitude'],
                payload['longitude'],
                provider.user.profile.latitude,
                provider.user.profile.longitude,
            )
        ranked.append({
            "provider_id": provider.id,
            "provider_name": provider.user.get_full_name() or provider.user.username,
            "user": {
                "first_name": provider.user.first_name or provider.user.username,
                "last_name": provider.user.last_name or "",
                "username": provider.user.username,
            },
            "rating": float(provider.rating or 0),
            "match_score": float(score),
            "completed_jobs": completed_jobs,
            "experience_years": provider.experience_years or 0,
            "verification_status": provider.verification_status or "pending",
            "bio": (provider.bio or "")[:120],
            "skills": (provider.skills or [])[:5],
            "expected_cost": float(round(min_profitable_quote, 2)),
            "distance_km": distance_km,
            "profit_floor_pass": float(round(_to_decimal(budget_recommended), 2)) >= float(round(min_profitable_quote, 2)),
        })
    ranked.sort(key=lambda p: (p["match_score"], p["rating"], p["completed_jobs"]), reverse=True)
    return ranked[:10]


def _business_scores(provider_count, ranked, estimate):
    conversion_score = min(100.0, 35.0 + (provider_count * 8.0))
    if ranked and ranked[0]["match_score"] > 80:
        conversion_score += 10
    conversion_score = min(100.0, conversion_score)

    floor = _to_decimal(estimate["budget_floor"], "1")
    recommended = _to_decimal(estimate["budget_recommended"], "1")
    margin_ratio = float(recommended / floor) if floor > 0 else 1.0
    margin_score = min(100.0, max(40.0, margin_ratio * 55.0))

    if ranked:
        top = ranked[0]
        distance = float(top.get("distance_km") or 12.0)
        fulfillment_speed_score = max(25.0, 100.0 - (distance * 4.0))
    else:
        fulfillment_speed_score = 30.0

    composite = (conversion_score * 0.40) + (margin_score * 0.35) + (fulfillment_speed_score * 0.25)
    return {
        "conversion_score": round(conversion_score, 2),
        "margin_score": round(margin_score, 2),
        "fulfillment_speed_score": round(fulfillment_speed_score, 2),
        "composite_score": round(composite, 2),
    }


def _recommend_mode(ranked):
    mode = "manual"
    reason = "Manual selection is recommended because multiple high-confidence providers are available."
    if len(ranked) < 2:
        mode = "broadcast"
        reason = "Broadcast is recommended because immediate top matches are limited."
    elif ranked and ranked[0]["match_score"] >= 85:
        mode = "auto"
        reason = "Auto mode is recommended because a high-confidence top provider is available."
    return mode, reason


def _dispatch_jobs_for_request(req, category, mode, selected_provider_id, ranked):
    """Create Job rows and notify providers. Returns (job_ids, error_response_or_none)."""
    jobs_created = []
    if mode == "manual":
        if not selected_provider_id:
            return None, Response({"error": "selected_provider is required in manual mode."}, status=400)
        provider = Provider.objects.filter(id=selected_provider_id, categories=category).first()
        if not provider:
            return None, Response({"error": "Selected provider is not valid for this category."}, status=400)
        job = Job.objects.create(request=req, provider=provider, status='pending')
        jobs_created.append(job.id)
        send_notification(
            user_id=provider.user.id,
            message=f"New Job Opportunity: {req.title}",
            type='new_job',
            payload={'job_id': job.id, 'request_id': req.id},
        )
    elif mode == "auto":
        if not ranked:
            return None, Response({"error": "No providers available for auto mode."}, status=400)
        provider = Provider.objects.filter(id=ranked[0]["provider_id"]).first()
        job = Job.objects.create(request=req, provider=provider, status='pending')
        jobs_created.append(job.id)
        send_notification(
            user_id=provider.user.id,
            message=f"New Job Opportunity: {req.title}",
            type='new_job',
            payload={'job_id': job.id, 'request_id': req.id},
        )
    else:
        providers = Provider.objects.filter(categories=category, availability_status='available')
        if bool(getattr(SystemSettings.get_settings(), "require_provider_verification", True)):
            providers = providers.filter(verification_status='verified')
        for provider in providers:
            job = Job.objects.create(request=req, provider=provider, status='pending')
            jobs_created.append(job.id)
            send_notification(
                user_id=provider.user.id,
                message=f"New Job Opportunity: {req.title}",
                type='new_job',
                payload={'job_id': job.id, 'request_id': req.id},
            )
    return jobs_created, None


def _escrow_publish_enabled(mode):
    if mode == "broadcast":
        return False
    if not getattr(settings, "ESCROW_ON_PUBLISH", True):
        return False
    ss = SystemSettings.get_settings()
    return bool((ss.stripe_secret_key or "").strip())


def finalize_escrow_jobs(request_id: int):
    """
    After successful escrow Checkout, create jobs that were deferred at publish time.
    Idempotent: only runs while escrow_status is awaiting_payment.
    """
    with transaction.atomic():
        req = (
            Request.objects.select_for_update()
            .select_related("user", "user__profile", "category")
            .filter(id=request_id)
            .first()
        )
        if not req or req.escrow_status != "awaiting_payment":
            return
        category = req.category
        if not category:
            return
        profile = getattr(req.user, "profile", None)
        if not profile:
            return
        summary = req.ai_summary or {}
        mode = summary.get("decision_mode") or "manual"
        raw_sel = summary.get("selected_provider_id")
        try:
            selected_provider_id = int(raw_sel) if raw_sel not in (None, "") else None
        except (TypeError, ValueError):
            selected_provider_id = None
        severity = _safe_int(summary.get("severity_score"), 5)
        estimate = _estimate_for_request(category, severity, 10)
        final_budget = req.budget or _to_decimal(estimate["budget_recommended"])
        payload_ctx = {
            "category": category.id,
            "category_id": category.id,
            "title": req.title,
            "description": req.description,
            "latitude": summary.get("latitude") or profile.latitude,
            "longitude": summary.get("longitude") or profile.longitude,
        }
        ranked = _rank_providers(payload_ctx, category, float(final_budget))
        jobs_created, err = _dispatch_jobs_for_request(req, category, mode, selected_provider_id, ranked)
        if err:
            return
        req.escrow_status = "funded"
        req.save(update_fields=["escrow_status", "updated_at"])


def _create_request_and_jobs(*, actor_user, payload, audit_request=None, source_event="request_flow_decision", group_id=""):
    category = Category.objects.filter(id=payload.get("category_id"), is_active=True).first()
    if not category:
        return None, Response({"error": "Invalid category_id."}, status=400)

    profile = getattr(actor_user, "profile", None)
    if not profile or not (profile.address or "").strip():
        return None, Response({"error": "Profile address is required."}, status=400)

    mode = payload.get("mode", "manual")
    if mode not in {"manual", "auto", "broadcast"}:
        return None, Response({"error": "mode must be manual, auto, or broadcast."}, status=400)

    severity = _safe_int(payload.get("severity_score"), 5)
    estimate = _estimate_for_request(category, severity, provider_count=10)
    final_budget = _to_decimal(payload.get("budget_recommended"), str(estimate["budget_recommended"]))
    if final_budget < _to_decimal(estimate["budget_floor"]):
        return None, Response({
            "error": "Budget violates strict provider-profit floor.",
            "budget_floor": estimate["budget_floor"],
        }, status=400)

    rewritten_description = str(payload.get("rewritten_description") or "").strip()
    raw_description = str(payload.get("description", "")).strip()
    final_description = rewritten_description or raw_description

    sel_raw = payload.get("selected_provider")
    try:
        selected_provider_id = int(sel_raw) if sel_raw not in (None, "") else None
    except (TypeError, ValueError):
        selected_provider_id = None

    lat_save = payload.get("latitude") or profile.latitude
    lon_save = payload.get("longitude") or profile.longitude

    def _coord_json(val):
        if val is None or val == "":
            return None
        try:
            return float(val)
        except (TypeError, ValueError):
            return None

    req = Request.objects.create(
        user=actor_user,
        group_id=str(group_id or "").strip(),
        category=category,
        title=str(payload.get("title", "")).strip(),
        description=final_description,
        address=profile.address,
        preferred_date=payload.get("preferred_date"),
        budget=final_budget,
        status='pending',
        escrow_status='not_required',
        ai_summary={
            "rewritten_description": rewritten_description,
            "original_description": raw_description,
            "estimated_hours": estimate["est_hours"],
            "budget_floor": estimate["budget_floor"],
            "budget_recommended": float(final_budget),
            "decision_mode": mode,
            "selected_provider_id": selected_provider_id,
            "severity_score": severity,
            "latitude": _coord_json(lat_save),
            "longitude": _coord_json(lon_save),
            "source_event": source_event,
        },
    )

    ranked = _rank_providers({
        "category": category.id,
        "category_id": category.id,
        "title": req.title,
        "description": req.description,
        "latitude": lat_save,
        "longitude": lon_save,
    }, category, final_budget)

    use_escrow = _escrow_publish_enabled(mode)
    mode_recommended, reason = _recommend_mode(ranked)
    scores = _business_scores(len(ranked), ranked, estimate)

    session = None
    if use_escrow:
        from .payments import create_escrow_checkout_session
        req.escrow_status = 'awaiting_payment'
        req.save(update_fields=['escrow_status'])
        front = settings.FRONTEND_URL.rstrip('/')
        success_url = f"{front}/dashboard/my-requests?escrow=success&request_id={req.id}&session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{front}/create-request?escrow=cancelled&request_id={req.id}"
        try:
            session = create_escrow_checkout_session(req, success_url, cancel_url)
        except Exception as e:
            req.delete()
            return None, Response({"error": str(e), "detail": "Checkout could not be started; try again or contact support."}, status=500)
        req.escrow_checkout_session_id = session.id
        req.save(update_fields=['escrow_checkout_session_id'])
        jobs_created = []
    else:
        jobs_created, job_err = _dispatch_jobs_for_request(req, category, mode, selected_provider_id, ranked)
        if job_err:
            return None, job_err

    if mode != mode_recommended:
        log_audit(
            user=actor_user,
            action='update',
            model_name='ChatbotFlow',
            obj=req,
            changes={
                "event_name": "chat_mode_optout",
                "recommended_mode": mode_recommended,
                "selected_mode": mode,
            },
            description="User opted out from recommended AI mode",
            request=audit_request,
        )

    log_audit(
        user=actor_user,
        action='create',
        model_name='RequestDecision',
        obj=req,
        changes={
            "event_name": "chat_escrow_checkout_created" if use_escrow else (
                "chat_publish_success" if source_event == "chatbot_publish" else "request_publish_success"
            ),
            "mode": mode,
            "recommended_mode": mode_recommended,
            "jobs_created": len(jobs_created),
            "budget": float(final_budget),
            "business_scores": scores,
            "mode_reason": reason,
        },
        description='Request created via autonomous decision flow',
        request=audit_request,
    )

    response = {
        "request_id": req.id,
        "decision_mode": mode,
        "recommended_mode": mode_recommended,
        "jobs_created": len(jobs_created),
        "job_ids": jobs_created,
        "status": req.status,
        "business_scores": scores,
        "escrow_required": bool(use_escrow),
    }
    if use_escrow and session:
        response["checkout_url"] = session.url
        response["checkout_session_id"] = session.id
    return response, None

class ServiceRequestCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        require_verified_email(request.user, message="Verify your email before creating service requests.")
        description = request.data.get('description')
        images = request.FILES.getlist('images')
        lat = request.data.get('latitude')
        lon = request.data.get('longitude')

        if not description:
            return Response({'error': 'Problem description is required'}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Create ServiceRequest (INGESTING status)
        service_req = ServiceRequest.objects.create(
            customer=request.user,
            raw_description=description,
            latitude=lat,
            longitude=lon,
            status='INGESTING'
        )

        # 2. Save Images
        for img in images:
            img_obj = RequestImage.objects.create(image=img)
            service_req.images.add(img_obj)

        # 3. Trigger Async Engine
        process_service_request.delay(service_req.id)

        return Response({
            'request_id': service_req.id,
            'status': 'INGESTING',
            'message': 'Your request is being analyzed by ServeFlow AI'
        }, status=status.HTTP_201_CREATED)


class ServiceRequestSnapshotView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        profile = getattr(request.user, "profile", None)
        if not profile or not (profile.address or "").strip():
            return Response({
                "error": "Complete your profile address before creating requests."
            }, status=status.HTTP_400_BAD_REQUEST)

        category_id = request.data.get("category_id")
        title = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        preferred_date = request.data.get("preferred_date")
        if not category_id or not description or not title:
            return Response({"error": "title, description and category_id are required."}, status=400)
        category = Category.objects.filter(id=category_id, is_active=True).first()
        if not category:
            return Response({"error": "Invalid category."}, status=404)

        severity = int(request.data.get("severity_score") or 5)
        payload = {
            "category": category.id,
            "category_id": category.id,
            "title": title,
            "description": description,
            "latitude": request.data.get("latitude") or profile.latitude,
            "longitude": request.data.get("longitude") or profile.longitude,
        }
        providers_in_category = Provider.objects.filter(categories=category, availability_status='available')
        if bool(getattr(SystemSettings.get_settings(), "require_provider_verification", True)):
            providers_in_category = providers_in_category.filter(verification_status='verified')
        providers_in_category = providers_in_category.count()
        estimate = _estimate_for_request(category, severity, providers_in_category)
        ranked = _rank_providers(payload, category, estimate["budget_recommended"])

        mode, reason = _recommend_mode(ranked)
        scores = _business_scores(len(ranked), ranked, estimate)

        log_audit(
            user=request.user,
            action='create',
            model_name='ServiceRequestSnapshot',
            changes={"category_id": category.id, "recommended_mode": mode},
            description='Generated request snapshot and provider recommendations',
            request=request,
        )

        return Response({
            "analysis": {
                "title": title,
                "description": description,
                "category_id": category.id,
                "category_name": category.name,
                "preferred_date": preferred_date,
                "estimated_hours": estimate["est_hours"],
                "budget_floor": estimate["budget_floor"],
                "budget_recommended": estimate["budget_recommended"],
                "budget_range": {
                    "min": float(round(_to_decimal(estimate["budget_recommended"]) * Decimal("0.95"), 2)),
                    "max": float(round(_to_decimal(estimate["budget_recommended"]) * Decimal("1.20"), 2)),
                },
            },
            "mode_recommendation": {
                "recommended_mode": mode,
                "reason": reason,
                "allow_user_override": True,
            },
            "providers": ranked,
            "business_scores": scores,
        }, status=200)


class ServiceRequestDecisionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        result, error_response = _create_request_and_jobs(
            actor_user=request.user,
            payload=request.data,
            audit_request=request,
            source_event="request_flow_decision",
        )
        if error_response:
            return error_response
        return Response(result, status=201)


class ChatbotDraftSnapshotView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        category_id = request.data.get("category_id")
        title = str(request.data.get("title", "")).strip()
        description = str(request.data.get("description", "")).strip()
        if not category_id or not title or not description:
            return Response({"error": "category_id, title, and description are required."}, status=400)
        category = Category.objects.filter(id=category_id, is_active=True).first()
        if not category:
            return Response({"error": "Invalid category."}, status=404)

        severity = _safe_int(request.data.get("severity_score"), 5)
        payload = {
            "category": category.id,
            "category_id": category.id,
            "title": title,
            "description": description,
            "latitude": request.data.get("latitude"),
            "longitude": request.data.get("longitude"),
        }
        provider_count = Provider.objects.filter(categories=category, availability_status='available')
        if bool(getattr(SystemSettings.get_settings(), "require_provider_verification", True)):
            provider_count = provider_count.filter(verification_status='verified')
        provider_count = provider_count.count()
        estimate = _estimate_for_request(category, severity, provider_count)
        ranked = _rank_providers(payload, category, estimate["budget_recommended"])
        recommended_mode, mode_reason = _recommend_mode(ranked)
        scores = _business_scores(len(ranked), ranked, estimate)

        draft_id = request.data.get("draft_id") or str(uuid.uuid4())
        idempotency_key = request.data.get("idempotency_key") or str(uuid.uuid4())
        now = datetime.now(dt_timezone.utc)
        expires_at = now + timedelta(minutes=15)

        log_audit(
            user=request.user if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False) else None,
            action='create',
            model_name='ChatbotFlow',
            changes={
                "event_name": "chat_draft_created",
                "draft_id": draft_id,
                "category_id": category.id,
                "recommended_mode": recommended_mode,
                "business_scores": scores,
            },
            description='Chatbot draft snapshot generated',
            request=request,
        )

        return Response({
            "draft": {
                "draft_id": draft_id,
                "created_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
                "idempotency_key": idempotency_key,
                "category_id": category.id,
                "title": title,
                "description": description,
                "preferred_date": request.data.get("preferred_date"),
                "mode_preference": recommended_mode,
                "selected_provider": None,
                "severity_score": severity,
                "snapshot_data": {
                    "analysis": {
                        "estimated_hours": estimate["est_hours"],
                        "budget_floor": estimate["budget_floor"],
                        "budget_recommended": estimate["budget_recommended"],
                        "budget_range": {
                            "min": float(round(_to_decimal(estimate["budget_recommended"]) * Decimal("0.95"), 2)),
                            "max": float(round(_to_decimal(estimate["budget_recommended"]) * Decimal("1.20"), 2)),
                        },
                    },
                    "providers": ranked,
                    "recommended_mode": recommended_mode,
                    "mode_reason": mode_reason,
                    "business_scores": scores,
                },
            }
        }, status=200)


class ChatbotPublishView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if request.data.get("final_confirmed") is not True:
            return Response({"error": "final_confirmed=true is required before publish."}, status=400)

        idempotency_key = str(request.data.get("idempotency_key", "")).strip()
        if not idempotency_key:
            return Response({"error": "idempotency_key is required."}, status=400)

        existing = AuditLog.objects.filter(
            user=request.user,
            model_name='RequestDecision',
            changes__event_name='chat_publish_success',
            changes__idempotency_key=idempotency_key
        ).first()
        if existing:
            return Response({
                "status": "already_published",
                "request_id": existing.object_id,
                "message": "This chatbot draft was already published.",
            }, status=200)

        expires_at_raw = request.data.get("draft_expires_at")
        try:
            expires_at = datetime.fromisoformat(expires_at_raw.replace("Z", "+00:00")) if expires_at_raw else None
        except Exception:
            expires_at = None
        if not expires_at or expires_at <= datetime.now(dt_timezone.utc):
            log_audit(
                user=request.user,
                action='update',
                model_name='ChatbotFlow',
                changes={"event_name": "chat_draft_expired", "idempotency_key": idempotency_key},
                description='Chatbot draft expired before publish',
                request=request,
            )
            return Response({"error": "Draft expired. Please refresh recommendation."}, status=400)

        split_enabled = bool(getattr(SystemSettings.get_settings(), "multi_issue_split_enabled", True))
        issue_groups = request.data.get("issue_groups") or []
        if not isinstance(issue_groups, list):
            issue_groups = []
        request_group_id = f"grp_{uuid.uuid4().hex[:20]}"
        created_results = []
        with transaction.atomic():
            if split_enabled and issue_groups:
                for issue in issue_groups:
                    child_payload = dict(request.data)
                    child_payload["category_id"] = issue.get("category_id")
                    child_payload["title"] = issue.get("title") or request.data.get("title")
                    child_payload["description"] = issue.get("description") or request.data.get("description")
                    child_payload["mode"] = issue.get("mode") or request.data.get("mode", "manual")
                    child_payload["selected_provider"] = issue.get("selected_provider") or request.data.get("selected_provider")
                    child_result, child_err = _create_request_and_jobs(
                        actor_user=request.user,
                        payload=child_payload,
                        audit_request=request,
                        source_event="chatbot_publish_split",
                        group_id=request_group_id,
                    )
                    if child_err:
                        return child_err
                    created_results.append(child_result)
            else:
                single_result, error_response = _create_request_and_jobs(
                    actor_user=request.user,
                    payload=request.data,
                    audit_request=request,
                    source_event="chatbot_publish",
                    group_id=request_group_id if split_enabled else "",
                )
                if error_response:
                    log_audit(
                        user=request.user,
                        action='update',
                        model_name='ChatbotFlow',
                        changes={"event_name": "chat_publish_fail", "error": error_response.data},
                        description='Chatbot publish failed',
                        request=request,
                    )
                    return error_response
                created_results.append(single_result)

        log_audit(
            user=request.user,
            action='create',
            model_name='RequestDecision',
            obj=Request.objects.filter(id=created_results[0]["request_id"]).first(),
            changes={
                "event_name": "chat_publish_success",
                "idempotency_key": idempotency_key,
                "request_group_id": request_group_id,
                "request_ids": [r["request_id"] for r in created_results],
            },
            description='Chatbot publish completed',
            request=request,
        )
        return Response({
            "status": "published",
            "request_group_id": request_group_id,
            "request_ids": [r["request_id"] for r in created_results],
            "children": created_results,
        }, status=201)


class ChatbotEventView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        event_name = str(request.data.get("event_name", "")).strip()
        if not event_name:
            return Response({"error": "event_name is required"}, status=400)
        log_audit(
            user=request.user if getattr(request, "user", None) and getattr(request.user, "is_authenticated", False) else None,
            action='update',
            model_name='ChatbotFlow',
            changes={
                "event_name": event_name,
                "stage": request.data.get("stage"),
                "reason_code": request.data.get("reason_code"),
                "context": request.data.get("context", {}),
            },
            description='Chatbot telemetry event',
            request=request,
        )
        return Response({"status": "ok"})


class ChatbotIntentView(APIView):
    permission_classes = [permissions.AllowAny]

    def _intent_via_db_gemini_keys_with_timeout(self, message, context, timeout_s: float):
        """
        Run Gemini intent generation with a hard wall-clock timeout.

        We do this because the browser has a ~28s timeout for `/api/chatbot/intent/`.
        If Gemini is slow/unavailable, we fall back to lightweight category inference.
        """
        timeout_s = float(timeout_s or 0) if timeout_s is not None else 0
        # Clamp so we never exceed the frontend timeout budget.
        # Frontend `/api/chatbot/intent/` timeout is ~28s.
        timeout_s = max(1.5, min(timeout_s, 25.0))

        with ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(self._intent_via_db_gemini_keys, message, context)
            try:
                return fut.result(timeout=timeout_s)
            except FuturesTimeoutError:
                return None, f"gemini_intent_timeout_after_{timeout_s}s"

    def _tokenize(self, text):
        tokens = []
        for raw in re.findall(r"[a-z0-9]{3,}", str(text or "").lower()):
            token = raw
            for suffix in ("ing", "age", "ed", "es", "s"):
                if token.endswith(suffix) and len(token) > len(suffix) + 2:
                    token = token[: -len(suffix)]
                    break
            tokens.append(token)
        return set(tokens)

    def _normalize_category(self, suggested, available_categories):
        raw = str(suggested or "").strip()
        if not raw:
            return ""
        for cat in available_categories:
            name = str(cat.get("name", "")).strip()
            if name.lower() == raw.lower():
                return name
        for cat in available_categories:
            name = str(cat.get("name", "")).strip()
            if raw.lower() in name.lower() or name.lower() in raw.lower():
                return name
        return ""

    def _build_default_options(self, category_name, available_categories, can_prepare_draft):
        options = []
        if not category_name and available_categories:
            for cat in available_categories[:6]:
                cid = str(cat.get("id", "")).strip()
                name = str(cat.get("name", "")).strip()
                if cid and name:
                    options.append({"label": name, "value": cid, "action": "choose_category"})
        options.extend([
            {"label": "Auto mode", "value": "auto", "action": "set_mode"},
            {"label": "Manual mode", "value": "manual", "action": "set_mode"},
        ])
        if can_prepare_draft:
            options.append({"label": "Prepare draft now", "value": "prepare_draft", "action": "prepare_draft"})
        return options[:6]

    def _normalize_optional_slots(self, parsed):
        if not isinstance(parsed, dict):
            return parsed
        raw_date = str(parsed.get("preferred_date_iso") or "").strip()
        parsed["preferred_date_iso"] = raw_date if raw_date else ""
        try:
            parsed["suggested_provider_id"] = int(parsed.get("suggested_provider_id")) if parsed.get("suggested_provider_id") not in (None, "") else None
        except (TypeError, ValueError):
            parsed["suggested_provider_id"] = None
        parsed["needs_confirmation"] = bool(parsed.get("needs_confirmation", True))
        return parsed

    def _normalize_intent_payload(self, message, parsed, available_categories):
        """Apply category normalization + trade safeguards to any intent JSON (Gemini or AI microservice)."""
        if not isinstance(parsed, dict):
            return parsed
        cat = self._normalize_category(parsed.get("suggested_category"), available_categories)
        parsed["suggested_category"] = cat
        self._reconcile_gemini_trade_with_user_text(message, parsed, available_categories)
        parsed = self._normalize_optional_slots(parsed)
        return parsed

    def _reconcile_gemini_trade_with_user_text(self, message, parsed, available_categories):
        """When wording clearly implies a trade, fix wrong AI category/description (e.g. sink leak → Plumbing)."""
        forced_name = self._infer_trade_from_keywords(message, available_categories)
        nf = self._normalize_category(forced_name, available_categories) if forced_name else ""
        if not nf:
            return

        ml = str(message or "").lower()
        desc_lc = str(parsed.get("suggested_description") or "").lower()
        current = self._normalize_category(parsed.get("suggested_category"), available_categories)

        plumb_kw = (
            "sink", "faucet", "drain", "toilet", "pipe", "leak", "leaking", "leaked", "plumb",
            "clog", "clogged", "sewer", "disposal", "water line", "p-trap",
        )
        elec_kw = (
            "outlet", "breaker", "wiring", "electrical", "fuse", "light switch", "circuit",
        )

        plumb_msg = any(k in ml for k in plumb_kw)
        elec_msg = any(k in ml for k in elec_kw)

        if plumb_msg and not elec_msg and "plumb" in nf.lower():
            parsed["suggested_category"] = nf
            if "electrical" in desc_lc or "electric" in desc_lc or (current and "electrical" in current.lower()):
                qt = str(message).strip().replace('"', "'")[:320]
                parsed["suggested_description"] = (
                    f'The customer reports: "{qt}". This describes a plumbing problem (fixture, drain, or pipe). '
                    "A licensed provider should inspect and complete the repair."
                )
            return

        if elec_msg and not plumb_msg and "electr" in nf.lower():
            parsed["suggested_category"] = nf
            return

        if not plumb_msg and not elec_msg and nf and (not current or nf.lower() != current.lower()):
            parsed["suggested_category"] = nf

    def _infer_trade_from_keywords(self, message, available_categories):
        """Map common symptom words to a category name from available_categories (fixes empty lightweight match)."""
        ml = str(message or "").lower()
        clusters = (
            ("plumbing", {"sink", "faucet", "drain", "toilet", "pipe", "leak", "leaking", "leaked", "plumb",
                          "clog", "clogged", "sewer", "disposal", "water line", "p-trap"}),
            ("electrical", {"outlet", "breaker", "wiring", "electrical", "fuse", "short circuit", "light switch",
                            "breaker panel", "blackout"}),
            ("hvac", {"furnace", "thermostat", "cooling", "heating"}),
            ("paint", {"paint", "painting", "painter"}),
            ("clean", {"clean", "cleaning"}),
        )
        for cat_slug, needles in clusters:
            hit = phrase_hit = False
            for n in needles:
                if len(n.split()) > 1:
                    if n in ml:
                        phrase_hit = True
                        break
                elif len(n) >= 4:
                    if n in ml:
                        hit = True
                        break
                else:
                    for tok in ml.replace(",", " ").split():
                        tok = "".join(ch for ch in tok if ch.isalnum() or ch in "-''").strip().lower()
                        if tok == n:
                            hit = True
                            break
                    if hit:
                        break
            if phrase_hit:
                hit = True
            if not hit:
                continue
            for cat in available_categories:
                name = str(cat.get("name", "") or "").strip().lower()
                if not name:
                    continue
                if cat_slug in name:
                    # Return canonical capitalization from catalog
                    return str(cat.get("name", "") or "").strip()
        return ""

    def _infer_category_lightweight(self, message, available_categories):
        """
        Fast category guess from user text vs category names only (no N+1 DB scans).
        Used for intent fallback so first chat message returns in seconds, not tens of seconds.
        """
        kw_hit = self._infer_trade_from_keywords(message, available_categories)
        if kw_hit:
            return kw_hit

        message_tokens = self._tokenize(message)
        if not message_tokens:
            return ""

        best_name = ""
        best_score = 0.0
        for cat in available_categories:
            name = str(cat.get("name", "")).strip()
            if not name:
                continue
            cat_tokens = self._tokenize(name)
            if not cat_tokens:
                continue
            exact_overlap = len(message_tokens.intersection(cat_tokens))
            fuzzy_overlap = 0
            for mt in message_tokens:
                if mt in cat_tokens:
                    continue
                similarity = max((difflib.SequenceMatcher(None, mt, ct).ratio() for ct in cat_tokens), default=0)
                if similarity >= 0.74:
                    fuzzy_overlap += 1
            score = (exact_overlap + (0.7 * fuzzy_overlap)) / max(1, len(message_tokens))
            if score > best_score:
                best_score = score
                best_name = name
        return best_name if best_score >= 0.08 else ""

    def _infer_category_from_market_data(self, message, available_categories):
        message_tokens = self._tokenize(message)
        if not message_tokens:
            return ""

        category_map = {}
        for cat in available_categories:
            cid_raw = cat.get("id", "")
            cid = str(cid_raw).strip()
            name = str(cat.get("name", "")).strip()
            if not cid or not name:
                continue
            try:
                cid_int = int(cid)
            except (TypeError, ValueError):
                continue
            db_cat = Category.objects.filter(id=cid_int).first()
            seed_text = f"{name} {getattr(db_cat, 'description', '')}"
            providers = Provider.objects.filter(categories__id=cid).distinct()
            if bool(getattr(SystemSettings.get_settings(), "require_provider_verification", True)):
                providers = providers.filter(verification_status='verified')
            skill_text = " ".join(
                " ".join([str(s) for s in (p.skills or []) if str(s).strip()])
                for p in providers
            )
            historical_requests = Request.objects.filter(category_id=cid).values_list("title", "description")[:200]
            historical_text = " ".join([f"{t or ''} {d or ''}" for t, d in historical_requests])
            all_tokens = self._tokenize(f"{seed_text} {skill_text} {historical_text}")
            if all_tokens:
                category_map[name] = all_tokens

        best_name = ""
        best_score = 0.0
        for name, tokens in category_map.items():
            exact_overlap = len(message_tokens.intersection(tokens))
            fuzzy_overlap = 0
            for mt in message_tokens:
                if mt in tokens:
                    continue
                similarity = max((difflib.SequenceMatcher(None, mt, ct).ratio() for ct in tokens), default=0)
                if similarity >= 0.74:
                    fuzzy_overlap += 1
            score = (exact_overlap + (0.7 * fuzzy_overlap)) / max(1, len(message_tokens))
            if score > best_score:
                best_score = score
                best_name = name
        return best_name if best_score >= 0.12 else ""

    def _intent_via_db_gemini_keys(self, message, context):
        system_settings = SystemSettings.get_settings()
        # Use consolidated key loader so GEMINI_API_KEY_1..5 and GEMINI_API_KEYS
        # from environment are honored even when DB row is not synced yet.
        api_keys = system_settings.get_gemini_api_keys(prefer_env=True, sync_env_to_db=False)
        single_key = (getattr(settings, "GEMINI_API_KEY", "") or "").strip()
        if single_key:
            api_keys.append(single_key)
        valid_keys = []
        for k in api_keys:
            key = (k or "").strip()
            if key and key not in valid_keys:
                valid_keys.append(key)
        if not valid_keys:
            return None, "No Gemini keys configured in DB or environment"

        available_categories = context.get("available_categories") or []
        convo = context.get("conversation_history") or []
        form = context.get("form") or {}
        categories_text = ", ".join([str(c.get("name", "")).strip() for c in available_categories if c.get("name")]) or "General"

        prompt = f"""You are ServeFlow's production chatbot engine.
Return ONLY strict JSON:
{{
  "summary": "short summary",
  "intent": "create_service_request | ask_question | clarify",
  "suggested_category": "one category from provided category list, or empty string",
  "urgency": "low | medium | high",
  "preferred_mode": "manual | auto | broadcast",
  "preferred_date_iso": "optional ISO datetime string when inferable",
  "suggested_provider_id": "optional provider id from context when inferable",
  "needs_confirmation": true,
  "suggested_title": "short professional title for the service request",
  "suggested_description": "clear 2-4 sentence description for providers (rewrite user issue professionally)",
  "assistant_reply": "concise professional response",
  "issue_groups": [
    {{"title":"string","description":"string","suggested_category":"string"}}
  ],
  "quick_options": [
    {{"label":"string","value":"string","action":"choose_category | set_mode | set_urgency | set_preferred_date | set_selected_provider | prepare_draft | publish"}}
  ]
}}
Available categories: {categories_text}
Latest message: {message}
Current form: {form}
Conversation history (recent): {convo}
Rules:
- Analyze user text automatically; do not ask category if confidence is high and a category match exists.
- Use category exactly from available list when possible.
- Never assign Electrical for obvious plumbing symptoms (sink, faucet, drain, leak, toilet, pipe).
- Never assign Plumbing for obvious electrical work (breaker, outlet, wiring, fuse). Match the customer's trade honestly.
- suggested_description must describe the SAME type of issue as suggested_category; do not invent a different trade.
- Provide only 2-5 relevant options.
- Include "prepare_draft" when title, description, and category are available or inferable.
"""

        # Keep generation calls fast enough to fit the browser timeout budget.
        max_keys = getattr(settings, "CHATBOT_INTENT_GEMINI_MAX_KEYS", 1)
        try:
            max_keys = int(max_keys)
        except (TypeError, ValueError):
            max_keys = 1
        max_keys = max(1, min(max_keys, len(valid_keys)))

        last_error = None
        for key in valid_keys[:max_keys]:
            try:
                client = genai.Client(api_key=key)
                model_name = resolve_gemini_model_name(key)
                response = client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                        top_p=0.9,
                        max_output_tokens=512,
                    ),
                )
                text = (response.text or "").strip()
                if text.startswith("```json"):
                    text = text.split("```json", 1)[1].split("```", 1)[0].strip()
                elif text.startswith("```"):
                    text = text.split("```", 1)[1].split("```", 1)[0].strip()
                parsed = json.loads(text)

                parsed = self._normalize_intent_payload(message, parsed, available_categories)
                category_name = parsed.get("suggested_category") or ""
                parsed["source"] = "backend_db_gemini"
                if not isinstance(parsed.get("issue_groups"), list):
                    parsed["issue_groups"] = []

                has_title = bool(str(parsed.get("suggested_title") or form.get("title") or "").strip())
                has_desc = bool(str(parsed.get("summary") or form.get("description") or message).strip())
                has_cat = bool(category_name or str(form.get("category_id") or "").strip())
                can_prepare_draft = has_title and has_desc and has_cat

                if not isinstance(parsed.get("quick_options"), list) or not parsed.get("quick_options"):
                    parsed["quick_options"] = self._build_default_options(
                        category_name, available_categories, can_prepare_draft
                    )
                elif can_prepare_draft and not any(o.get("action") == "prepare_draft" for o in parsed["quick_options"] if isinstance(o, dict)):
                    parsed["quick_options"].append(
                        {"label": "Prepare draft now", "value": "prepare_draft", "action": "prepare_draft"}
                    )
                return parsed, None
            except Exception as exc:
                last_error = exc
                continue
        return None, str(last_error or "Gemini key rotation failed")

    def _extract_issue_groups(self, message, available_categories):
        raw_parts = [p.strip() for p in re.split(r"\b(?:and|also|plus|,)\b", str(message or ""), flags=re.IGNORECASE) if p.strip()]
        if len(raw_parts) <= 1:
            return []
        groups = []
        for idx, part in enumerate(raw_parts[:5], start=1):
            suggested = self._infer_category_lightweight(part, available_categories)
            category_id = None
            for cat in available_categories:
                if str(cat.get("name", "")).strip().lower() == str(suggested).lower():
                    category_id = cat.get("id")
                    break
            groups.append({
                "title": f"Issue {idx}",
                "description": part[:400],
                "suggested_category": suggested,
                "category_id": category_id,
            })
        return groups

    def post(self, request):
        message = str(request.data.get("message", "")).strip()
        if not message:
            return Response({"error": "message is required"}, status=400)

        payload = {
            "message": message,
            "context": request.data.get("context") or {},
        }
        ai_base = getattr(settings, "AI_SERVICE_URL", "http://localhost:8001").rstrip("/")
        ai_url = f"{ai_base}/ai/chatbot-intent"
        # Fail fast: unreachable microservice must not block the chatbot for 20+ seconds.
        ai_timeout = getattr(settings, "CHATBOT_INTENT_AI_SERVICE_TIMEOUT", 4)
        try:
            ai_timeout = float(ai_timeout)
        except (TypeError, ValueError):
            ai_timeout = 4.0
        ai_timeout = max(1.5, min(ai_timeout, 10.0))
        try:
            resp = requests.post(ai_url, json=payload, timeout=(2, ai_timeout))
            resp.raise_for_status()
            data = resp.json()
            avail = payload.get("context", {}).get("available_categories") or []
            data = self._normalize_intent_payload(message, data, avail)
            return Response(data, status=resp.status_code)
        except requests.RequestException as exc:
            # AI microservice failed: try Gemini intent generation, but cap the time.
            context = payload.get("context") or {}
            parsed = None
            gemini_error = None

            gemini_timeout = getattr(settings, "CHATBOT_INTENT_GEMINI_TIMEOUT", 20)
            parsed, gemini_error = self._intent_via_db_gemini_keys_with_timeout(
                message,
                context,
                gemini_timeout,
            )
            if parsed:
                avail = context.get("available_categories") or []
                parsed = self._normalize_intent_payload(message, parsed, avail)
                return Response(parsed, status=200)
            available_categories = context.get("available_categories") or []
            form = context.get("form") or {}
            inferred_category = self._infer_category_lightweight(message, available_categories)
            message_normalized = " ".join(str(message).split()).strip()
            first_words = " ".join(message_normalized.split()[:6]).strip()
            fallback_title = str(form.get("title") or "").strip() or first_words or "Service Request"
            if inferred_category and inferred_category not in fallback_title:
                fallback_title = f"{inferred_category} - {fallback_title}"

            # When Gemini is rate-limited/unavailable, we still want the UI/request to use
            # rewritten fields (title/description) instead of raw user text.
            category_for_text = inferred_category or "the customer's reported issue"
            suggested_description = (
                f"The customer reports: \"{message_normalized}\". "
                f"The issue appears related to {category_for_text}. "
                f"They need a provider to inspect the fault and perform the required repair(s)."
            )
            has_title = bool(str(form.get("title") or "").strip())
            has_desc = bool(str(form.get("description") or "").strip() or message)
            has_cat = bool(inferred_category or str(form.get("category_id") or "").strip())
            can_prepare_draft = has_title and has_desc and has_cat
            fallback = {
                "summary": message_normalized[:240],
                "intent": "create_service_request",
                "suggested_category": inferred_category,
                "urgency": "medium",
                "preferred_mode": str(form.get("mode") or "auto"),
                "preferred_date_iso": "",
                "suggested_provider_id": None,
                "needs_confirmation": True,
                "suggested_title": fallback_title,
                "suggested_description": suggested_description,
                "assistant_reply": "I captured your issue and prepared the next step options.",
                "quick_options": self._build_default_options(inferred_category, available_categories, can_prepare_draft),
                "issue_groups": self._extract_issue_groups(message, available_categories),
                "source": "backend_market_fallback",
                "meta": {
                    "ai_service_error": str(exc),
                    "gemini_fallback_error": gemini_error,
                },
            }
            return Response(fallback, status=200)
