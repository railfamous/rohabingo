-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.






CREATE TABLE public.settings (
  id integer NOT NULL DEFAULT nextval('settings_id_seq'::regclass),
  key character varying NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.task_progress (
  id integer NOT NULL DEFAULT nextval('task_progress_id_seq'::regclass),
  user_id bigint NOT NULL,
  task_type character varying NOT NULL,
  task_id integer NOT NULL,
  status character varying NOT NULL DEFAULT 'pending'::character varying,
  points_earned integer DEFAULT 0,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  metadata jsonb,
  CONSTRAINT task_progress_pkey PRIMARY KEY (id),
  CONSTRAINT task_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.telegram_users(id)
);


  id bigint NOT NULL,
  username character varying,
  first_name character varying NOT NULL,
  last_name character varying,
  language_code character varying DEFAULT 'en'::character varying,
  photo_url text,
  CONSTRAINT telegram_users_pkey PRIMARY KEY (id)
);




