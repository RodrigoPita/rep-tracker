-- exercise_classes: top-level exercise categories (e.g. "Flexão", "Barra")
create table exercise_classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- exercises: specific variants within a class (e.g. "Diamante", "Arqueiro")
create table exercises (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references exercise_classes(id) on delete cascade,
  variant text not null,
  created_at timestamptz not null default now(),
  unique(class_id, variant)
);

-- routines: named workout routines
create table routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- routine_exercises: exercises assigned to a routine
create table routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  sets int not null default 3,
  target_reps int not null default 10,
  display_order int not null default 0
);

-- workout_sessions: a single training session
create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines(id) on delete cascade,
  date date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- workout_sets: one row per set performed
create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions(id) on delete cascade,
  routine_exercise_id uuid not null references routine_exercises(id) on delete cascade,
  set_number int not null,
  target_reps int not null,
  actual_reps int,
  completed boolean not null default false,
  completed_at timestamptz
);

-- seed exercise classes and variants
with classes as (
  insert into exercise_classes (name) values
    ('Flexão'),
    ('Barra'),
    ('Agachamento'),
    ('Afundo'),
    ('Fundos'),
    ('Abdominal'),
    ('Prancha'),
    ('Escalador'),
    ('Burpee'),
    ('Ponte')
  returning id, name
)
insert into exercises (class_id, variant) values
  -- Flexão
  ((select id from classes where name = 'Flexão'), 'Normal'),
  ((select id from classes where name = 'Flexão'), 'Diamante'),
  ((select id from classes where name = 'Flexão'), 'Aberta'),
  ((select id from classes where name = 'Flexão'), 'Arqueiro'),
  ((select id from classes where name = 'Flexão'), 'Locomotiva'),
  ((select id from classes where name = 'Flexão'), 'Declinada'),
  ((select id from classes where name = 'Flexão'), 'Inclinada'),
  ((select id from classes where name = 'Flexão'), 'Com rotação'),
  -- Barra
  ((select id from classes where name = 'Barra'), 'Supinada'),
  ((select id from classes where name = 'Barra'), 'Pronada'),
  ((select id from classes where name = 'Barra'), 'Neutra'),
  ((select id from classes where name = 'Barra'), 'Australiana'),
  -- Agachamento
  ((select id from classes where name = 'Agachamento'), 'Normal'),
  ((select id from classes where name = 'Agachamento'), 'Sumô'),
  ((select id from classes where name = 'Agachamento'), 'Búlgaro'),
  ((select id from classes where name = 'Agachamento'), 'Pistol'),
  ((select id from classes where name = 'Agachamento'), 'Isométrico'),
  -- Afundo
  ((select id from classes where name = 'Afundo'), 'Normal'),
  ((select id from classes where name = 'Afundo'), 'Reverso'),
  ((select id from classes where name = 'Afundo'), 'Lateral'),
  ((select id from classes where name = 'Afundo'), 'Caminhada'),
  -- Fundos
  ((select id from classes where name = 'Fundos'), 'Normal'),
  ((select id from classes where name = 'Fundos'), 'Em cadeira'),
  -- Abdominal
  ((select id from classes where name = 'Abdominal'), 'Reto'),
  ((select id from classes where name = 'Abdominal'), 'Oblíquo'),
  ((select id from classes where name = 'Abdominal'), 'Infra'),
  ((select id from classes where name = 'Abdominal'), 'Bicicleta'),
  ((select id from classes where name = 'Abdominal'), 'V-sit'),
  ((select id from classes where name = 'Abdominal'), 'Remador'),
  ((select id from classes where name = 'Abdominal'), 'Canivete'),
  ((select id from classes where name = 'Abdominal'), 'Elevação de joelhos'),
  ((select id from classes where name = 'Abdominal'), 'Elevação de pernas'),
  -- Prancha
  ((select id from classes where name = 'Prancha'), 'Frontal'),
  ((select id from classes where name = 'Prancha'), 'Lateral'),
  ((select id from classes where name = 'Prancha'), 'Com elevação de braço'),
  -- Escalador
  ((select id from classes where name = 'Escalador'), 'Normal'),
  ((select id from classes where name = 'Escalador'), 'Cruzado'),
  -- Burpee
  ((select id from classes where name = 'Burpee'), 'Normal'),
  ((select id from classes where name = 'Burpee'), 'Com flexão'),
  -- Ponte
  ((select id from classes where name = 'Ponte'), 'Normal'),
  ((select id from classes where name = 'Ponte'), 'Unilateral');
