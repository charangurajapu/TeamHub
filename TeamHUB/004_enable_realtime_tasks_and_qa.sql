-- =========================================================================
-- TeamHub SQL Migration 004: Enable Realtime for Tasks & Q&A Tables
-- Run in Supabase SQL Editor (Dashboard > SQL Editor)
-- =========================================================================

DO $$
BEGIN
  -- 1. Add tasks table to supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'tasks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
  END IF;

  -- 2. Add questions table to supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'questions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.questions;
  END IF;

  -- 3. Add question_answers table to supabase_realtime publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'question_answers'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.question_answers;
  END IF;

  -- Ensure replica identity is FULL so update/delete payloads include old/new records
  ALTER TABLE public.tasks REPLICA IDENTITY FULL;
  ALTER TABLE public.questions REPLICA IDENTITY FULL;
  ALTER TABLE public.question_answers REPLICA IDENTITY FULL;
END $$;
