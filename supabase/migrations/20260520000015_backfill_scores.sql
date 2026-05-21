-- One-off backfill: recompute is_correct, points_awarded, and quiz_attempts.score
-- for already-submitted MCQ/true_false answers using the new max_points rule.
-- Short/long answers are left untouched (they need manual/AI grading).

-- 1. Recompute is_correct + points_awarded for mcq / true_false rows
UPDATE quiz_answers qa
SET is_correct = CASE
      WHEN qa.answer IS NULL OR length(trim(qa.answer)) = 0 THEN FALSE
      WHEN q.correct_answer IS NULL THEN FALSE
      ELSE lower(trim(qa.answer)) = lower(trim(q.correct_answer))
    END,
    points_awarded = CASE
      WHEN qa.answer IS NOT NULL
       AND q.correct_answer IS NOT NULL
       AND lower(trim(qa.answer)) = lower(trim(q.correct_answer))
      THEN COALESCE(q.max_points, 1)
      ELSE 0
    END,
    graded_at = COALESCE(qa.graded_at, now())
FROM questions q
WHERE q.id = qa.question_id
  AND q.type IN ('mcq', 'true_false');

-- 2. Recompute each attempt's score = SUM(points_awarded)
UPDATE quiz_attempts a
SET score = COALESCE(s.total, 0)
FROM (
  SELECT attempt_id, SUM(COALESCE(points_awarded, 0))::INT AS total
  FROM quiz_answers
  GROUP BY attempt_id
) s
WHERE a.id = s.attempt_id;
