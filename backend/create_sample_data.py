import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'serveflow.settings')
django.setup()

from api.models import User, Provider, Category, Request, Job
from datetime import datetime, timedelta
import random

print("=== CREATING SAMPLE DATA ===\n")

# Create categories
categories = Category.objects.all()
if not categories.exists():
    print("No categories found. Please run fix_categories.py first")
    exit()

# Create sample providers
provider_data = [
    {'username': 'electricpro', 'email': 'electric@pro.com', 'first_name': 'John', 'last_name': 'Electrician', 'phone': '555-0101'},
    {'username': 'plumbmaster', 'email': 'plumb@master.com', 'first_name': 'Mike', 'last_name': 'Plumber', 'phone': '555-0102'},
    {'username': 'cleanqueen', 'email': 'clean@queen.com', 'first_name': 'Sarah', 'last_name': 'Cleaner', 'phone': '555-0103'},
    {'username': 'fixitall', 'email': 'fixit@all.com', 'first_name': 'Bob', 'last_name': 'Builder', 'phone': '555-0104'},
]

providers_created = []
for pdata in provider_data:
    user, created = User.objects.get_or_create(
        username=pdata['username'],
        defaults={
            'email': pdata['email'],
            'first_name': pdata['first_name'],
            'last_name': pdata['last_name'],
            'role': 'provider',
            'is_active': True
        }
    )
    if created:
        user.set_password('user123')
        user.save()
        print(f"Created provider user: {user.username}")
    
    provider, created = Provider.objects.get_or_create(
        user=user,
        defaults={
            'company_name': f"{pdata['first_name']}'s Services",
            'phone': pdata['phone'],
            'verified': True,
            'availability_status': 'available',
            'rating': round(random.uniform(4.0, 5.0), 1)
        }
    )
    
    # Assign random categories
    if created or not provider.categories.exists():
        num_cats = random.randint(1, 3)
        cats = random.sample(list(categories), num_cats)
        provider.categories.set(cats)
        print(f"  - Assigned {num_cats} categories")
    
    providers_created.append(provider)

print(f"\nTotal providers: {len(providers_created)}\n")

# Create sample customer users
customer_data = [
    {'username': 'customer1', 'email': 'customer1@test.com', 'first_name': 'Alice', 'last_name': 'Johnson'},
    {'username': 'customer2', 'email': 'customer2@test.com', 'first_name': 'David', 'last_name': 'Smith'},
]

customers_created = []
for cdata in customer_data:
    user, created = User.objects.get_or_create(
        username=cdata['username'],
        defaults={
            'email': cdata['email'],
            'first_name': cdata['first_name'],
            'last_name': cdata['last_name'],
            'role': 'user',
            'is_active': True
        }
    )
    if created:
        user.set_password('user123')
        user.save()
        print(f"Created customer: {user.username}")
    customers_created.append(user)

print(f"\nTotal customers: {len(customers_created)}\n")

# Create sample requests and jobs
request_templates = [
    {'title': 'Kitchen plumbing repair', 'description': 'Leaking faucet needs fixing', 'budget': 150, 'category_idx': 0},
    {'title': 'Office electrical work', 'description': 'Install new outlets in office', 'budget': 200, 'category_idx': 1},
    {'title': 'House deep cleaning', 'description': 'Full house cleaning needed', 'budget': 120, 'category_idx': 2},
    {'title': 'Fix broken door', 'description': 'Door handle broken, needs replacement', 'budget': 80, 'category_idx': 3},
    {'title': 'Bathroom renovation', 'description': 'Complete bathroom remodeling', 'budget': 500, 'category_idx': 0},
]

print("=== CREATING REQUESTS AND JOBS ===\n")

for idx, template in enumerate(request_templates):
    customer = random.choice(customers_created)
    category = list(categories)[template['category_idx']]
    
    # Create request
    request = Request.objects.create(
        user=customer,
        category=category,
        title=template['title'],
        description=template['description'],
        address=f"{random.randint(100, 999)} Main St, City",
        preferred_date=datetime.now() + timedelta(days=random.randint(1, 7)),
        budget=template['budget'],
        status='pending'
    )
    print(f"Created Request #{request.id}: {request.title}")
    
    # Decide if individual or broadcast
    if idx % 2 == 0:
        # Individual - assign to random provider
        provider = random.choice(providers_created)
        job = Job.objects.create(
            request=request,
            provider=provider,
            status='pending'
        )
        print(f"  → Individual job for provider '{provider.user.username}'")
    else:
        # Broadcast to all providers
        for provider in providers_created:
            job = Job.objects.create(
                request=request,
                provider=provider,
                status='pending'
            )
        print(f"  → Broadcast to {len(providers_created)} providers")

print("\n=== SAMPLE DATA CREATED ===")
print(f"Providers: {len(providers_created)}")
print(f"Customers: {len(customers_created)}")
print(f"Requests: {len(request_templates)}")
print(f"Jobs: {Job.objects.count()}")
print("\nLogin credentials:")
print("Providers: electricpro, plumbmaster, cleanqueen, fixitall (password: user123)")
print("Customers: customer1, customer2 (password: user123)")
