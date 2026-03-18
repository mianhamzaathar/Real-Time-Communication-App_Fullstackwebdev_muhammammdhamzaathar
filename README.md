# NeuroMeet AI

NeuroMeet AI is a Django + Channels realtime meeting app with WebRTC video rooms, live chat, file sharing, whiteboard collaboration, profile management, and a browser-side AI meeting assistant.

## Current Feature Set

- Multi-user meeting rooms with unique room URLs
- WebRTC-based video calling and media controls
- Screen sharing
- Real-time chat over WebSockets
- Participant list, reactions, hand raise, and live status sync
- File sharing inside the room
- Collaborative whiteboard
- User authentication, profile settings, and profile avatars
- AI dashboard with:
  - meeting summaries
  - transcript view
  - action item extraction
  - highlights and topic tags
  - attendance tracking
  - engagement insights
  - smart replies
  - assistant/chatbot panel

## Stack

- Backend: Django 5, Channels, Daphne
- Realtime: WebSockets, optional Redis channel layer
- Frontend: HTML, CSS, vanilla JavaScript
- Database: SQLite
- Video: WebRTC
- Auth: Django auth + optional Google/GitHub social login

## Project Structure

```text
.
|-- .env.example
|-- README.md
|-- neuromeet/
|   |-- manage.py
|   |-- ai_assistant/
|   |-- meetings/
|   |-- neuromeet/
|   |-- static/
|   `-- templates/
```

Important files:

- `neuromeet/neuromeet/settings.py`: Django, Channels, security, env config
- `neuromeet/neuromeet/asgi.py`: ASGI entrypoint
- `neuromeet/meetings/consumers.py`: meeting websocket consumer
- `neuromeet/static/js/meeting.js`: room realtime + WebRTC client
- `neuromeet/static/js/meeting-ai.js`: AI/notes/insights client
- `neuromeet/templates/room.html`: main meeting UI

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/mianhamzaathar/Real-Time-Communication-App_Fullstackwebdev_muhammammdhamzaathar.git
cd Real-Time-Communication-App_Fullstackwebdev_muhammammdhamzaathar
```

### 2. Create and activate a virtual environment

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

macOS / Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

There is no pinned `requirements.txt` in this repo yet, so install the current project dependencies manually:

```bash
pip install django daphne channels channels-redis social-auth-app-django
```

### 4. Create the environment file

The app loads `.env` from inside the `neuromeet/` directory.

Windows PowerShell:

```powershell
Copy-Item .env.example neuromeet\.env
```

macOS / Linux:

```bash
cp .env.example neuromeet/.env
```

### 5. Run migrations

```bash
cd neuromeet
python manage.py migrate
```

### 6. Start the app

```bash
python manage.py runserver
```

Open:

- Landing page: `http://127.0.0.1:8000/`
- App home: `http://127.0.0.1:8000/home/`

## Environment Variables

Use `.env.example` as the base template.

| Variable | Purpose |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key |
| `DEBUG` | Development mode toggle |
| `ALLOWED_HOSTS` | Comma-separated allowed hosts |
| `CSRF_TRUSTED_ORIGINS` | Comma-separated trusted origins |
| `ENABLE_HTTPS` | Enables secure cookies and HTTPS redirects |
| `REDIS_URL` | Optional Redis connection for Channels |
| `SOCIAL_AUTH_GOOGLE_OAUTH2_KEY` | Google OAuth client ID |
| `SOCIAL_AUTH_GOOGLE_OAUTH2_SECRET` | Google OAuth client secret |
| `SOCIAL_AUTH_GITHUB_KEY` | GitHub OAuth client ID |
| `SOCIAL_AUTH_GITHUB_SECRET` | GitHub OAuth client secret |

## Main Routes

- `/` - landing page
- `/home/` - authenticated app home/dashboard-style page
- `/signup/` - signup
- `/login/` - login
- `/profile/` - profile page and avatar upload
- `/pricing/` - pricing page
- `/contact-sales/` - contact sales form
- `/room/` - redirects to a generated room
- `/room/<room_code>/` - live meeting room

WebSocket room endpoint:

- `/ws/meeting/<room_code>/`

## Realtime Notes

- If `REDIS_URL` is not set, the app uses an in-memory channel layer.
- Redis is recommended for multi-user production deployments across multiple processes.
- For local development, the current setup works without Redis.

## AI Notes

The AI layer in this project is currently browser-side and heuristic-driven. It includes transcription helpers, summaries, action items, attendance, smart replies, and insight panels, but it is not a hosted LLM backend.

Important limitations:

- speech-to-text depends on browser support
- translation is lightweight and rule-based
- noise handling uses browser/device audio processing
- this is not end-to-end encrypted meeting AI infrastructure

## Validation

Useful checks during development:

```bash
python manage.py check
node --check static/js/meeting.js
node --check static/js/meeting-ai.js
```

Run the `node --check` commands from inside the `neuromeet/` directory.

## Manual Test Flow

To quickly test the app:

1. Start the server.
2. Open the app in two browser tabs or two browsers.
3. Create or join the same room code.
4. Test mic/camera, screen share, chat, file share, whiteboard, and leave flow.
5. Open the AI panels to review transcript, notes, and attendance behavior.

## Known Gaps

- No bundled TURN server configuration
- No pinned `requirements.txt` yet
- File sharing is room-level demo storage, not persistent cloud storage
- AI features are not backed by a remote LLM/STT pipeline by default

## License

This repository currently does not define a license file.
