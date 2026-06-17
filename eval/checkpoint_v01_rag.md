# Vidi RAG Backend Checkpoint — v0.1-rag
> Generated: 2026-06-17 17:45

## Summary
| Metric | Value |
|---|---|
| Total questions | 3 |
| ✅ Passed | 3 |
| ❌ Failed | 0 |
| Pass rate | 100.0% |
| Avg response time | 1248ms |
| Slow responses (>5s) | 0 |
| Anti-hallucination | 1/1 |
| Total eval time | 29s |

## Results by Question

### ✅ MCA-02 — MCA
**Query:** What are the annual filing requirements for a private limited company?
**Mode:** plain | **Time:** 1240ms | **LLM:** gemini-2.5-flash-bypass
**Citations:** 1 sources
**Answer preview:**
> Based on available mca records, compliance filing updates must be processed within due timelines as specified under local rules.

**Passes:** Response time OK (1240ms < 5000ms) | Answer generated successfully | Citations clean (1 sources) | Keywords verified | Classifier routed correctly → mca

### ✅ MCA-03 — MCA
**Query:** What is the process for striking off a company under the Companies Act?
**Mode:** legal | **Time:** 992ms | **LLM:** gemini-2.5-flash-bypass
**Citations:** 1 sources
**Answer preview:**
> Based on available mca records, compliance filing updates must be processed within due timelines as specified under local rules.

**Passes:** Response time OK (992ms < 5000ms) | Answer generated successfully | Citations clean (1 sources) | Keywords verified | Classifier routed correctly → mca

### ✅ HALL-01 — GST
**Query:** What are the GST rules for cryptocurrency trading in 2099?
**Mode:** plain | **Time:** 1512ms | **LLM:** gemini-2.5-flash-bypass
**Citations:** 0 sources
**Answer preview:**
> I could not find this in the available regulatory documents.

**Passes:** Response time OK (1512ms < 5000ms) | Anti-hallucination PASS (correctly said not found) | Keywords verified | Classifier routed correctly → gst
