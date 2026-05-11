# Whole-Application k6 Load Tests

This folder contains a realistic k6 setup for the quiz SaaS app. It tests public pages, teacher/dashboard behavior, and the full participant quiz flow through Supabase RPCs.

The main file is:

```bash
k6 run load-tests/app-load-test.js
```

## Files

```text
load-tests/
  app-load-test.js  # main executable test
  config.js         # environment variables and safe defaults
  helpers.js        # HTTP, Supabase, auth, RPC, metrics helpers
  scenarios.js      # public/teacher/participant/mixed load profiles
  realtime.js       # Supabase Realtime websocket helpers and isolation checks
  setup-load-quiz.mjs    # creates/resets a dedicated 20-question LOAD20 quiz
  cleanup-load-data.mjs  # removes generated load-test attempts
  report-load-data.mjs   # reports generated attempts/answers per quiz code
  README.md         # this guide
```

## Install k6

Windows:

```powershell
winget install k6.k6
```

macOS:

```bash
brew install k6
```

Linux:

```bash
sudo gpg -k
curl -fsSL https://dl.k6.io/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/k6-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

## Start Your App First

Run the app locally or deploy a test/staging version:

```bash
npm run dev
```

Default local URL is:

```text
http://localhost:5173
```

For production-like results, use a staging deployment, not your real production app.

## Required Environment Variables

At minimum, pass:

```bash
k6 run \
  -e BASE_URL=http://localhost:5173 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e QUIZ_CODE=TEST \
  load-tests/app-load-test.js
```

Useful variables:

```text
BASE_URL                  App URL, for example http://localhost:5173
SUPABASE_URL              Supabase project URL
SUPABASE_ANON_KEY         Supabase anon/publishable key
QUIZ_CODE                 Live quiz code used by participants
QUIZ_CODES                Comma-separated active quiz codes for multi-session tests
QUIZ_SELECTION            balanced or random, default balanced
QUESTION_COUNT            Default 20
ANSWER_BATCH_SIZE         Default 5
THINK_MIN_SECONDS         Default 1
THINK_MAX_SECONDS         Default 5
TEST_LEVEL                smoke, small, medium, large, stress
K6_SCENARIO               mixed, public, teacher, participant, realtime, school
SCHOOL_PROFILE            small_school, medium_school, large_school, stress_school
TEACHER_EMAIL             Test teacher email
TEACHER_PASSWORD          Test teacher password
TEACHER_SESSION_ID        Test session ID for start/monitor/close
TEACHER_SESSION_IDS       Comma-separated session IDs for multi-teacher tests
ENABLE_TEACHERS           true adds one teacher VU per class in school mode
ALLOW_TEACHER_MUTATIONS   Must be true to start a session from k6
ALLOW_TEACHER_PAUSE_RESUME true lets teacher VUs call pause/resume
ALLOW_SESSION_CLOSE       Must be true to close a session from k6
ENABLE_REALTIME           Optional websocket probe, default false
REALTIME_HOLD_SECONDS     How long each realtime VU holds the socket, default 30
RUN_DURATION              Override duration, for example 2m
LOAD_TEST_QUIZ_CODE       Setup/cleanup quiz code, default LOAD20
LOAD_TEST_QUIZ_CODES      Setup/cleanup comma-separated explicit quiz codes
LOAD_TEST_SESSION_COUNT   Number of dummy quiz sessions to create
LOAD_TEST_CODE_PREFIX     Prefix for generated codes, default LOAD20
LOAD_TEST_OWNER_ID        Owner user id for setup; optional if any session exists
SUPABASE_SERVICE_ROLE_KEY Required for setup/cleanup scripts
DELETE_LOAD_TEST_QUIZ     true deletes the LOAD20 session during cleanup
DELETE_LOAD_TEST_QUESTIONS true deletes generated k6-load-test questions
```

## Recommended Full Workflow

Create or reset a permanent 20-question dummy quiz:

```bash
npm run load:setup
```

The setup script uses `SUPABASE_SERVICE_ROLE_KEY` from `.env`, creates/opens a quiz with:

```text
QUIZ_CODE=LOAD20
QUESTION_COUNT=20
ANSWER_BATCH_SIZE=5
```

That means every completed participant should submit:

```text
20 answers / 5 per batch = 4 submit_quiz_answers_batch RPCs
```

Run the participant test:

```bash
k6 run \
  -e TEST_LEVEL=smoke \
  -e K6_SCENARIO=participant \
  -e BASE_URL=http://localhost:5173 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e QUIZ_CODE=LOAD20 \
  -e QUESTION_COUNT=20 \
  -e ANSWER_BATCH_SIZE=5 \
  load-tests/app-load-test.js
```

Clean generated attempts and answers:

```bash
npm run load:cleanup
```

Check how many load-test rows exist:

```bash
npm run load:report
```

Cleanup removes attempts where participant emails match:

```text
load-%@example.test
```

It keeps the `LOAD20` quiz and generated questions by default so you can reuse them.

To also delete the quiz and generated questions:

```bash
DELETE_LOAD_TEST_QUIZ=true DELETE_LOAD_TEST_QUESTIONS=true npm run load:cleanup
```

## Multi-Session School Testing

School mode tests many independent classrooms at the same time. Each quiz code represents a separate active `quiz_sessions` row. Participants are distributed across codes so you are testing multiple rooms instead of one giant room.

Built-in profiles:

```text
small_school:  3 classes  * 20 students = 60 participants
medium_school: 5 classes  * 30 students = 150 participants
large_school:  10 classes * 50 students = 500 participants
stress_school: 20 classes * 50 students = 1000 participants
```

Create dummy active sessions for the small profile:

PowerShell:

```powershell
$env:LOAD_TEST_SESSION_COUNT="3"
$env:LOAD_TEST_CODE_PREFIX="LOAD20"
npm run load:setup
```

Bash:

```bash
LOAD_TEST_SESSION_COUNT=3 LOAD_TEST_CODE_PREFIX=LOAD20 npm run load:setup
```

The setup command prints values like:

```text
QUIZ_CODES=LOAD20-1,LOAD20-2,LOAD20-3
TEACHER_SESSION_IDS=<id1>,<id2>,<id3>
```

Run a small school participant test:

```bash
k6 run \
  -e K6_SCENARIO=school \
  -e SCHOOL_PROFILE=small_school \
  -e QUIZ_CODES=LOAD20-1,LOAD20-2,LOAD20-3 \
  -e QUESTION_COUNT=20 \
  -e ANSWER_BATCH_SIZE=5 \
  -e BASE_URL=http://localhost:5173 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  load-tests/app-load-test.js
```

Run with participants plus one teacher per class:

```bash
k6 run \
  -e K6_SCENARIO=school \
  -e SCHOOL_PROFILE=small_school \
  -e ENABLE_TEACHERS=true \
  -e TEACHER_EMAIL=teacher@example.com \
  -e TEACHER_PASSWORD=your-password \
  -e TEACHER_SESSION_IDS=id1,id2,id3 \
  -e QUIZ_CODES=LOAD20-1,LOAD20-2,LOAD20-3 \
  load-tests/app-load-test.js
```

Run with separate Realtime socket load:

```bash
k6 run \
  -e K6_SCENARIO=school \
  -e SCHOOL_PROFILE=small_school \
  -e ENABLE_REALTIME=true \
  -e REALTIME_HOLD_SECONDS=30 \
  -e QUIZ_CODES=LOAD20-1,LOAD20-2,LOAD20-3 \
  load-tests/app-load-test.js
```

For exact classroom balance, keep:

```text
QUIZ_SELECTION=balanced
```

For random participant assignment across active sessions:

```text
QUIZ_SELECTION=random
```

Scale up only after the previous level is healthy:

```text
60 users:   SCHOOL_PROFILE=small_school,  3 quiz codes
150 users:  SCHOOL_PROFILE=medium_school, 5 quiz codes
500 users:  SCHOOL_PROFILE=large_school,  10 quiz codes
1000 users: SCHOOL_PROFILE=stress_school, 20 quiz codes
```

Create enough dummy sessions before each level:

```powershell
$env:LOAD_TEST_SESSION_COUNT="20"
$env:LOAD_TEST_CODE_PREFIX="LOAD20"
npm run load:setup
```

Then pass the printed `QUIZ_CODES`.

## Test Levels

Safe default is `small`, which is designed for Supabase Free planning.

```bash
k6 run -e TEST_LEVEL=smoke  ... load-tests/app-load-test.js
k6 run -e TEST_LEVEL=small  ... load-tests/app-load-test.js
k6 run -e TEST_LEVEL=medium ... load-tests/app-load-test.js
k6 run -e TEST_LEVEL=large  ... load-tests/app-load-test.js
k6 run -e TEST_LEVEL=stress ... load-tests/app-load-test.js
```

Levels:

```text
smoke:  1-5 users
small:  10 users
medium: 50 users
large:  100 users
stress: 300 users
```

Do not run `large` or `stress` directly on Supabase Free. Start with `smoke`, then `small`, then `medium`.

## Scenario Mix

Default is a mixed real-world test:

```text
5% teachers
85% participants
10% public visitors
```

Run one flow only:

```bash
k6 run -e K6_SCENARIO=public      ... load-tests/app-load-test.js
k6 run -e K6_SCENARIO=teacher     ... load-tests/app-load-test.js
k6 run -e K6_SCENARIO=participant ... load-tests/app-load-test.js
k6 run -e K6_SCENARIO=realtime    ... load-tests/app-load-test.js
k6 run -e K6_SCENARIO=school      ... load-tests/app-load-test.js
```

## What Gets Tested

Public visitors:

```text
/
/login
/signup
```

Teacher/admin:

```text
Supabase Auth login
/dashboard
quiz_sessions dashboard fetch
question category fetch
optional start session
leaderboard RPC monitor
optional close session
```

Realtime:

```text
Open Supabase Realtime websocket
Join quiz-status-{QUIZ_CODE} channel
Hold the socket for REALTIME_HOLD_SECONDS
Send heartbeat while connected
Track realtime_connect_success_rate
Track realtime_session_isolation_rate
```

Participant:

```text
/q/:code
get_session_for_join RPC
join_quiz_session RPC
get_session_for_play RPC
submit_quiz_answers_batch RPC
complete_quiz_attempt RPC
result page load
```

Each participant answers up to 20 questions with 1-5 seconds of think time between answers.

## Important Safety Rules

1. Start with `TEST_LEVEL=smoke`.
2. Do not run 300+ users directly on Supabase Free.
3. Do not run aggressive tests on production without permission.
4. Use test data only.
5. Clean up test attempts and sessions after testing.
6. Watch the Supabase usage dashboard during the test.
7. Keep `ALLOW_TEACHER_MUTATIONS=false` unless you are using a disposable test session.
8. Keep `ALLOW_SESSION_CLOSE=false` unless closing the test session is expected.

## How To Read k6 Output

Key built-in metrics:

```text
http_req_duration  Request latency. Watch avg and p95.
http_req_failed    Failed HTTP request rate.
http_reqs          Total requests.
iterations         Completed user-flow loops.
data_received      Download bandwidth.
data_sent          Upload bandwidth.
```

Important custom metrics:

```text
app_page_bytes                 HTML/static route response bytes seen by k6.
supabase_api_bytes             Supabase REST/RPC response bytes.
participant_quiz_flow_bytes    Participant RPC response bytes.
login_success_rate             Teacher login success.
quiz_join_success_rate         Participant join success.
session_load_success_rate      Session payload belongs to the selected quiz code.
answer_submit_success_rate     Answer batch success.
complete_quiz_success_rate     Completion success.
realtime_connect_success_rate  Realtime websocket connection success.
realtime_session_isolation_rate Realtime messages did not leak another quiz code.
normal_request_duration        Lightweight request latency.
heavy_request_duration         Dashboard/session/action latency.
```

Healthy numbers for normal tests:

```text
http_req_failed below 1%
p95 normal requests below 1000ms
p95 dashboard/session requests below 2000ms
quiz_join_success_rate above 95%
answer_submit_success_rate above 95%
complete_quiz_success_rate above 95%
```

Bad signs:

```text
http_req_failed above 1-2%
p95 repeatedly above 2 seconds
answer submissions timing out
joins failing during spikes
Supabase dashboard showing high database CPU or connection pressure
Realtime connections dropping
session_load_success_rate below 100%, which can indicate wrong codes or leakage
realtime_session_isolation_rate below 99%, which suggests cross-session broadcast leakage
```

## Detecting Multi-Session Problems

Realtime lag:

```text
Realtime connect success drops
Sockets disconnect early
Host dashboard feels delayed while answer submits are healthy
Supabase Realtime charts show connection pressure
```

Session leakage:

```text
session_load_success_rate fails
realtime_session_isolation_rate fails
Participants receive payloads with a different access_code
```

Slow queries or hot table contention:

```text
p95/p99 increases as classes increase
quiz_join_success_rate drops during ramp-up
answer_submit_success_rate drops while page requests stay healthy
Database CPU/IO spikes on quiz_attempts or quiz_answers writes
```

Websocket instability:

```text
realtime_connect_success_rate below 95%
High socket close/error counts
Realtime-only scenario fails while HTTP participant scenario passes
```

## Why Supabase Logs May Not Show The Big Load

You may not see the k6 spike clearly in every Supabase log screen. That does not mean the database was not hit.

Common reasons:

```text
API Gateway / PostgREST logs and Database logs are separate views.
RPC calls may show as PostgREST API traffic, not as individual SQL statements.
Dashboard charts can lag by several minutes.
Free-tier logs can be sampled, delayed, or have shorter retention.
Very fast successful requests may be summarized in metrics instead of obvious log rows.
Service-role setup/cleanup calls may appear differently from anon participant RPC calls.
Your browser filter/time window may not include the exact test minute.
```

Best places to confirm load:

```text
Supabase Dashboard -> Reports/API: request count and bandwidth
Supabase Dashboard -> Database: CPU, connections, IO
Table Editor -> quiz_attempts: rows created by load-%@example.test
Table Editor -> quiz_answers: answer rows linked to those attempts
k6 output: http_reqs, iterations, data_received, custom success rates
```

Direct SQL confirmation:

```sql
select count(*)
from quiz_attempts
where participant_email like 'load-%@example.test';

select count(*)
from quiz_answers qa
join quiz_attempts a on a.id = qa.attempt_id
where a.participant_email like 'load-%@example.test';
```

For a 20-question quiz, expected answer rows are approximately:

```text
completed participant flows * 20
```

## Compare With Supabase Dashboard

During and after the test, compare k6 with Supabase:

```text
k6 data_received       vs Supabase bandwidth
k6 http_reqs           vs Supabase API request volume
participant iterations vs quiz_attempts created
answer success rate    vs quiz_answers rows written
p95 latency spikes     vs database CPU/IO spikes
```

If k6 says the app is healthy but Supabase shows high database CPU, the bottleneck is probably database writes/RPC work, not frontend bandwidth.

## Estimate Monthly Bandwidth

Your optimized estimate:

```text
20-question participant quiz ~= 320 KB per participant
100 participants            ~= 32 MB
1,000 participants          ~= 320 MB
10,000 participants         ~= 3.2 GB
```

From a k6 result:

```text
monthly bandwidth ~= average bytes per completed participant flow * expected monthly participants
```

Example:

```text
320 KB * 5,000 monthly quiz participants = 1.6 GB/month
```

Remember that browser users may download cached or uncached frontend assets differently from k6. For backend planning, the Supabase RPC/API numbers matter more.

## Supabase Free Planning

For this app, bandwidth is probably not the first limit. The bigger risks are:

```text
RPC request volume
Realtime connections
Database writes
Concurrent quiz submissions
Supabase Free compute limits
```

Upgrade from Supabase Free to Pro when:

```text
medium tests fail but frontend bandwidth is still reasonable
database CPU/IO spikes during live quizzes
joins or answer submissions fail under classroom-size concurrency
Realtime connections become unreliable
you need production reliability, backups, and predictable compute
```

## Recommended First Run

Use a test quiz with 20 questions and a disposable access code:

```bash
k6 run \
  -e TEST_LEVEL=smoke \
  -e K6_SCENARIO=participant \
  -e BASE_URL=http://localhost:5173 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e QUIZ_CODE=TEST \
  load-tests/app-load-test.js
```

Then move to:

```bash
k6 run -e TEST_LEVEL=small -e K6_SCENARIO=mixed ... load-tests/app-load-test.js
```
