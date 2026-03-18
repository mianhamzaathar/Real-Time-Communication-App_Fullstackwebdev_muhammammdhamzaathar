import re
import uuid

from django.contrib import admin, messages
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout, update_session_auth_hash
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db.utils import OperationalError
from django.http import HttpResponse
from django.shortcuts import render, redirect
from django.urls import include, path, reverse
from django.conf import settings
from django.conf.urls.static import static
from meetings.models import Meeting, Profile

ROOM_CODE_PATTERN = re.compile(r'[^a-z0-9-]+')

def home(request):
    return render(request, 'home.html')

def landing_view(request):
    return render(request, 'landing.html')

def _normalize_room_code(room_code):
    cleaned = ROOM_CODE_PATTERN.sub('', (room_code or '').strip().lower())
    return cleaned[:32]

def room(request, room_code=None):
    normalized_room_code = _normalize_room_code(room_code)

    if not normalized_room_code:
        return redirect('room_detail', room_code=uuid.uuid4().hex[:8])

    if room_code != normalized_room_code:
        return redirect('room_detail', room_code=normalized_room_code)

    display_name = (request.user.get_full_name() or '').strip()
    if not display_name:
        display_name = request.user.get_username() or 'Guest'

    room_created_at = None
    is_host = False
    try:
        meeting, is_host = Meeting.objects.get_or_create(room=normalized_room_code)
        room_created_at = meeting.created
    except OperationalError:
        meeting = None

    room_context = {
        'code': normalized_room_code,
        'id': normalized_room_code.upper(),
        'name': f'Room {normalized_room_code.upper()}',
        'join_url': request.build_absolute_uri(reverse('room_detail', args=[normalized_room_code])),
        'created_at': room_created_at.isoformat() if room_created_at else '',
        'is_host': is_host,
        'display_name': display_name,
        'host_id': str(request.user.id) if is_host and request.user.is_authenticated else '',
    }

    return render(
        request,
        'room.html',
        {
            'room': room_context,
        },
    )

def login_view(request):
    if request.method == 'POST':
        email = (request.POST.get('email') or '').strip().lower()
        password = request.POST.get('password') or ''

        if not email or not password:
            messages.error(request, "Please enter both email and password.")
            return render(request, 'login.html')

        user = authenticate(request, username=email, password=password)
        if user is None:
            messages.error(request, "Invalid email or password.")
            return render(request, 'login.html')

        try:
            Profile.objects.get_or_create(user=user)
        except OperationalError:
            messages.warning(request, "Profile setup is pending. Please run migrations.")
        auth_login(request, user)
        next_url = request.GET.get('next')
        if next_url:
            return redirect(next_url)
        return redirect('app_home')

    return render(request, 'login.html')

def signup_view(request):
    if request.method == 'POST':
        full_name = (request.POST.get('full_name') or '').strip()
        email = (request.POST.get('email') or '').strip().lower()
        password = request.POST.get('password') or ''
        confirm_password = request.POST.get('confirm_password') or ''

        errors = []

        if not full_name:
            errors.append("Full name is required.")

        if not email:
            errors.append("Email is required.")
        else:
            try:
                validate_email(email)
            except ValidationError:
                errors.append("Please enter a valid email address.")

        if not password:
            errors.append("Password is required.")
        elif password != confirm_password:
            errors.append("Passwords do not match.")
        else:
            try:
                validate_password(password)
            except ValidationError as exc:
                errors.extend(exc.messages)

        if email and User.objects.filter(username=email).exists():
            errors.append("An account with this email already exists.")

        if errors:
            for error in errors:
                messages.error(request, error)
            return render(request, 'signup.html')

        first_name, *last_parts = full_name.split()
        last_name = " ".join(last_parts)

        user = User.objects.create_user(username=email, email=email, password=password)
        user.first_name = first_name
        user.last_name = last_name
        user.save()

        messages.success(request, "Account created successfully. Please log in.")
        return redirect('login')

    return render(request, 'signup.html')

def password_reset_view(request):
    return render(request, 'password_reset.html')

def pricing_view(request):
    return render(request, 'pricing.html')

def contact_sales_view(request):
    if request.method == 'POST':
        return render(request, 'contact_sales.html', {'submitted': True})
    return render(request, 'contact_sales.html')

def profile_view(request):
    if not request.user.is_authenticated:
        return redirect(f"{reverse('login')}?next={reverse('profile')}")

    user = request.user
    try:
        Profile.objects.get_or_create(user=user)
    except OperationalError:
        messages.error(request, "Profile database is not ready. Please run migrations.")
        return redirect('app_home')

    if request.method == 'POST':
        action = request.POST.get('action')

        if action == 'profile':
            user.first_name = (request.POST.get('first_name') or '').strip()
            user.last_name = (request.POST.get('last_name') or '').strip()
            user.save()

            profile, _ = Profile.objects.get_or_create(user=user)
            profile.phone = (request.POST.get('phone') or '').strip()
            profile.company = (request.POST.get('company') or '').strip()
            profile.job_title = (request.POST.get('job_title') or '').strip()
            profile.country = (request.POST.get('country') or '').strip()
            profile.city = (request.POST.get('city') or '').strip()
            profile.timezone = (request.POST.get('timezone') or '').strip()
            profile.linkedin = (request.POST.get('linkedin') or '').strip()
            profile.twitter = (request.POST.get('twitter') or '').strip()
            profile.github = (request.POST.get('github') or '').strip()
            profile.save()

            messages.success(request, "Profile updated successfully.")
            return redirect('profile')

        if action == 'avatar' and request.FILES.get('avatar'):
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.avatar = request.FILES['avatar']
            profile.save()
            messages.success(request, "Profile picture updated.")
            return redirect('profile')

        if action == 'password':
            current_password = request.POST.get('current_password') or ''
            new_password = request.POST.get('new_password') or ''
            confirm_password = request.POST.get('confirm_password') or ''

            if not user.check_password(current_password):
                messages.error(request, "Current password is incorrect.")
                return redirect('profile')

            if new_password != confirm_password:
                messages.error(request, "New passwords do not match.")
                return redirect('profile')

            try:
                validate_password(new_password, user)
            except ValidationError as exc:
                for message in exc.messages:
                    messages.error(request, message)
                return redirect('profile')

            user.set_password(new_password)
            user.save()
            update_session_auth_hash(request, user)
            messages.success(request, "Password updated successfully.")
            return redirect('profile')

        if action == 'preferences':
            profile, _ = Profile.objects.get_or_create(user=user)
            profile.default_mic = (request.POST.get('default_mic') or 'default').strip()
            profile.default_speaker = (request.POST.get('default_speaker') or 'default').strip()
            profile.noise_cancellation = bool(request.POST.get('noise_cancellation'))
            profile.auto_transcription = bool(request.POST.get('auto_transcription'))
            profile.email_reminders = bool(request.POST.get('email_reminders'))
            profile.weekly_summary = bool(request.POST.get('weekly_summary'))
            profile.product_updates = bool(request.POST.get('product_updates'))
            profile.save()
            messages.success(request, "Preferences saved successfully.")
            return redirect('profile')

    return render(request, 'profile.html')

def logout_view(request):
    auth_logout(request)
    return redirect('login')

def placeholder(request):
    return HttpResponse("Page not implemented.", content_type="text/plain")

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', landing_view, name='home'),
    path('home/', home, name='app_home'),
    path('landing/', landing_view, name='landing'),
    path('room/', room, name='room'),
    path('room/<str:room_code>/', room, name='room_detail'),
    path('login/', login_view, name='login'),
    path('signup/', signup_view, name='signup'),
    path('oauth/', include('social_django.urls', namespace='social')),
    path('password-reset/', password_reset_view, name='password_reset'),
    path('meetings/', placeholder, name='meetings'),
    path('logout/', logout_view, name='logout'),
    path('profile/', profile_view, name='profile'),
    path('settings/', placeholder, name='settings'),
    path('features/', placeholder, name='features'),
    path('pricing/', pricing_view, name='pricing'),
    path('security/', placeholder, name='security'),
    path('roadmap/', placeholder, name='roadmap'),
    path('blog/', placeholder, name='blog'),
    path('documentation/', placeholder, name='documentation'),
    path('support/', placeholder, name='support'),
    path('api/', placeholder, name='api'),
    path('about/', placeholder, name='about'),
    path('careers/', placeholder, name='careers'),
    path('contact/', placeholder, name='contact'),
    path('contact-sales/', contact_sales_view, name='contact-sales'),
    path('changelog/', placeholder, name='changelog'),
    path('status/', placeholder, name='status'),
    path('partners/', placeholder, name='partners'),
    path('compliance/', placeholder, name='compliance'),
    path('press/', placeholder, name='press'),
    path('privacy/', placeholder, name='privacy'),
    path('terms/', placeholder, name='terms'),
    path('cookies/', placeholder, name='cookies'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
