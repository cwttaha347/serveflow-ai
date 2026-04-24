from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
import random
from decimal import Decimal
from api.models import (
    Category, RateCard, PromptVersion, Profile, Provider, Request, Job,
    Review, Bid
)
from api.audit import log_audit

class Command(BaseCommand):
    help = 'Seed database with ServeFlow v2.0 categories, rate cards, and prompts'

    def handle(self, *args, **kwargs):
        categories_data = [
            # (Name, Pricing Model, Base Price, Icon)
            ('Plumbing', 'hourly', 80.00, 'droplets'),
            ('Electrical', 'hourly', 95.00, 'zap'),
            ('Cleaning', 'hourly', 45.00, 'sparkles'),
            ('Carpentry', 'hourly', 70.00, 'hammer'),
            ('Painting', 'fixed', 150.00, 'paint-bucket'),
            ('HVAC', 'hourly', 100.00, 'thermometer'),
            ('Gardening', 'hourly', 50.00, 'leaf'),
            ('Roofing', 'quote', 200.00, 'home'),
            ('Flooring', 'fixed', 300.00, 'layers'),
            ('Appliance Repair', 'hourly', 85.00, 'refrigerator'),
            ('Pest Control', 'fixed', 120.00, 'bug'),
            ('Locksmith', 'fixed', 75.00, 'key'),
            ('Moving Services', 'hourly', 120.00, 'truck'),
            ('Automotive', 'hourly', 90.00, 'car'),
            ('IT Support', 'hourly', 110.00, 'monitor'),
            ('Legal Consulting', 'hourly', 250.00, 'briefcase'),
            ('Interior Design', 'quote', 150.00, 'layout'),
            ('Tutoring', 'hourly', 40.00, 'book-open'),
            ('Pet Grooming', 'fixed', 60.00, 'dog'),
            ('Fitness Training', 'hourly', 70.00, 'dumbbell'),
        ]

        with transaction.atomic():
            self.stdout.write('Seeding Categories and RateCards...')
            for name, p_model, base_price, icon in categories_data:
                category, created = Category.objects.get_or_create(
                    name=name,
                    defaults={
                        'pricing_model': p_model,
                        'base_price': base_price,
                        'icon': icon,
                        'is_active': True
                    }
                )
                if created:
                    self.stdout.write(f'Created category: {name}')
                
                # Add RateCard (Low severity)
                RateCard.objects.get_or_create(
                    category=category,
                    min_severity=1,
                    max_severity=4,
                    defaults={'base_fee': base_price, 'hourly_rate': base_price}
                )
                # Add RateCard (Medium severity)
                RateCard.objects.get_or_create(
                    category=category,
                    min_severity=5,
                    max_severity=7,
                    defaults={'base_fee': base_price * 1.25, 'hourly_rate': base_price * 1.2}
                )
                # Add RateCard (High severity)
                RateCard.objects.get_or_create(
                    category=category,
                    min_severity=8,
                    max_severity=10,
                    defaults={'base_fee': base_price * 1.5, 'hourly_rate': base_price * 1.5}
                )

            self.stdout.write('Seeding Prompts...')
            
            # Directive Section 1.3 - Request Analysis
            PromptVersion.objects.get_or_create(
                name='request_analysis',
                version='2.0.0',
                defaults={
                    'prompt_text': """You are ServeFlow's job analysis engine. Analyze the user's service request
(text + optional images) and return ONLY a single valid JSON object.
Do NOT include markdown, code fences, or any explanation.
Required JSON schema:
{
  "title": "Short professional job title (max 10 words)",
  "category": "Top-level service category (e.g. Plumbing, Electrical, Carpentry)",
  "subcategory": "Specific sub-type (e.g. Pipe Repair, Circuit Breaker)",
  "severity_score": integer 1-10 (1=cosmetic, 10=emergency/safety hazard),
  "complexity": "LOW | MEDIUM | HIGH",
  "urgency_flag": boolean (true if health/safety risk or flooding/fire risk),
  "estimated_duration_hours": float (realistic time to complete),
  "required_skills": ["skill1", "skill2"],
  "summary_for_provider": "2-3 sentence technical briefing for the provider.",
  "visual_damage_assessment": "null if no image, else describe damage visible in image.",
  "materials_likely_needed": ["item1", "item2"] or []
}""",
                    'is_active': True
                }
            )

            # Directive Section 2.2 - Verification Prompt
            PromptVersion.objects.get_or_create(
                name='verification_audit',
                version='2.0.0',
                defaults={
                    'prompt_text': """You are ServeFlow's identity verification engine. Analyze the provided document image
and return ONLY valid JSON. Do NOT include markdown or explanations.
For GOVERNMENT ID images, return:
{
  "document_type": "passport | national_id | drivers_license | unknown",
  "is_authentic": boolean,
  "authenticity_score": float 0.0-1.0,
  "name_extracted": "Full name or null",
  "expiry_date_valid": boolean,
  "tampering_detected": boolean,
  "tampering_indicators": ["list of specific concerns or empty array"],
  "confidence": "HIGH | MEDIUM | LOW",
  "rejection_reason": "null or specific reason string"
}
For SELFIE WITH ID images, additionally include:
{  "face_matches_id": boolean,
   "liveness_score": float 0.0-1.0,
   "both_clearly_visible": boolean  }""",
                    'is_active': True
                }
            )

            # Directive Section 3.2 - Autocomplete Prompt
            PromptVersion.objects.get_or_create(
                name='skill_autocomplete',
                version='2.0.0',
                defaults={
                    'prompt_text': """You are ServeFlow's professional profile writer for skilled tradespeople.
A provider has typed the following partial skill description:
"{user_input}"
Complete and expand this into a professional service listing entry.
Return ONLY valid JSON. No markdown. No explanations.
{
  "inline_completion": "Continuation of exactly what the user typed (max 12 words). 
                         Seamlessly continues their sentence as if they typed it.",
  "full_description": "A complete 2-3 sentence professional service description
                        suitable for a client-facing profile. Mention key skills,
                        experience context, and what problems this service solves.",
  "suggested_tags": ["tag1", "tag2", "tag3"],  // 3-5 short skill keywords
  "suggested_title": "Professional 4-6 word job title for this skill",
  "experience_level_hint": "Entry | Intermediate | Expert  (inferred from description tone)"
}""",
                    'is_active': True
                }
            )

            self.stdout.write('Seeding users, providers, history and bids...')
            User = get_user_model()

            admin, _ = User.objects.get_or_create(
                username='admin',
                defaults={
                    'email': 'admin@serveflow.ai',
                    'first_name': 'Platform',
                    'last_name': 'Admin',
                    'role': 'admin',
                    'is_staff': True,
                    'is_superuser': True,
                    'is_email_verified': True,
                }
            )
            admin.set_password('admin123')
            admin.save()

            # Create Taha user (requested by user)
            taha, _ = User.objects.get_or_create(
                username='Taha',
                defaults={
                    'email': 'taha@serveflow.ai',
                    'first_name': 'Taha',
                    'last_name': 'User',
                    'role': 'admin',
                    'is_staff': True,
                    'is_superuser': True,
                    'is_email_verified': True,
                }
            )
            taha.set_password('Taha#@12345')
            taha.save()

            provider_specs = [
                ('pro_plumber', 'Plumbing', 4.8, 120, Decimal('1250')),
                ('pro_electric', 'Electrical', 4.7, 100, Decimal('1180')),
                ('pro_clean', 'Cleaning', 4.5, 90, Decimal('760')),
                ('pro_hvac', 'HVAC', 4.9, 130, Decimal('1410')),
                ('pro_painter', 'Painting', 4.6, 85, Decimal('980')),
                ('pro_carpenter', 'Carpentry', 4.65, 95, Decimal('1040')),
            ]
            skill_map = {
                "Plumbing": ["Leak Detection", "Pipe Repair", "Drain Cleaning", "Faucet Installation"],
                "Electrical": ["Wiring", "Circuit Repair", "Panel Upgrade", "Switch Installation"],
                "Cleaning": ["Deep Cleaning", "Sanitization", "Move-out Cleaning", "Surface Restoration"],
                "HVAC": ["AC Maintenance", "Duct Service", "Cooling Diagnostics", "Thermostat Setup"],
                "Painting": ["Interior Painting", "Surface Prep", "Crack Filling", "Exterior Coating"],
                "Carpentry": ["Wood Repair", "Cabinet Installation", "Door Alignment", "Custom Shelving"],
            }

            providers = []
            for idx, (username, primary_category, rating, completed, earnings_anchor) in enumerate(provider_specs, start=1):
                user, _ = User.objects.get_or_create(
                    username=username,
                    defaults={
                        'email': f'{username}@serveflow.ai',
                        'first_name': primary_category,
                        'last_name': 'Expert',
                        'role': 'provider',
                        'phone': f'+1-555-10{idx:02d}',
                        'is_email_verified': True,
                    }
                )
                user.set_password('user12345')
                user.save()

                profile, _ = Profile.objects.get_or_create(user=user)
                profile.address = f'{100 + idx} Service Lane, Metro City'
                profile.latitude = Decimal('24.850000') + Decimal(idx) / Decimal('1000')
                profile.longitude = Decimal('67.050000') + Decimal(idx) / Decimal('1000')
                profile.bio = f'{primary_category} specialist with strong completion and customer feedback history.'
                profile.save()

                provider, _ = Provider.objects.get_or_create(user=user)
                provider.rating = rating
                provider.completed_jobs = completed
                provider.total_earnings = earnings_anchor
                provider.verified = True
                provider.verification_status = 'verified'
                provider.availability_status = 'available'
                provider.experience_years = random.randint(3, 12)
                provider.skills = skill_map.get(primary_category, [f"{primary_category} Service"])
                provider.onboarding_completed = True
                provider.save()
                provider.categories.clear()
                cat = Category.objects.filter(name=primary_category).first()
                if cat:
                    provider.categories.add(cat)
                fallback = Category.objects.order_by('id')[:2]
                for c in fallback:
                    provider.categories.add(c)
                providers.append(provider)

            for provider in Provider.objects.all():
                if not provider.skills:
                    all_cats = list(provider.categories.values_list('name', flat=True))
                    generated = []
                    for cat_name in all_cats:
                        generated.extend(skill_map.get(cat_name, [f"{cat_name} Service"]))
                    provider.skills = list(dict.fromkeys(generated))[:20] or ["General Service Support"]
                provider.onboarding_completed = True
                provider.save(update_fields=['skills', 'onboarding_completed'])

            customers = []
            for idx in range(1, 6):
                user, _ = User.objects.get_or_create(
                    username=f'customer{idx}',
                    defaults={
                        'email': f'customer{idx}@serveflow.ai',
                        'first_name': f'Customer{idx}',
                        'last_name': 'Test',
                        'role': 'user',
                        'phone': f'+1-444-20{idx:02d}',
                        'is_email_verified': True,
                    }
                )
                user.set_password('user12345')
                user.save()
                profile, _ = Profile.objects.get_or_create(user=user)
                profile.address = f'{300 + idx} Client Street, Metro City'
                profile.latitude = Decimal('24.900000') + Decimal(idx) / Decimal('1000')
                profile.longitude = Decimal('67.100000') + Decimal(idx) / Decimal('1000')
                profile.save()
                customers.append(user)

            created_requests = 0
            for idx in range(1, 16):
                customer = random.choice(customers)
                category = random.choice(list(Category.objects.filter(is_active=True)[:8]))
                budget = Decimal(random.randint(90, 550))
                req = Request.objects.create(
                    user=customer,
                    category=category,
                    title=f'{category.name} request #{idx}',
                    description=f'Need reliable {category.name.lower()} service for request {idx}.',
                    status='completed' if idx % 2 == 0 else 'assigned',
                    address=customer.profile.address,
                    latitude=customer.profile.latitude,
                    longitude=customer.profile.longitude,
                    preferred_date=timezone.now() + timedelta(days=idx),
                    budget=budget,
                    ai_summary={
                        "estimated_hours": round(random.uniform(1.5, 6.0), 1),
                        "budget_floor": float(max(Decimal('70'), budget * Decimal('0.65'))),
                        "budget_recommended": float(budget),
                        "seeded": True,
                    },
                )
                created_requests += 1
                matched_providers = [p for p in providers if p.categories.filter(id=category.id).exists()]
                matched_providers = matched_providers or providers[:2]

                if idx % 3 == 0:
                    for p in matched_providers[:3]:
                        Bid.objects.get_or_create(
                            request=req,
                            provider=p,
                            defaults={
                                'amount': budget + Decimal(random.randint(-20, 35)),
                                'proposal': f'I can complete {req.title} with quality and timeline guarantees.',
                                'estimated_duration': f'{random.randint(2, 8)} hours',
                                'status': 'accepted' if p == matched_providers[0] else 'rejected',
                            }
                        )

                job_provider = matched_providers[0]
                job = Job.objects.create(
                    request=req,
                    provider=job_provider,
                    status='completed' if req.status == 'completed' else 'accepted',
                    commission_rate=Decimal('10.00'),
                    provider_earnings=(budget * Decimal('0.90')),
                    created_at=timezone.now() - timedelta(days=random.randint(5, 45)),
                )
                if req.status == 'completed':
                    Review.objects.get_or_create(
                        job=job,
                        defaults={
                            'rating': random.randint(4, 5),
                            'comment': 'Great service quality and communication.',
                        }
                    )

            for user in customers[:2]:
                log_audit(
                    user=user,
                    action='create',
                    model_name='SeedData',
                    changes={"source": "seed_serveflow_v2", "requests_created": created_requests},
                    description='Seeded realistic QA data',
                )

        self.stdout.write(self.style.SUCCESS('Successfully seeded database for ServeFlow v2.0'))
        self.stdout.write(self.style.SUCCESS('Test credentials: admin/admin123, customer1..5/user12345, pro_* / user12345'))
