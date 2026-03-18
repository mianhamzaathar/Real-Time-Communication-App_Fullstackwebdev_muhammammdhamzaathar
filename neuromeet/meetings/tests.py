import re

from django.test import TestCase
from django.urls import reverse

from .models import Meeting


class RoomViewTests(TestCase):
    def test_room_without_code_redirects_to_generated_room(self):
        response = self.client.get(reverse('room'))

        self.assertEqual(response.status_code, 302)
        self.assertRegex(response.url, r'^/room/[a-z0-9]{8}/$')

    def test_room_detail_renders_context_and_creates_meeting(self):
        response = self.client.get(reverse('room_detail', args=['team-sync']))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context['room']['code'], 'team-sync')
        self.assertTrue(Meeting.objects.filter(room='team-sync').exists())

    def test_room_detail_redirects_to_canonical_slug(self):
        response = self.client.get(reverse('room_detail', args=['Team Sync!!']))

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/room/teamsync/')
