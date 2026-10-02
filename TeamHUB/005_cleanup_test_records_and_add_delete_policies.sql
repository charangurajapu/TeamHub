-- =========================================================================
-- TeamHub SQL Migration 005: Clean Verification Records & Add Q&A Delete Policies
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =========================================================================

-- 1. Clean up verification records
DELETE FROM public.question_answers 
WHERE id = '8e0bedf9-95cf-4211-8b08-1adefe008966' 
   OR author_id IN (SELECT id FROM public.profiles WHERE email = 'tester@teamhub.internal');

DELETE FROM public.questions 
WHERE id = 'ba0ec9b3-4991-46a6-ad31-db3c2964b984'
   OR author_id IN (SELECT id FROM public.profiles WHERE email = 'tester@teamhub.internal');

DELETE FROM public.tasks 
WHERE id = '48dc580c-85fc-41f8-8b72-86b4be659b2b'
   OR key LIKE 'VERIFY-%';

-- 2. Add standard DELETE policies on questions and question_answers
-- (Permits author or workspace admin to delete questions / answers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'questions' AND policyname = 'Questions deletable by author or admin'
  ) THEN
    CREATE POLICY "Questions deletable by author or admin"
      ON public.questions FOR DELETE
      USING (
        auth.uid() = author_id
        OR public.current_user_role() = 'admin'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'question_answers' AND policyname = 'Answers deletable by author or admin'
  ) THEN
    CREATE POLICY "Answers deletable by author or admin"
      ON public.question_answers FOR DELETE
      USING (
        auth.uid() = author_id
        OR public.current_user_role() = 'admin'
      );
  END IF;
END $$;
