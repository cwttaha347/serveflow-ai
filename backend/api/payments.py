import stripe
from .models import SystemSettings, Invoice, Job, ProviderLedgerEntry, Request, Provider, ProviderPayout
import os
from django.utils import timezone
from django.conf import settings as dj_settings
from stripe._error import InvalidRequestError

def get_stripe_client():
    settings = SystemSettings.get_settings()
    if not settings.stripe_secret_key:
        raise ValueError("Stripe Secret Key not configured in system settings")
    stripe.api_key = settings.stripe_secret_key
    return stripe

def create_checkout_session(invoice_id, success_url, cancel_url):
    stripe_client = get_stripe_client()
    invoice = Invoice.objects.get(id=invoice_id)
    settings = SystemSettings.get_settings()
    
    currency = settings.currency_symbol.lower().replace('$', 'usd') # Fallback if not set correctly
    if currency not in ['usd', 'eur', 'pkr', 'gbp']:
        currency = 'usd'
        
    line_items = [{
        'price_data': {
            'currency': currency,
            'product_data': {
                'name': f"Job #{invoice.job.id} - {invoice.job.request.title}",
                'description': f"Professional service via ServeFlow AI",
            },
            'unit_amount': int(invoice.total * 100),
        },
        'quantity': 1,
    }]
    
    session = stripe_client.checkout.Session.create(
        payment_method_types=['card'],
        line_items=line_items,
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'invoice_id': invoice.id,
            'job_id': invoice.job.id
        }
    )
    
    invoice.stripe_checkout_session_id = session.id
    invoice.save()
    
    return session

def process_webhook_event(payload, sig_header):
    settings = SystemSettings.get_settings()
    stripe_client = get_stripe_client()
    
    try:
        event = stripe_client.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except Exception as e:
        raise e

    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        md = session.get('metadata') or {}
        if md.get('purpose') == 'escrow_publish' and md.get('request_id'):
            handle_escrow_publish_paid(session)
        else:
            handle_successful_payment(session)
    elif event['type'] == 'account.updated':
        handle_connect_account_updated(event['data']['object'])
    elif event['type'] in ('payout.paid', 'payout.failed', 'payout.canceled', 'payout.updated'):
        handle_connect_payout_event(event)

    return event

def handle_successful_payment(session):
    invoice_id = session.get('metadata', {}).get('invoice_id')
    if not invoice_id:
        return
    if session.get('payment_status') != 'paid':
        return
        
    try:
        invoice = Invoice.objects.get(id=invoice_id)
        invoice.paid = True
        invoice.paid_at = invoice.paid_at or timezone.now()
        invoice.payment_method = 'stripe'
        invoice.stripe_payment_intent_id = session.get('payment_intent')
        invoice.save()
        
        # Update job status if needed
        job = invoice.job
        if job.status == 'completed':
            exists = ProviderLedgerEntry.objects.filter(
                provider=job.provider,
                job=job,
                invoice=invoice,
                entry_type='earned',
            ).exists()
            if not exists and job.provider_earnings:
                ProviderLedgerEntry.objects.create(
                    provider=job.provider,
                    job=job,
                    invoice=invoice,
                    entry_type='earned',
                    amount=job.provider_earnings,
                    currency=_stripe_currency_code().upper()[:8],
                    note='Earnings from paid invoice',
                )
            # If provider has Connect account, transfer provider share onto their Stripe balance.
            # This enables an immediate wallet->bank payout initiated by the provider.
            try:
                transfer_provider_share_for_invoice(invoice)
            except Exception:
                # Do not fail webhook processing due to transfer issues; payout UI can show manual fallback.
                pass
            
    except Invoice.DoesNotExist:
        pass


def confirm_invoice_payment(invoice, session_id=None):
    """
    Reconcile invoice status from Stripe session as a fallback to webhooks.
    """
    stripe_client = get_stripe_client()
    checkout_session_id = session_id or invoice.stripe_checkout_session_id
    if not checkout_session_id:
        raise ValueError("No Stripe checkout session is associated with this invoice.")

    session = stripe_client.checkout.Session.retrieve(checkout_session_id)
    payment_status = session.get('payment_status')

    if payment_status == 'paid':
        invoice.paid = True
        invoice.paid_at = invoice.paid_at or timezone.now()
        invoice.payment_method = invoice.payment_method or 'stripe'
        invoice.stripe_checkout_session_id = invoice.stripe_checkout_session_id or session.get('id')
        invoice.stripe_payment_intent_id = session.get('payment_intent') or invoice.stripe_payment_intent_id
        invoice.save()

    return {
        "invoice_id": invoice.id,
        "paid": bool(invoice.paid),
        "payment_status": payment_status,
        "session_id": session.get('id'),
        "payment_intent": session.get('payment_intent'),
    }


def _stripe_currency_code():
    settings = SystemSettings.get_settings()
    currency = settings.currency_symbol.lower().replace('$', 'usd')
    if currency not in ['usd', 'eur', 'pkr', 'gbp']:
        currency = 'usd'
    return currency


def _connect_country_code():
    """
    Stripe Connect account country. Pakistan-first by request.
    If Stripe Connect is not supported for PK in your Stripe account,
    onboarding/payout attempts will fail and the system will fall back to manual ops.
    """
    code = str(getattr(dj_settings, 'STRIPE_CONNECT_COUNTRY', '') or os.environ.get('STRIPE_CONNECT_COUNTRY', '') or 'PK').strip().upper()
    if len(code) != 2:
        code = 'PK'
    return code


def create_escrow_checkout_session(request_obj, success_url, cancel_url):
    """Customer pays request budget + tax before jobs are created (manual/auto modes)."""
    stripe_client = get_stripe_client()
    sys_settings = SystemSettings.get_settings()
    budget = request_obj.budget or 0
    tax_amount = (budget * sys_settings.tax_percentage) / 100
    total = budget + tax_amount
    currency = _stripe_currency_code()
    line_items = [{
        'price_data': {
            'currency': currency,
            'product_data': {
                'name': f"Service request #{request_obj.id} — {request_obj.title[:80]}",
                'description': 'Escrow payment to publish your request',
            },
            'unit_amount': int(total * 100),
        },
        'quantity': 1,
    }]
    session = stripe_client.checkout.Session.create(
        payment_method_types=['card'],
        line_items=line_items,
        mode='payment',
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            'purpose': 'escrow_publish',
            'request_id': str(request_obj.id),
        },
    )
    return session


def handle_escrow_publish_paid(session):
    if session.get('payment_status') != 'paid':
        return
    rid = (session.get('metadata') or {}).get('request_id')
    if not rid:
        return
    from django.db import transaction
    from .views_v2 import finalize_escrow_jobs

    with transaction.atomic():
        req = Request.objects.select_for_update().filter(pk=int(rid)).first()
        if not req or req.escrow_status != 'awaiting_payment':
            return
        req.escrow_payment_intent_id = session.get('payment_intent') or ''
        req.save(update_fields=['escrow_payment_intent_id', 'updated_at'])

    finalize_escrow_jobs(int(rid))


def try_release_escrow_to_provider(job):
    """After job completion, transfer provider share to their Connect account (if onboarded)."""
    job.refresh_from_db()
    req = job.request
    if req.escrow_status != 'funded':
        return
    provider = job.provider
    if not provider.stripe_connect_account_id:
        return
    if req.escrow_transfer_id:
        return
    provider_share = job.provider_earnings
    cents = int(provider_share * 100)
    if cents <= 0:
        return
    stripe_client = get_stripe_client()
    currency = _stripe_currency_code()
    transfer = stripe_client.Transfer.create(
        amount=cents,
        currency=currency,
        destination=provider.stripe_connect_account_id,
        metadata={'job_id': str(job.id), 'request_id': str(req.id)},
    )
    req.escrow_transfer_id = transfer.id
    req.escrow_status = 'released'
    req.save(update_fields=['escrow_transfer_id', 'escrow_status', 'updated_at'])
    exists = ProviderLedgerEntry.objects.filter(
        provider=provider,
        job=job,
        entry_type='earned',
        note__icontains='Escrow release',
    ).exists()
    if not exists:
        ProviderLedgerEntry.objects.create(
            provider=provider,
            job=job,
            invoice=None,
            entry_type='earned',
            amount=provider_share,
            currency=(currency or 'usd').upper()[:8],
            note='Escrow release to Connect account',
        )


def get_or_create_connect_account(provider: Provider) -> str:
    stripe_client = get_stripe_client()
    if provider.stripe_connect_account_id:
        existing_id = provider.stripe_connect_account_id
        try:
            stripe_client.Account.retrieve(existing_id)
            return existing_id
        except InvalidRequestError as exc:
            # Common stale-state case: saved account id belongs to another mode/account
            # or was removed in Stripe. Reset locally and provision a new one.
            error_code = str(getattr(exc, 'code', '') or '').lower()
            error_param = str(getattr(exc, 'param', '') or '').lower()
            if error_code in ('resource_missing', 'invalid_request_error') or error_param == 'account':
                provider.stripe_connect_account_id = ''
                provider.stripe_connect_onboarding_complete = False
                provider.save(update_fields=['stripe_connect_account_id', 'stripe_connect_onboarding_complete', 'updated_at'])
            else:
                raise
    account = stripe_client.Account.create(
        type='express',
        country=_connect_country_code(),
        email=provider.user.email or None,
        capabilities={'card_payments': {'requested': True}, 'transfers': {'requested': True}},
        metadata={'provider_id': str(provider.id)},
    )
    provider.stripe_connect_account_id = account.id
    provider.save(update_fields=['stripe_connect_account_id', 'updated_at'])
    return account.id


def create_connect_onboarding_link(provider: Provider, refresh_url: str, return_url: str) -> str:
    stripe_client = get_stripe_client()
    account_id = get_or_create_connect_account(provider)
    link = stripe_client.AccountLink.create(
        account=account_id,
        refresh_url=refresh_url,
        return_url=return_url,
        type='account_onboarding',
    )
    return link.url


def sync_connect_status(provider: Provider) -> bool:
    """
    Reconcile onboarding completion from Stripe for the provider's current account id.
    Returns current onboarding_complete status after sync.
    """
    account_id = str(provider.stripe_connect_account_id or '').strip()
    if not account_id:
        if provider.stripe_connect_onboarding_complete:
            provider.stripe_connect_onboarding_complete = False
            provider.save(update_fields=['stripe_connect_onboarding_complete', 'updated_at'])
        return False
    stripe_client = get_stripe_client()
    account = stripe_client.Account.retrieve(account_id)
    is_complete = bool(account.get('details_submitted') and account.get('payouts_enabled'))
    if provider.stripe_connect_onboarding_complete != is_complete:
        provider.stripe_connect_onboarding_complete = is_complete
        provider.save(update_fields=['stripe_connect_onboarding_complete', 'updated_at'])
    return is_complete


def handle_connect_account_updated(account: dict):
    acc_id = account.get('id')
    if not acc_id:
        return
    Provider.objects.filter(stripe_connect_account_id=acc_id).update(
        stripe_connect_onboarding_complete=bool(
            account.get('details_submitted') and account.get('payouts_enabled')
        ),
    )


def transfer_provider_share_for_invoice(invoice: Invoice):
    """
    After invoice is paid and job is completed, move provider share to the connected account balance.
    Idempotent via ProviderLedgerEntry(entry_type='release', invoice=invoice).
    """
    job = getattr(invoice, 'job', None)
    if not job or getattr(job, 'status', None) != 'completed':
        return
    provider = getattr(job, 'provider', None)
    if not provider or not provider.stripe_connect_account_id:
        return
    if ProviderLedgerEntry.objects.filter(provider=provider, invoice=invoice, entry_type='release').exists():
        return
    amount = job.provider_earnings
    cents = int(float(amount or 0) * 100)
    if cents <= 0:
        return
    stripe_client = get_stripe_client()
    currency = _stripe_currency_code()
    transfer = stripe_client.Transfer.create(
        amount=cents,
        currency=currency,
        destination=provider.stripe_connect_account_id,
        metadata={'invoice_id': str(invoice.id), 'job_id': str(job.id), 'request_id': str(getattr(job.request, 'id', ''))},
    )
    ProviderLedgerEntry.objects.create(
        provider=provider,
        job=job,
        invoice=invoice,
        entry_type='release',
        amount=amount,
        currency=(currency or 'usd').upper()[:8],
        note=f"Stripe transfer to Connect balance: {transfer.id}",
    )


def execute_provider_payout(payout: ProviderPayout) -> ProviderPayout:
    """
    Create a Stripe payout on the provider's connected account.
    This requires the provider account to have sufficient balance (funded by transfers).
    """
    stripe_client = get_stripe_client()
    provider = payout.provider
    if not provider or not provider.stripe_connect_account_id:
        raise ValueError("Provider bank account is not connected.")
    if not provider.stripe_connect_onboarding_complete:
        raise ValueError("Provider bank connection is not completed yet.")

    currency = _stripe_currency_code()
    cents = int(float(payout.amount or 0) * 100)
    if cents <= 0:
        raise ValueError("Invalid payout amount.")

    # Move to processing before API call to reduce double-submits.
    payout.status = 'processing'
    payout.save(update_fields=['status'])

    created = stripe_client.Payout.create(
        amount=cents,
        currency=currency,
        metadata={'provider_id': str(provider.id), 'provider_payout_id': str(payout.id)},
        stripe_account=provider.stripe_connect_account_id,
    )
    payout.reference = str(created.get('id') or '')[:120]
    payout.save(update_fields=['reference'])
    return payout


def handle_connect_payout_event(event: dict):
    """
    Reconcile provider payout statuses from Stripe payout webhooks.
    We match ProviderPayout.reference == Stripe payout id.
    """
    obj = (event or {}).get('data', {}).get('object') or {}
    payout_id = obj.get('id')
    if not payout_id:
        return
    status_val = str(obj.get('status') or '').lower()
    row = ProviderPayout.objects.select_related('provider').filter(reference=payout_id).first()
    if not row:
        return

    if status_val in ('paid', 'succeeded'):
        row.status = 'paid'
        row.processed_at = row.processed_at or timezone.now()
        row.save(update_fields=['status', 'processed_at'])
        if not ProviderLedgerEntry.objects.filter(
            provider=row.provider, entry_type='payout', note__icontains=f"Stripe payout {payout_id}"
        ).exists():
            ProviderLedgerEntry.objects.create(
                provider=row.provider,
                entry_type='payout',
                amount=row.amount,
                currency=row.currency,
                note=f"Stripe payout {payout_id}",
            )
    elif status_val in ('failed', 'canceled', 'cancelled'):
        row.status = 'failed' if status_val == 'failed' else 'cancelled'
        row.processed_at = row.processed_at or timezone.now()
        row.save(update_fields=['status', 'processed_at'])
