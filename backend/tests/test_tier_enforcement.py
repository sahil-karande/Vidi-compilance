import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import MagicMock, patch

client = TestClient(app)

# Helper mock for Supabase Auth representation
def get_mock_user(role: str):
    return {
        "id": "test-user-uuid-12345",
        "email": "sahil.test@ghrcem.edu",
        "user_metadata": {"role": role}
    }

class TestTierEnforcement:
    
    @patch("app.api.auth.get_current_user")
    def test_pro_features_blocked_for_free_user(self, mock_auth):
        """CRITICAL AUDIT: Free users must receive an upgrade redirection state/403."""
        mock_auth.return_value = get_mock_user(role="free")
        
        # Test Case A: Document Uploading (/api/upload)
        upload_resp = client.post("/api/upload", files={"file": ("test.pdf", b"pdfcontent")})
        assert upload_resp.status_code in [403, 402]
        assert "upgrade" in upload_resp.json()["detail"].lower()

        # Test Case B: Compliance Scorecard Access (/api/scorecard)
        scorecard_resp = client.get("/api/scorecard")
        assert scorecard_resp.status_code in [403, 402]
        assert "pro" in scorecard_resp.json()["detail"].lower()

        # Test Case C: Compliance Calendar Access (/api/calendar)
        calendar_resp = client.get("/api/calendar")
        assert calendar_resp.status_code in [403, 402]
        
    @patch("app.api.auth.get_current_user")
    def test_pro_features_allowed_for_pro_user(self, mock_auth):
        """CRITICAL AUDIT: Pro users must bypass the limits wrapper cleanly."""
        mock_auth.return_value = get_mock_user(role="pro")
        
        # Mocking lower database calls to prevent hitting non-existent test collections
        with patch("app.api.scorecard.fetch_scorecard_data") as mock_db:
            mock_db.return_value = {"status": "success", "score": "Green"}
            resp = client.get("/api/scorecard")
            assert resp.status_code == 200

    def test_razorpay_webhook_upgrade_lifecycle(self):
        """CRITICAL AUDIT: Emulate a successful Razorpay transaction update."""
        payload = {
            "entity": "event",
            "event": "subscription.charged",
            "payload": {
                "subscription": {
                    "entity": {
                        "id": "sub_test_12345",
                        "notes": {"user_id": "test-user-uuid-12345"}
                    }
                },
                "payment": {
                    "entity": {
                        "status": "captured"
                    }
                }
            }
        }
        
        headers = {"X-Razorpay-Signature": "mock_valid_sig"}
        
        with patch("app.api.billing.verify_webhook_signature", return_value=True), \
             patch("app.api.billing.update_user_role_in_db") as mock_update:
            
            response = client.post("/api/billing/webhook", json=payload, headers=headers)
            assert response.status_code == 200
            # Ensure database modifier function was targeted with upgraded role
            mock_update.assert_called_once_with(user_id="test-user-uuid-12345", new_role="pro")

    def test_razorpay_webhook_downgrade_on_failure(self):
        """CRITICAL AUDIT: Revert user privileges on payment failure notification."""
        payload = {
            "entity": "event",
            "event": "subscription.halted",
            "payload": {
                "subscription": {
                    "entity": {
                        "id": "sub_test_12345",
                        "notes": {"user_id": "test-user-uuid-12345"}
                    }
                }
            }
        }
        
        headers = {"X-Razorpay-Signature": "mock_valid_sig"}
        
        with patch("app.api.billing.verify_webhook_signature", return_value=True), \
             patch("app.api.billing.update_user_role_in_db") as mock_update:
            
            response = client.post("/api/billing/webhook", json=payload, headers=headers)
            assert response.status_code == 200
            # Ensure user privileges are successfully demoted back to free status
            mock_update.assert_called_once_with(user_id="test-user-uuid-12345", new_role="free")