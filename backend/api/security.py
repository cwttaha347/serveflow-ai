from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from .models import Job, JobStatusHistory, Provider, Worker


JOB_TRANSITIONS = {
    "pending": {"accepted", "declined", "cancelled"},
    "accepted": {"started", "cancelled"},
    "started": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
    "declined": set(),
}


def require_verified_email(user, message="Please verify your email first."):
    if user.role != "admin" and not user.is_email_verified:
        raise PermissionDenied(message)


def get_provider_for_user(user):
    try:
        return Provider.objects.get(user=user)
    except Provider.DoesNotExist:
        return None


def get_worker_for_user(user):
    try:
        return Worker.objects.select_related("provider").get(user=user)
    except Worker.DoesNotExist:
        return None


def can_user_access_job(user, job):
    if user.role == "admin":
        return True
    if user.role == "user":
        return job.request.user_id == user.id
    if user.role == "provider":
        provider = get_provider_for_user(user)
        return bool(provider and job.provider_id == provider.id)
    if user.role == "worker":
        worker = get_worker_for_user(user)
        return bool(worker and job.assigned_worker_id == worker.id)
    return False


def can_user_update_job_status(user, job):
    if user.role == "admin":
        return True
    if user.role == "provider":
        provider = get_provider_for_user(user)
        return bool(provider and job.provider_id == provider.id)
    if user.role == "worker":
        worker = get_worker_for_user(user)
        return bool(worker and job.assigned_worker_id == worker.id)
    return False


def assert_valid_job_transition(job, to_status):
    from_status = (job.status or "").lower().strip()
    target = (to_status or "").lower().strip()
    if not target:
        raise ValidationError("Target status is required")
    allowed = JOB_TRANSITIONS.get(from_status, set())
    if target not in allowed:
        raise ValidationError(f"Invalid status transition: {from_status} -> {target}")
    return from_status, target


def apply_job_status_transition(job, to_status, changed_by, note=""):
    from_status, target = assert_valid_job_transition(job, to_status)
    job.status = target
    if target == "started" and not job.start_time:
        job.start_time = timezone.now()
    if target == "completed" and not job.end_time:
        job.end_time = timezone.now()
    job.save()
    JobStatusHistory.objects.create(
        job=job,
        from_status=from_status,
        to_status=target,
        changed_by=changed_by,
        note=(note or "")[:255],
    )
    return job
