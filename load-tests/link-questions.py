"""Link all existing questions to all CL-* sessions."""
import json, subprocess, sys

SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmd255a3RremhuYmxwbXRhbWtlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzcyNzYyMSwiZXhwIjoyMDkzMzAzNjIxfQ.Bw1fCnyZzILveuXKctvPlHJ3EzFWiofGsg3H4o0_Lb4"
URL = "https://jfwnyktkzhnblpmtamke.supabase.co"
HEADERS = ["-H", f"apikey: {SUPA_KEY}", "-H", f"Authorization: Bearer {SUPA_KEY}"]

def get(path):
    r = subprocess.run(["curl","-s", f"{URL}/rest/v1/{path}"] + HEADERS, capture_output=True)
    return json.loads(r.stdout)

def post(path, data, prefer="return=minimal,resolution=ignore-duplicates"):
    r = subprocess.run(["curl","-s","-o","/dev/null","-w","%{http_code}",
        "-X","POST", f"{URL}/rest/v1/{path}"] + HEADERS + [
        "-H","Content-Type: application/json",
        "-H",f"Prefer: {prefer}",
        "-d", json.dumps(data)], capture_output=True)
    return r.stdout.decode().strip()

sessions  = get("quiz_sessions?access_code=like.CL-*&select=id,access_code&order=access_code")
questions = get("questions?select=id")
qids = [q["id"] for q in questions]

print(f"{len(sessions)} sessions, {len(qids)} questions", flush=True)

ok = 0
for s in sessions:
    rows = [{"session_id": s["id"], "question_id": qid, "position": i, "time_seconds": 30}
            for i, qid in enumerate(qids)]
    code = post("quiz_session_questions", rows)
    status = "OK" if code in ("201","204") else f"ERR {code}"
    print(f"  {s['access_code']} -> {status}", flush=True)
    if code in ("201","204"):
        ok += 1

print(f"\nDone: {ok}/{len(sessions)} sessions have {len(qids)} questions each")
