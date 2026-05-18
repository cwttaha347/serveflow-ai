"""Regression: chatbot intent must respond when the browser can reach Django but the AI microservice cannot."""
from unittest.mock import patch

import requests
from rest_framework.test import APITestCase

from api.views_v2 import ChatbotIntentView


class ChatbotIntentNetworkTests(APITestCase):
    @patch.object(ChatbotIntentView, "_intent_via_db_gemini_keys", return_value=(None, "test_skip_gemini"))
    @patch("api.views_v2.requests.post")
    def test_intent_returns_200_fallback_when_ai_service_unreachable(self, mock_post, _mock_gemini):
        mock_post.side_effect = requests.ConnectionError("connection refused")
        resp = self.client.post(
            "/api/chatbot/intent/",
            {
                "message": "flickering lights",
                "context": {
                    "form": {},
                    "available_categories": [{"id": 1, "name": "Electrical"}],
                },
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get("source"), "backend_market_fallback")
        self.assertIn("assistant_reply", resp.data)
        self.assertIn("preferred_date_iso", resp.data)
        self.assertIn("suggested_provider_id", resp.data)
        self.assertIn("needs_confirmation", resp.data)

    @patch.object(ChatbotIntentView, "_intent_via_db_gemini_keys", return_value=(None, "test_skip_gemini"))
    @patch("api.views_v2.requests.post")
    def test_intent_fallback_suggests_roofing_for_roman_urdu_ceiling(self, mock_post, _mock_gemini):
        mock_post.side_effect = requests.ConnectionError("connection refused")
        categories = [
            {"id": 1, "name": "Plumbing"},
            {"id": 8, "name": "Roofing"},
            {"id": 2, "name": "Electrical"},
        ]
        message = "Mere kamray ki chat kharaab horahi he pathar gir Rahe Hein"
        resp = self.client.post(
            "/api/chatbot/intent/",
            {"message": message, "context": {"form": {}, "available_categories": categories}},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get("suggested_category"), "Roofing")
        labels = [o.get("label") for o in resp.data.get("quick_options") or [] if o.get("action") == "choose_category"]
        self.assertEqual(len(labels), len(set(labels)), msg=f"duplicate category chips: {labels}")
        self.assertLessEqual(len(labels), 1, msg="inferred category should not show full category grid")

    @patch.object(ChatbotIntentView, "_intent_via_db_gemini_keys", return_value=(None, "test_skip_gemini"))
    @patch("api.views_v2.requests.post")
    def test_intent_fallback_parses_budget_from_message(self, mock_post, _mock_gemini):
        mock_post.side_effect = requests.ConnectionError("connection refused")
        resp = self.client.post(
            "/api/chatbot/intent/",
            {
                "message": "kitchen sink leak, budget 275",
                "context": {
                    "form": {},
                    "available_categories": [{"id": 1, "name": "Plumbing"}],
                },
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data.get("suggested_budget"), 275.0)
