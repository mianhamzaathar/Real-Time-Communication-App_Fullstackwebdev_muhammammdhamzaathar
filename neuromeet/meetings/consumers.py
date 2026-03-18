import json
from collections import defaultdict
from uuid import uuid4

from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone


class MeetingConsumer(AsyncWebsocketConsumer):
    rooms = defaultdict(
        lambda: {
            'participants': {},
            'files': [],
            'whiteboard': [],
        }
    )

    MAX_CHAT_LENGTH = 1000
    MAX_TRANSCRIPT_LENGTH = 1500
    MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024
    MAX_FILE_DATA_LENGTH = 3_000_000
    MAX_FILES_PER_ROOM = 12
    MAX_WHITEBOARD_SEGMENTS = 2500

    async def connect(self):
        self.room = self.scope['url_route']['kwargs']['room']
        self.group = f'meeting_{self.room}'
        self.participant_id = None

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        room_state = self.rooms.get(self.room)
        room_participants = room_state['participants'] if room_state else {}
        participant = None

        if self.participant_id:
            participant = room_participants.pop(self.participant_id, None)

        if participant:
            await self.channel_layer.group_send(
                self.group,
                {
                    'type': 'group_payload',
                    'exclude': self.channel_name,
                    'payload': {
                        'type': 'participant_left',
                        'participant_id': self.participant_id,
                        'participant': self._public_participant(participant),
                        'timestamp': self._timestamp(),
                    },
                },
            )

        if room_state and not room_participants:
            self.rooms.pop(self.room, None)

        await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            return

        message_type = data.get('type')
        if message_type == 'join':
            await self._handle_join(data)
            return

        if not self.participant_id:
            return

        if message_type in {'offer', 'answer', 'ice-candidate'}:
            await self._handle_signal(data)
            return

        if message_type == 'status':
            await self._handle_status(data)
            return

        if message_type == 'hand_raise':
            await self._handle_hand_raise(data)
            return

        if message_type == 'chat':
            await self._handle_chat(data)
            return

        if message_type == 'reaction':
            await self._handle_reaction(data)
            return

        if message_type == 'transcript':
            await self._handle_transcript(data)
            return

        if message_type == 'file_share':
            await self._handle_file_share(data)
            return

        if message_type == 'whiteboard_draw':
            await self._handle_whiteboard_draw(data)
            return

        if message_type == 'whiteboard_clear':
            await self._handle_whiteboard_clear()

    async def group_payload(self, event):
        if event.get('exclude') == self.channel_name:
            return
        await self._send_payload(event['payload'])

    async def direct_payload(self, event):
        await self._send_payload(event['payload'])

    async def _handle_join(self, data):
        participant = data.get('participant') or {}
        participant_id = str(participant.get('id') or '').strip()
        participant_name = str(participant.get('name') or '').strip()[:60] or 'Guest'
        if not participant_id:
            return

        room_state = self._room_state()
        room_participants = room_state['participants']
        existing_participants = [
            self._public_participant(details)
            for current_id, details in room_participants.items()
            if current_id != participant_id
        ]

        details = {
            'id': participant_id,
            'name': participant_name,
            'avatar_url': str(participant.get('avatar_url') or '').strip()[:1000],
            'is_host': bool(participant.get('is_host')),
            'mic_enabled': bool(participant.get('mic_enabled', True)),
            'camera_enabled': bool(participant.get('camera_enabled', True)),
            'hand_raised': bool(participant.get('hand_raised', False)),
            'screen_sharing': bool(participant.get('screen_sharing', False)),
            'channel_name': self.channel_name,
        }
        room_participants[participant_id] = details
        self.participant_id = participant_id

        await self._send_payload(
            {
                'type': 'participants_snapshot',
                'participants': existing_participants,
                'timestamp': self._timestamp(),
            }
        )
        await self._send_payload(
            {
                'type': 'files_snapshot',
                'files': list(room_state['files']),
                'timestamp': self._timestamp(),
            }
        )
        await self._send_payload(
            {
                'type': 'whiteboard_snapshot',
                'segments': list(room_state['whiteboard']),
                'timestamp': self._timestamp(),
            }
        )

        await self.channel_layer.group_send(
            self.group,
            {
                'type': 'group_payload',
                'exclude': self.channel_name,
                'payload': {
                    'type': 'participant_joined',
                    'participant_id': participant_id,
                    'participant': self._public_participant(details),
                    'timestamp': self._timestamp(),
                },
            },
        )

    async def _handle_status(self, data):
        participant = self._get_current_participant()
        if not participant:
            return

        participant['mic_enabled'] = bool(data.get('mic_enabled', participant['mic_enabled']))
        participant['camera_enabled'] = bool(data.get('camera_enabled', participant['camera_enabled']))
        participant['screen_sharing'] = bool(data.get('screen_sharing', participant['screen_sharing']))

        await self._broadcast(
            {
                'type': 'status',
                'participant': self._public_participant(participant),
            }
        )

    async def _handle_hand_raise(self, data):
        participant = self._get_current_participant()
        if not participant:
            return

        participant['hand_raised'] = bool(data.get('raised'))
        await self._broadcast(
            {
                'type': 'hand_raise',
                'raised': participant['hand_raised'],
                'participant': self._public_participant(participant),
            }
        )

    async def _handle_chat(self, data):
        message = (data.get('message') or '').strip()
        if not message:
            return

        await self._broadcast(
            {
                'type': 'chat',
                'message': message[: self.MAX_CHAT_LENGTH],
            }
        )

    async def _handle_reaction(self, data):
        emoji = (data.get('emoji') or '').strip()
        if not emoji:
            return

        await self._broadcast(
            {
                'type': 'reaction',
                'emoji': emoji[:16],
            }
        )

    async def _handle_transcript(self, data):
        text = (data.get('text') or '').strip()
        if not text:
            return

        await self._broadcast(
            {
                'type': 'transcript',
                'text': text[: self.MAX_TRANSCRIPT_LENGTH],
            }
        )

    async def _handle_file_share(self, data):
        participant = self._get_current_participant()
        if not participant:
            return

        file_info = data.get('file') or {}
        file_id = str(file_info.get('id') or uuid4().hex).strip()[:64]
        name = str(file_info.get('name') or '').strip()[:120]
        mime = str(file_info.get('mime') or 'application/octet-stream').strip()[:120]
        content = str(file_info.get('content') or '')

        try:
            size = int(file_info.get('size') or 0)
        except (TypeError, ValueError):
            size = 0

        if not name or not content:
            return

        if size > self.MAX_FILE_SIZE_BYTES or len(content) > self.MAX_FILE_DATA_LENGTH:
            await self._send_payload(
                {
                    'type': 'error',
                    'message': 'Shared files must be 2 MB or smaller.',
                    'timestamp': self._timestamp(),
                }
            )
            return

        file_entry = {
            'id': file_id,
            'name': name,
            'size': size,
            'mime': mime,
            'content': content,
            'participant_id': self.participant_id,
            'participant': self._public_participant(participant),
            'shared_at': self._timestamp(),
        }

        room_state = self._room_state()
        files = [entry for entry in room_state['files'] if entry['id'] != file_id]
        files.append(file_entry)
        room_state['files'] = files[-self.MAX_FILES_PER_ROOM :]

        await self._broadcast(
            {
                'type': 'file_shared',
                'file': file_entry,
            }
        )

    async def _handle_whiteboard_draw(self, data):
        segment = self._sanitize_segment(data.get('segment') or {})
        if not segment:
            return

        room_state = self._room_state()
        room_state['whiteboard'].append(segment)
        room_state['whiteboard'] = room_state['whiteboard'][-self.MAX_WHITEBOARD_SEGMENTS :]

        await self._broadcast(
            {
                'type': 'whiteboard_draw',
                'segment': segment,
            }
        )

    async def _handle_whiteboard_clear(self):
        room_state = self._room_state()
        room_state['whiteboard'] = []
        await self._broadcast({'type': 'whiteboard_clear'})

    async def _handle_signal(self, data):
        target_id = str(data.get('target') or '').strip()
        room_participants = self._room_state()['participants']
        target = room_participants.get(target_id)
        participant = self._get_current_participant()

        if not target or not participant:
            return

        payload = {
            'type': data.get('type'),
            'participant_id': self.participant_id,
            'participant': self._public_participant(participant),
            'timestamp': self._timestamp(),
        }

        if data.get('type') == 'offer':
            payload['offer'] = data.get('offer')
        elif data.get('type') == 'answer':
            payload['answer'] = data.get('answer')
        elif data.get('type') == 'ice-candidate':
            payload['candidate'] = data.get('candidate')

        await self.channel_layer.send(
            target['channel_name'],
            {
                'type': 'direct_payload',
                'payload': payload,
            },
        )

    async def _broadcast(self, payload):
        participant = self._get_current_participant()
        if not participant:
            return

        enriched_payload = {
            **payload,
            'participant_id': self.participant_id,
            'participant': payload.get('participant') or self._public_participant(participant),
            'timestamp': self._timestamp(),
        }

        await self.channel_layer.group_send(
            self.group,
            {
                'type': 'group_payload',
                'payload': enriched_payload,
            },
        )

    async def _send_payload(self, payload):
        await self.send(text_data=json.dumps(payload))

    def _room_state(self):
        return self.rooms[self.room]

    def _get_current_participant(self):
        room_state = self.rooms.get(self.room)
        if not room_state:
            return None
        return room_state['participants'].get(self.participant_id)

    def _public_participant(self, participant):
        return {
            'id': participant['id'],
            'name': participant['name'],
            'avatar_url': participant.get('avatar_url', ''),
            'is_host': participant['is_host'],
            'mic_enabled': participant['mic_enabled'],
            'camera_enabled': participant['camera_enabled'],
            'hand_raised': participant['hand_raised'],
            'screen_sharing': participant['screen_sharing'],
        }

    def _sanitize_segment(self, segment):
        try:
            start_x = float((segment.get('from') or {}).get('x'))
            start_y = float((segment.get('from') or {}).get('y'))
            end_x = float((segment.get('to') or {}).get('x'))
            end_y = float((segment.get('to') or {}).get('y'))
            size = float(segment.get('size') or 3)
        except (TypeError, ValueError):
            return None

        def clamp(value):
            return max(0.0, min(1.0, value))

        color = str(segment.get('color') or '#1B4D3E').strip()[:20]
        if not color.startswith('#'):
            color = '#1B4D3E'

        clean_segment = {
            'id': str(segment.get('id') or uuid4().hex).strip()[:64],
            'from': {'x': clamp(start_x), 'y': clamp(start_y)},
            'to': {'x': clamp(end_x), 'y': clamp(end_y)},
            'color': color,
            'size': max(1.0, min(24.0, size)),
        }

        return clean_segment

    def _timestamp(self):
        return timezone.now().isoformat()
