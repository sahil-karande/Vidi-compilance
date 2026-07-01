import json
import requests

BASE_URL = "http://localhost:8000/api/scorecard"

# Set X-Mock-User to bypass active token validation loops locally
HEADERS = {
    "Content-Type": "application/json",
    "X-Mock-User": json.dumps({"id": "00000000-0000-0000-0000-000000000000", "email": "test@regiq.ai"})
}

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
    print("🚀 STARTING DAY 34 BYPASSED COMPLIANCE SCORECARD ENDPOINT MATRIX TEST")
    print("=" * 70)
    
    for profile_name, payload in profiles.items():
        print(f"\nTarget Profile: {profile_name.replace('_', ' ')}")
        
        try:
            response = requests.post(BASE_URL, json=payload, headers=HEADERS)
            print(f"Server Status Code: {response.status_code}")
            
            if response.status_code == 200:
                print("✨ Structured JSON Telemetry Output Response:")
                print(json.dumps(response.json(), indent=2))
            else:
                print(f"⚠️ Test Execution Failed with Error Content: {response.text}")
                
        except Exception as e:
            print(f"❌ Test execution failure: {str(e)}")
            
        print("-" * 70)

if __name__ == "__main__":
    run_scorecard_tests()