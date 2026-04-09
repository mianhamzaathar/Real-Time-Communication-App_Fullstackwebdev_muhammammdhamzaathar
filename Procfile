release: cd neuromeet && python manage.py migrate --no-input
web: cd neuromeet && daphne -b 0.0.0.0 -p ${PORT:-8000} neuromeet.asgi:application
