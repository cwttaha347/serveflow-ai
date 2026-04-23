import stripe
from .models import SystemSettings, Invoice, Job, ProviderLedgerEntry
import os
from django.utils import timezone

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
        handle_successful_payment(session)
    
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
                    currency='USD',
                    note='Earnings from paid invoice',
                )
            
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
