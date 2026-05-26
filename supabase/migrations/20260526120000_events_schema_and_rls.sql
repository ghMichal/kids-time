-- F-01: events table, indexes, updated_at trigger, and RLS policies (atomic deploy)

CREATE TYPE public.event_triage_status AS ENUM (
  'draft',
  'pending',
  'accepted',
  'rejected',
  'maybe'
);

CREATE TYPE public.event_origin AS ENUM (
  'ai_suggested',
  'manual'
);

CREATE TYPE public.event_location_kind AS ENUM (
  'indoor',
  'outdoor'
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  summary text,
  source_url text,
  image_path text,
  place text,
  starts_at timestamptz,
  child_age_years smallint,
  location_kind public.event_location_kind,
  origin public.event_origin,
  triage_status public.event_triage_status,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  copied_from_event_id uuid REFERENCES public.events (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_published_at_consistency CHECK (
    is_published = false OR published_at IS NOT NULL
  )
);

COMMENT ON TABLE public.events IS 'Parent-owned activity events with triage and publish lifecycle.';

CREATE INDEX events_owner_id_idx ON public.events (owner_id);

CREATE INDEX events_is_published_idx ON public.events (is_published)
WHERE is_published;

CREATE INDEX events_copied_from_event_id_idx ON public.events (copied_from_event_id)
WHERE copied_from_event_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

CREATE POLICY events_select_own_or_published
ON public.events
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR is_published = true);

CREATE POLICY events_insert_own
ON public.events
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY events_update_own
ON public.events
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY events_delete_own
ON public.events
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());
