create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagrams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  diagram_type text not null check (diagram_type in ('geometry', 'physics', 'calculus', 'custom')),
  object_model jsonb not null default '{}'::jsonb,
  active_preset text,
  thumbnail_svg text,
  latest_tikz_code text,
  latest_lint_score integer check (latest_lint_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagram_versions (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null,
  object_model jsonb not null,
  tikz_code text,
  linter_score integer check (linter_score between 0 and 100),
  lint_results jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (diagram_id, version_number)
);

create table public.style_presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  category text not null check (category in ('olympiad', 'physics', 'paper', 'beamer', 'teaching', 'custom')),
  config jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint style_presets_owner_rule check (
    (is_system = true and owner_id is null) or
    (is_system = false and owner_id is not null)
  )
);

create table public.lint_runs (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  grade text not null check (grade in ('A', 'B', 'C', 'D')),
  findings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.export_history (
  id uuid primary key default gen_random_uuid(),
  diagram_id uuid not null references public.diagrams(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  export_format text not null check (export_format in ('tikz', 'tex', 'pgfplots')),
  tikz_code text not null,
  required_packages text[] not null default array['tikz'],
  is_grayscale_safe boolean not null default true,
  created_at timestamptz not null default now()
);

create index projects_owner_idx on public.projects(owner_id);
create index projects_public_idx on public.projects(is_public) where is_public = true;
create index diagrams_project_idx on public.diagrams(project_id);
create index diagrams_owner_idx on public.diagrams(owner_id);
create index diagram_versions_diagram_idx on public.diagram_versions(diagram_id);
create index style_presets_owner_idx on public.style_presets(owner_id);
create unique index style_presets_system_name_idx on public.style_presets(name) where is_system = true;
create index lint_runs_diagram_idx on public.lint_runs(diagram_id);
create index export_history_diagram_idx on public.export_history(diagram_id);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger diagrams_updated_at
before update on public.diagrams
for each row execute function public.set_updated_at();

create trigger style_presets_updated_at
before update on public.style_presets
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.diagrams enable row level security;
alter table public.diagram_versions enable row level security;
alter table public.style_presets enable row level security;
alter table public.lint_runs enable row level security;
alter table public.export_history enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
using (id = auth.uid());

create policy "Users can insert their own profile"
on public.profiles for insert
with check (id = auth.uid());

create policy "Users can update their own profile"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read own or public projects"
on public.projects for select
using (owner_id = auth.uid() or is_public = true);

create policy "Users can create projects for themselves"
on public.projects for insert
with check (owner_id = auth.uid());

create policy "Users can update their own projects"
on public.projects for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete their own projects"
on public.projects for delete
using (owner_id = auth.uid());

create policy "Users can read own or public project diagrams"
on public.diagrams for select
using (
  owner_id = auth.uid()
  or exists (
    select 1 from public.projects
    where projects.id = diagrams.project_id
    and projects.is_public = true
  )
);

create policy "Users can create diagrams in their own projects"
on public.diagrams for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.projects
    where projects.id = diagrams.project_id
    and projects.owner_id = auth.uid()
  )
);

create policy "Users can update their own diagrams"
on public.diagrams for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Users can delete their own diagrams"
on public.diagrams for delete
using (owner_id = auth.uid());

create policy "Users can read versions for their own diagrams"
on public.diagram_versions for select
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = diagram_versions.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can create versions for their own diagrams"
on public.diagram_versions for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = diagram_versions.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can delete versions for their own diagrams"
on public.diagram_versions for delete
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = diagram_versions.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Everyone can read system presets and users can read own presets"
on public.style_presets for select
using (is_system = true or owner_id = auth.uid());

create policy "Users can create their own non-system presets"
on public.style_presets for insert
with check (owner_id = auth.uid() and is_system = false);

create policy "Users can update their own non-system presets"
on public.style_presets for update
using (owner_id = auth.uid() and is_system = false)
with check (owner_id = auth.uid() and is_system = false);

create policy "Users can delete their own non-system presets"
on public.style_presets for delete
using (owner_id = auth.uid() and is_system = false);

create policy "Users can read lint runs for their own diagrams"
on public.lint_runs for select
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = lint_runs.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can create lint runs for their own diagrams"
on public.lint_runs for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = lint_runs.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can delete lint runs for their own diagrams"
on public.lint_runs for delete
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = lint_runs.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can read export history for their own diagrams"
on public.export_history for select
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = export_history.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can create export history for their own diagrams"
on public.export_history for insert
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = export_history.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

create policy "Users can delete export history for their own diagrams"
on public.export_history for delete
using (
  owner_id = auth.uid()
  and exists (
    select 1 from public.diagrams
    where diagrams.id = export_history.diagram_id
    and diagrams.owner_id = auth.uid()
  )
);

insert into public.style_presets (name, category, config, is_system)
values
  (
    'Olympiad Geometry',
    'olympiad',
    '{
      "canvas": { "gridVisible": false, "background": "#ffffff" },
      "defaultObjectStyle": { "stroke": "#111111", "strokeWidth": 1.1, "fill": "transparent" },
      "roleStyles": {
        "main-object": { "stroke": "#111111", "strokeWidth": 1.25 },
        "construction-line": { "stroke": "#60646c", "strokeWidth": 0.75, "dashed": true, "opacity": 0.75 },
        "theorem-label": { "stroke": "#111111", "fontSize": 13 }
      },
      "labelStyle": { "fontSize": 13, "normalizeLatex": true },
      "export": { "scale": 1, "grayscaleSafe": true, "columnWidthCm": 8.5 }
    }'::jsonb,
    true
  ),
  (
    'Physics Report',
    'physics',
    '{
      "canvas": { "gridVisible": false, "background": "#ffffff" },
      "defaultObjectStyle": { "stroke": "#111111", "strokeWidth": 1.1, "fill": "transparent" },
      "roleStyles": {
        "main-object": { "stroke": "#111111", "strokeWidth": 1.3 },
        "force-vector": { "stroke": "#111111", "strokeWidth": 1.7, "arrow": true },
        "construction-line": { "stroke": "#60646c", "strokeWidth": 0.8, "dashed": true }
      },
      "labelStyle": { "fontSize": 14, "normalizeLatex": true },
      "export": { "scale": 1, "grayscaleSafe": true, "columnWidthCm": 9 }
    }'::jsonb,
    true
  ),
  (
    'Thesis / Paper',
    'paper',
    '{
      "canvas": { "gridVisible": false, "background": "#ffffff" },
      "defaultObjectStyle": { "stroke": "#111111", "strokeWidth": 1, "fill": "transparent" },
      "roleStyles": {
        "main-object": { "stroke": "#111111", "strokeWidth": 1.15 },
        "construction-line": { "stroke": "#737373", "strokeWidth": 0.7, "dashed": true, "opacity": 0.8 },
        "function-curve": { "stroke": "#111111", "strokeWidth": 1.25 },
        "axis": { "stroke": "#111111", "strokeWidth": 0.95, "arrow": true }
      },
      "labelStyle": { "fontSize": 11, "normalizeLatex": true },
      "export": { "scale": 0.95, "grayscaleSafe": true, "columnWidthCm": 8 }
    }'::jsonb,
    true
  ),
  (
    'Beamer Presentation',
    'beamer',
    '{
      "canvas": { "gridVisible": false, "background": "#ffffff" },
      "defaultObjectStyle": { "stroke": "#111111", "strokeWidth": 1.35, "fill": "transparent" },
      "roleStyles": {
        "main-object": { "stroke": "#111111", "strokeWidth": 1.7 },
        "force-vector": { "stroke": "#0f172a", "strokeWidth": 2, "arrow": true },
        "function-curve": { "stroke": "#0f172a", "strokeWidth": 1.8 },
        "construction-line": { "stroke": "#60646c", "strokeWidth": 1, "dashed": true }
      },
      "labelStyle": { "fontSize": 16, "normalizeLatex": true },
      "export": { "scale": 1.12, "grayscaleSafe": true, "columnWidthCm": 11 }
    }'::jsonb,
    true
  ),
  (
    'Teaching',
    'teaching',
    '{
      "canvas": { "gridVisible": true, "background": "#fbfdff" },
      "defaultObjectStyle": { "stroke": "#111111", "strokeWidth": 1.2, "fill": "transparent" },
      "roleStyles": {
        "main-object": { "stroke": "#1d4ed8", "strokeWidth": 1.5 },
        "construction-line": { "stroke": "#64748b", "strokeWidth": 1, "dashed": true },
        "force-vector": { "stroke": "#047857", "strokeWidth": 1.8, "arrow": true },
        "function-curve": { "stroke": "#7c2d12", "strokeWidth": 1.6 },
        "area-region": { "fill": "#dbeafe", "stroke": "#1d4ed8", "opacity": 0.45 }
      },
      "labelStyle": { "fontSize": 15, "normalizeLatex": true },
      "export": { "scale": 1.05, "grayscaleSafe": false, "columnWidthCm": 10 }
    }'::jsonb,
    true
  )
on conflict do nothing;
