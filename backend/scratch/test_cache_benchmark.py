import time
from fastapi.testclient import TestClient
from app.main import app

def run_benchmark():
    with TestClient(app) as client:
        payload = {
            "query": "Can an SME claim input tax credit on commercial vehicles under GST?",
            "mode": "plain"
        }
        print("\n--- Starting Benchmark ---")
        # Query 1
        t0 = time.time()
        r1 = client.post("/api/query", json=payload)
        t1 = time.time()
        dur1 = (t1 - t0) * 1000
        print(f"Query 1 (Pipeline execution): Status={r1.status_code}, Latency={dur1:.2f}ms")
        assert r1.status_code == 200, f"Query 1 failed: {r1.text}"
        data1 = r1.json()
        print(f"Answer: {data1['answer'][:80]}...")

        # Query 2 (Identical query -> Cache HIT)
        t2 = time.time()
        r2 = client.post("/api/query", json=payload)
        t3 = time.time()
        dur2 = (t3 - t2) * 1000
        print(f"Query 2 (In-Memory Cache Hit): Status={r2.status_code}, Latency={dur2:.2f}ms")
        assert r2.status_code == 200, f"Query 2 failed: {r2.text}"
        data2 = r2.json()
        assert data1["answer"] == data2["answer"], "Cached answer did not match original"

        speedup = dur1 / max(dur2, 0.001)
        print(f"--> Speedup factor: {speedup:.1f}x faster on repeated query!")

        # Check telemetry stats
        stats_resp = client.get("/api/cache/stats").json()
        print("Telemetry stats:", stats_resp)
        assert stats_resp["cache"]["hits"] >= 1
        print("ALL BENCHMARK TESTS PASSED SUCCESSFULLY!\n")

if __name__ == "__main__":
    run_benchmark()
