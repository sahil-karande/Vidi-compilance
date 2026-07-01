import json
import requests

# Adjust the port if your FastAPI app runs on a different address (e.g., 8000)
BASE_URL = "http://localhost:8000/api/scorecard"

# Pass a dummy token for local functional verification if auth middleware is temporarily bypassed,
# or paste a valid current JWT from your development workspace.
HEADERS = {
    "Content-Type": "application/json",
    "Authorization": "Bearer MOCK_DEV_JWT_TOKEN"
}

# Day 34 Matrix: The 5 core test profiles representing distinct Indian SME / Enterprise setups
profiles = {
    "1_Fully_Compliant_SME_Retailer": {
        "industry_type": "Retail",
        "annual_turnover_inr": 1500000.0,
        "is_import_export": False,
        "has_listed_securities": False,
        "missing_filings": []
    },
    "2_Non_Compliant_Manufacturer": {
        "industry_type": "Manufacturing",
        "annual_turnover_inr": 6500000.0,
        "is_import_export": False,
        "has_listed_securities": False,
        "missing_filings": ["GSTR-1", "AOC-4"]
    },
    "3_Cross_Border_Exporter": {
        "industry_type": "E-Commerce",
        "annual_turnover_inr": 12000000.0,
        "is_import_export": True,
        "has_listed_securities": False,
        "missing_filings": ["FEMA-FLA", "GSTR-3B"]
    },
    "4_Listed_FinTech_Enterprise": {
        "industry_type": "FinTech",
        "annual_turnover_inr": 450000000.0,
        "is_import_export": True,
        "has_listed_securities": True,
        "missing_filings": ["LODR-COMPLIANCE", "MGT-7"]
    },
    "5_High_Turnover_IT_Omissions": {
        "industry_type": "IT Services",
        "annual_turnover_inr": 5000000.0,
        "is_import_export": False,
        "has_listed_securities": False,
        "missing_filings": ["GSTR-1", "DIR-3-KYC"]
    }
}

def run_scorecard_tests():
    print("=" * 70)
    print("🚀 STARTING DAY 34 COMPLIANCE SCORECARD ENDPOINT MATRIX TEST SUITE")
    print("=" * 70)
    
    for profile_name, payload in profiles.items():
        print(f"\nTarget Profile: {profile_name.replace('_', ' ')}")
        print(f"Payload Config: {json.dumps(payload, indent=2)}")
        
        try:
            response = requests.post(BASE_URL, json=payload, headers=HEADERS)
            print(f"Server Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("✨ Structured JSON Telemetry Output Response:")
                print(json.dumps(response.json(), indent=2))
            else:
                print(f"⚠️ Test Execution Failed with Error Content: {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("❌ Connection Error: Could not reach the FastAPI server. Ensure main.py is up and running on port 8000.")
            break
        except Exception as e:
            print(f"❌ Unexpected test execution failure: {str(e)}")
            
        print("-" * 70)

if __name__ == "__main__":
    run_scorecard_tests()