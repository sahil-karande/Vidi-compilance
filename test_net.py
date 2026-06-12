import urllib.request
import ssl

print("--- Testing Network Path via Urllib ---")
urls = [
    "https://www.wipo.int/export/sites/www/directory/en/legal_texts/pdf/in019en.pdf",
    "https://www.google.com"
]

# Bypass SSL verification checks just for this diagnostics test
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

for url in urls:
    try:
        print(f"Connecting to: {url}")
        with urllib.request.urlopen(url, timeout=10, context=ctx) as response:
            print(f"  SUCCESS! Status Code: {response.getcode()}")
            print(f"  Content Length: {len(response.read(100))} bytes read...")
    except Exception as e:
        print(f"  FAILED! Error type: {type(e).__name__} | Message: {e}")