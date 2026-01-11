from django.utils import timezone
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import User, Profile, Category, Provider, Request, Job, Invoice, Review, Dispute, SystemSettings, Bid
from .serializers import (
    UserSerializer, UserRegistrationSerializer, ProfileSerializer,
    CategorySerializer, ProviderSerializer, RequestSerializer,
    JobSerializer, InvoiceSerializer, ReviewSerializer, DisputeSerializer, BidSerializer
)
from .utils import calculate_match_score
from .notifications import notify_request_update, notify_job_update, send_notification
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from django.db.models import Q

class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        # Allow login safely with username or email
        username_or_email = request.data.get('username')
        password = request.data.get('password')
        
        user = None
        # Try fetching by username
        if User.objects.filter(username=username_or_email).exists():
           user = User.objects.get(username=username_or_email)
        # Try fetching by email
        elif User.objects.filter(email=username_or_email).exists():
           user = User.objects.get(email=username_or_email)

        if user and user.check_password(password):
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email,
                'role': user.role
            })
        
        return Response({'error': 'Invalid Credentials'}, status=400)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return [IsAuthenticated()]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        return UserSerializer
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        """Get or update current user info"""
        if request.method == 'GET':
            serializer = self.get_serializer(request.user)
            return Response(serializer.data)
        
        serializer = self.get_serializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def forgot_password(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=400)
        
        try:
            user = User.objects.get(email=email)
            # In a real app, generate a secure token and store it
            # For now, we'll use a simple mock token or just a link
            from django.core.mail import send_mail
            from django.conf import settings
            
            reset_link = f"http://localhost:5173/reset-password?email={email}" # Simplified for demo
            
            send_mail(
                'Password Reset - ServeFlow AI',
                f'Click the link to reset your password: {reset_link}',
                settings.DEFAULT_FROM_EMAIL or 'noreply@serveflow.ai',
                [email],
                fail_silently=False,
            )
            return Response({'message': 'Reset link sent to your email'})
        except User.DoesNotExist:
            return Response({'error': 'User with this email does not exist'}, status=404)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def reset_password(self, request):
        email = request.data.get('email')
        new_password = request.data.get('password')
        
        if not email or not new_password:
            return Response({'error': 'Email and new password are required'}, status=400)
            
        try:
            user = User.objects.get(email=email)
            user.set_password(new_password)
            user.save()
            return Response({'message': 'Password has been reset successfully'})
        except User.DoesNotExist:
            return Response({'error': 'Invalid request'}, status=404)

    @action(detail=False, methods=['post'], permission_classes=[IsAuthenticated])
    def change_password(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        if not request.user.check_password(old_password):
            return Response({'error': 'Current password is incorrect'}, status=400)
        
        request.user.set_password(new_password)
        request.user.save()
        return Response({'message': 'Password updated successfully'})

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        profile = request.user.profile
        if request.method == 'GET':
            serializer = self.get_serializer(profile)
            return Response(serializer.data)
        
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return []
        return [IsAuthenticated()]

    @action(detail=False, methods=['post'])
    def diagnose(self, request):
        """AI based categorization from description"""
        desc = request.data.get('description', '').lower()
        if not desc:
            return Response({'error': 'Description required'}, status=400)
            
        categories = Category.objects.filter(is_active=True)
        best_match = None
        
        # Advanced keyword mapping
        category_map = {
            'plumbing': ['leak', 'pipe', 'toilet', 'sink', 'tap', 'water', 'drain', 'clog', 'shower', 'basin', 'flush'],
            'electrical': ['wire', 'light', 'short', 'circuit', 'power', 'switch', 'spark', 'breaker', 'plugin', 'voltage', 'shock'],
            'cleaning': ['dust', 'wash', 'mop', 'house', 'office', 'dirty', 'deep clean', 'vacuum', 'scrub', 'mess'],
            'painting': ['wall', 'color', 'brush', 'coat', 'stain', 'renovation', 'interior', 'exterior', 'primer'],
            'carpentry': ['wood', 'furniture', 'door', 'shelf', 'cabinet', 'fix', 'table', 'chair', 'hammer', 'nail'],
            'hvac': ['ac', 'air', 'condition', 'heat', 'cool', 'filter', 'vent', 'duct', 'thermostat', 'chiller']
        }
        
        # Simple keyword matching
        for cat in categories:
            cat_name_low = cat.name.lower()
            keywords = category_map.get(cat_name_low, [cat_name_low])
            
            for word in keywords:
                if word in desc:
                    best_match = cat
                    break
            if best_match: break
            
        if best_match:
            return Response({
                'category_id': best_match.id,
                'category_name': best_match.name,
                'confidence': 0.85,
                'summary': f"Based on your description, this appears to be a {best_match.name} issue."
            })
            
        return Response({
            'category_id': None,
            'summary': "We couldn't automatically determine the category. Please select one manually."
        })

class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get', 'put', 'patch'])
    def me(self, request):
        try:
            provider = request.user.provider_profile
        except Provider.DoesNotExist:
            return Response({'error': 'Provider profile not found'}, status=404)
            
        if request.method == 'GET':
            serializer = self.get_serializer(provider)
            return Response(serializer.data)
        
        serializer = self.get_serializer(provider, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def recommendations(self, request):
        """
        Get recommended providers based on request criteria.
        Expects: { title, description, category, address }
        """
        data = request.data
        
        # Filter active providers
        providers = Provider.objects.filter(availability_status='available')
        
        scored_providers = []
        for provider in providers:
            score = calculate_match_score(data, provider)
            if score > 0:
                serialized = self.get_serializer(provider).data
                serialized['match_score'] = score
                scored_providers.append(serialized)
        
        scored_providers.sort(key=lambda x: x['match_score'], reverse=True)
        return Response(scored_providers[:10])

class RequestViewSet(viewsets.ModelViewSet):
    queryset = Request.objects.all()
    serializer_class = RequestSerializer
    permission_classes = [IsAuthenticated]
    
    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        
        # Check for associated job
        job = instance.jobs.filter(status__in=['accepted', 'started', 'completed']).first()
        job_data = JobSerializer(job).data if job else None
        
        # Check for review
        has_review = False
        if job:
            has_review = Review.objects.filter(job=job).exists()
            
        return Response({
            'request': serializer.data,
            'job': job_data,
            'hasReview': has_review
        })

    def perform_create(self, serializer):
        print(f"DEBUG: Creating Request by {self.request.user}")
        print(f"DEBUG: Request DATA: {self.request.data}")
        request_instance = serializer.save(user=self.request.user)
        print(f"DEBUG: Request instance created with ID {request_instance.id}")
        
        # AI Analysis Call
        import requests as http_requests
        try:
            ai_service_url = "http://localhost:8001/ai/analyze-request"
            payload = {
                "title": request_instance.title,
                "description": request_instance.description,
                "category": request_instance.category.name if request_instance.category else "General"
            }
            ai_response = http_requests.post(ai_service_url, json=payload, timeout=5)
            if ai_response.status_code == 200:
                request_instance.ai_summary = ai_response.json()
                request_instance.save()
                print(f"DEBUG: AI Analysis saved for Request #{request_instance.id}")
        except Exception as e:
            print(f"DEBUG: AI analysis failed: {e}")
        
        # Send email notifications
        from .emails import send_new_request_notification
        try:
            send_new_request_notification(request_instance)
        except Exception as e:
            print(f"Email notification failed: {e}")
        
        # Check for selected provider and create a Job
        provider_id = self.request.data.get('selected_provider')
        print(f"DEBUG: selected_provider ID from request.data: {provider_id}")
        
        if provider_id:
            # Create job for specific provider
            try:
                provider = Provider.objects.get(id=provider_id)
                print(f"DEBUG: Found provider {provider.id}, creating Job...")
                job = Job.objects.create(
                    request=request_instance,
                    provider=provider,
                    status='pending'
                )
                print(f"DEBUG: Job created with ID {job.id}, Status: {job.status}, Provider: {job.provider.id}")
            except Provider.DoesNotExist:
                print(f"DEBUG: Provider with ID {provider_id} not found!")
            except Exception as e:
                print(f"DEBUG: Error creating job: {e}")
                import traceback
                traceback.print_exc()
        else:
            # Broadcast to ALL available providers
            print("DEBUG: No selected_provider, broadcasting to all available providers...")
            available_providers = Provider.objects.filter(availability_status='available')
            print(f"DEBUG: Found {available_providers.count()} available providers")
            
            jobs_created = 0
            for provider in available_providers:
                try:
                    job = Job.objects.create(
                        request=request_instance,
                        provider=provider,
                        status='pending'
                    )
                    jobs_created += 1
                    
                    # Notify Provider
                    send_notification(
                        user_id=provider.user.id,
                        message=f"New Job Opportunity: {request_instance.title}",
                        type='new_job',
                        payload={'job_id': job.id, 'request_id': request_instance.id}
                    )
                    
                    print(f"DEBUG: Created Job #{job.id} for Provider '{provider.user.username}'")
                except Exception as e:
                    print(f"DEBUG: Error creating job for provider {provider.id}: {e}")
                    
            print(f"DEBUG: Total jobs created: {jobs_created}")
    
    @action(detail=False, methods=['get'])
    def open_requests(self, request):
        """Get requests that are open for bidding"""
        open_reqs = Request.objects.filter(status='open_for_bids')
        serializer = self.get_serializer(open_reqs, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def ai_match(self, request, pk=None):
        """
        Match request with best providers using AI scoring.
        CRITICAL: Only matches providers in the SAME category.
        """
        service_request = self.get_object()
        
        # Validate request has category
        if not service_request.category:
            from rest_framework import status
            return Response({
                'error': 'Request must have a category assigned',
                'request_id': service_request.id
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Get ONLY providers in the SAME category
        providers = Provider.objects.filter(
            categories=service_request.category
        )
        
        if not providers.exists():
            from rest_framework import status
            return Response({
                'error': f'No {service_request.category.name} providers found',
                'category': service_request.category.name,
                'suggestion': 'Please try again later or contact support'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # Score each provider
        from .utils import calculate_match_score, calculate_distance
        
        scored_providers = []
        for provider in providers:
            match_score = calculate_match_score(service_request, provider)
            
            # Calculate distance if coordinates available (from User Profile)
            prov_lat = None
            prov_lon = None
            if hasattr(provider.user, 'profile'):
                prov_lat = provider.user.profile.latitude
                prov_lon = provider.user.profile.longitude

            distance = None
            if (service_request.latitude and service_request.longitude and 
                prov_lat and prov_lon):
                distance = calculate_distance(
                    service_request.latitude,
                    service_request.longitude,
                    prov_lat,
                    prov_lon
                )
            
            scored_providers.append({
                'provider_id': provider.id,
                'provider_name': provider.user.get_full_name() or provider.user.username,
                'rating': float(provider.rating or 0),
                'match_score': match_score,
                'distance_km': distance,
                'availability': getattr(provider, 'availability_status', 'unknown'),
                'category': service_request.category.name # Use the request's category name as primary
            })
        
        # Sort by match score (highest first)
        scored_providers.sort(key=lambda x: x['match_score'], reverse=True)
        
        # Return top 10 matches
        top_matches = scored_providers[:10]
        
        return Response({
            'request_id': service_request.id,
            'request_category': service_request.category.name,
            'total_providers_in_category': len(scored_providers),
            'matched_providers': top_matches,
            'message': f'Found {len(top_matches)} {service_request.category.name} providers'
        })
    
    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        requests = Request.objects.filter(user=request.user)
        serializer = self.get_serializer(requests, many=True)
        return Response(serializer.data)

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]
    
    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark invoice as paid"""
        invoice = self.get_object()
        
        payment_method = request.data.get('payment_method', 'cash')
        
        invoice.paid = True
        invoice.paid_at = timezone.now()
        invoice.payment_method = payment_method
        invoice.save()
        
        return Response({
            'status': 'success',
            'message': 'Invoice marked as paid',
            'payment_date': invoice.paid_at
        })

class ReviewViewSet(viewsets.ModelViewSet):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        job_id = self.request.data.get('job_id')
        if not job_id:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Job ID is required")
            
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Job not found")
            
        # Verify user is the customer
        if job.request.user != self.request.user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only the customer can leave a review")
            
        # verify job is completed
        if job.status != 'completed':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Can only review completed jobs")
            
        # Save review
        review = serializer.save(job=job)
        
        # Update provider rating
        self._update_provider_rating(job.provider)
        
    def _update_provider_rating(self, provider):
        # Calculate new average
        reviews = Review.objects.filter(job__provider=provider)
        if reviews.exists():
            avg_rating = sum(r.rating for r in reviews) / reviews.count()
            provider.rating = round(avg_rating, 2)
            provider.save()
            print(f"DEBUG: Updated provider {provider.user.username} rating to {provider.rating}")

class DisputeViewSet(viewsets.ModelViewSet):
    queryset = Dispute.objects.all()
    serializer_class = DisputeSerializer
    permission_classes = [IsAuthenticated]

class BidViewSet(viewsets.ModelViewSet):
    queryset = Bid.objects.all()
    serializer_class = BidSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Bid.objects.all()
        elif user.role == 'provider':
            try:
                provider = Provider.objects.get(user=user)
                return Bid.objects.filter(provider=provider)
            except Provider.DoesNotExist:
                return Bid.objects.none()
        else:
            return Bid.objects.filter(request__user=user)
    
    def perform_create(self, serializer):
        try:
            provider = Provider.objects.get(user=self.request.user)
            bid = serializer.save(provider=provider)
            
            # Send email notification to customer
            from .emails import send_new_bid_notification
            try:
                send_new_bid_notification(bid)
            except Exception as e:
                print(f"Email notification failed: {e}")
                
        except Provider.DoesNotExist:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Only providers can create bids")
    
    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        bid = self.get_object()
        if bid.request.user != request.user:
            return Response({'error': 'Only request owner can accept bids'}, status=403)
        if bid.status != 'pending':
            return Response({'error': 'Bid already processed'}, status=400)
        
        bid.status = 'accepted'
        bid.save()
        
        job = Job.objects.create(request=bid.request, provider=bid.provider, status='accepted')
        bid.request.status = 'assigned'
        bid.request.save()
        
        Bid.objects.filter(request=bid.request, status='pending').exclude(id=bid.id).update(status='rejected')
        
        # Send email to winning provider
        from .emails import send_bid_accepted_notification
        try:
            send_bid_accepted_notification(bid)
        except Exception as e:
            print(f"Email notification failed: {e}")
        
        return Response({'message': 'Bid accepted', 'job_id': job.id})
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        bid = self.get_object()
        if bid.request.user != request.user:
            return Response({'error': 'Only request owner can reject bids'}, status=403)
        if bid.status != 'pending':
            return Response({'error': 'Bid already processed'}, status=400)
        bid.status = 'rejected'
        bid.save()
        return Response({'message': 'Bid rejected'})
    
    @action(detail=True, methods=['delete'])
    def withdraw(self, request, pk=None):
        bid = self.get_object()
        if bid.provider.user != request.user:
            return Response({'error': 'You can only withdraw your own bids'}, status=403)
        if bid.status != 'pending':
            return Response({'error': 'Can only withdraw pending bids'}, status=400)
        bid.status = 'withdrawn'
        bid.save()
        return Response({'message': 'Bid withdrawn'})


class JobViewSet(viewsets.ModelViewSet):
    serializer_class = JobSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        print(f"DEBUG: JobViewSet.get_queryset for user {user.username} (Role: {user.role})")
        
        # Admin sees all jobs
        if user.role == 'admin':
            jobs = Job.objects.all()
            print(f"DEBUG: Admin - returning all {jobs.count()} jobs")
            return jobs
        
        # Provider sees their assigned jobs
        if user.role == 'provider':
            try:
                provider = Provider.objects.get(user=user)
                jobs = Job.objects.filter(provider=provider)
                print(f"DEBUG: Provider {provider.id} has {jobs.count()} jobs")
                return jobs
            except Provider.DoesNotExist:
                print(f"DEBUG: No provider profile for user {user.username}")
                return Job.objects.none()
        
        # Customer sees jobs related to their requests
        jobs = Job.objects.filter(request__user=user)
        print(f"DEBUG: User {user.username} has {jobs.count()} jobs from their requests")
        return jobs

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.status == 'completed' and instance.provider_earnings == 0:
            self._calculate_earnings(instance)

    def _calculate_earnings(self, instance):
        settings = SystemSettings.get_settings()
        amount = instance.request.budget or 0
        commission_amount = (amount * settings.commission_percentage) / 100
        instance.commission_rate = settings.commission_percentage
        instance.provider_earnings = amount - commission_amount
        instance.save()

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        job = self.get_object()
        
        # Check if already accepted by someone else (race condition)
        if job.request.status in ['assigned', 'in_progress', 'completed']:
             return Response({'error': 'Job already accepted by another provider'}, status=400)

        job.status = 'accepted'
        job.save()
        
        # Update request status
        job.request.status = 'assigned'
        job.request.save()
        
        # Cancel all OTHER pending jobs for this request
        Job.objects.filter(request=job.request, status='pending').exclude(id=job.id).update(status='cancelled')
        
        # Notify Customer
        notify_request_update(job.request, f"Provider {job.provider.user.username} has accepted your request!")
        
        return Response({'status': 'job accepted'})

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        job = self.get_object()
        job.status = 'started'
        job.start_time = timezone.now()
        job.save()
        
        # Notify Customer
        notify_request_update(job.request, f"Work has started on '{job.request.title}'")
        
        return Response({'status': 'job started'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        job = self.get_object()
        job.status = 'completed'
        job.end_time = timezone.now()
        job.save()
        
        # Calculate earnings
        self._calculate_earnings(job)
        
        # Update request status to completed
        job.request.status = 'completed'
        job.request.save()
        
        # Notify Customer
        notify_request_update(job.request, f"Job '{job.request.title}' has been completed!")
        
        # Auto-generate invoice if doesn't exist
        if not hasattr(job, 'invoice'):
            try:
                budget = job.request.budget or 0
                Invoice.objects.create(
                    job=job,
                    subtotal=budget,
                    tax=0,
                    discount=0,
                    total=budget,
                    paid=False
                )
                print(f"DEBUG: Auto-created invoice for Job #{job.id}")
            except Exception as e:
                print(f"DEBUG: Error creating invoice: {e}")
        
        return Response({'status': 'job completed', 'invoice_created': True})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        job = self.get_object()
        job.status = 'cancelled'
        job.save()
        return Response({'status': 'job cancelled'})


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin-only viewset for viewing audit logs.
    Read-only - logs cannot be modified or deleted.
    """
    from .audit import AuditLog
    from .audit_serializer import AuditLogSerializer
    
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        # Only admins can view audit logs
        if self.request.user.role != 'admin':
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Only administrators can view audit logs")
        
        queryset = self.queryset
        
        # Filter by user
        user_id = self.request.query_params.get('user_id')
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        
        # Filter by action
        action = self.request.query_params.get('action')
        if action:
            queryset = queryset.filter(action=action)
        
        # Filter by model
        model_name = self.request.query_params.get('model')
        if model_name:
            queryset = queryset.filter(model_name=model_name)
        
        # Filter by date range
        from_date = self.request.query_params.get('from_date')
        to_date = self.request.query_params.get('to_date')
        if from_date:
            queryset = queryset.filter(timestamp__gte=from_date)
        if to_date:
            queryset = queryset.filter(timestamp__lte=to_date)
        
from .models import Message
from .serializers import MessageSerializer

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated] # Messages are private business

    def get_serializer_class(self):
        # Local import or use the one from serializers.py if available
        # But for now, we rely on the import at top of file, so we need to add it there too.
        # However, to be cleaner, we can import inside method or assume it is imported.
        # Since I cannot easily edit top imports without risk, I will add it here.
        from .serializers import MessageSerializer
        return MessageSerializer

    def get_queryset(self):
        # Users can only see messages they sent or received
        user = self.request.user
        job_id = self.request.query_params.get('job_id')
        
        queryset = Message.objects.filter(
            Q(sender=user) | Q(receiver=user)
        )
        
        if job_id:
            queryset = queryset.filter(job_id=job_id)
            
        return queryset

    def perform_create(self, serializer):
        # Auto-set sender
        serializer.save(sender=self.request.user)

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        job_id = request.data.get('job_id')
        if not job_id:
             return Response({'error': 'Job ID required'}, status=400)
             
        # Mark all messages in this job received by current user as read
        updated = Message.objects.filter(
            job_id=job_id,
            receiver=request.user,
            is_read=False
        ).update(is_read=True)
        
        return Response({'status': 'success', 'updated': updated})
