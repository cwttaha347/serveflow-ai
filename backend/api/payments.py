import stripe
from .models import SystemSettings, Invoice, Job
import os

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
        
    try:
        invoice = Invoice.objects.get(id=invoice_id)
        invoice.paid = True
        from django.utils import timezone
        invoice.paid_at = invoice.paid_at or timezone.now()
        invoice.payment_method = 'stripe'
        invoice.stripe_payment_intent_id = session.get('payment_intent')
        invoice.save()
        
        # Update job status if needed
        job = invoice.job
        if job.status == 'completed':
            # Potentially update provider balance here
            pass
            
    except Invoice.DoesNotExist:
        pass
