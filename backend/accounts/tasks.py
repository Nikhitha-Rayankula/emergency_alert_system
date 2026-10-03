from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from .models import SOSAlert, EscalationConfig
from .serializers import notify_next_stage, log_incident, still_pending, MAX_STAGE


@shared_task
def send_next_stage(sos_id):
    sos = SOSAlert.objects.get(id=sos_id)
    notify_next_stage(sos)

@shared_task
def check_pending_sos():
    pending = SOSAlert.objects.filter(
        status__in=["open", "escalated"], escalation_level__lt=MAX_STAGE
    )
    for sos in pending:
        if not still_pending(sos):
            continue

        config = EscalationConfig.objects.filter(gated_society=sos.user.gated_society).first()
        timeout = config.response_timeout_seconds if config else 60
        stage_started = sos.last_stage_at or sos.created_at

        if (timezone.now() - stage_started) > timedelta(seconds=timeout):
            level = notify_next_stage(sos)
            # Only flip open -> escalated. If someone accepted during sending, don't overwrite it.
            SOSAlert.objects.filter(id=sos.id, status="open").update(status="escalated")
            if still_pending(sos):
                log_incident(sos, "auto_escalated", None, f"No response within {timeout}s. Now at stage {level}")