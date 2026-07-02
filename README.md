# GeoTeX Studio

Figures built for TeX.

GeoTeX Studio is a web-based academic figure editor for creating, refining, linting, saving, versioning, and exporting GeoGebra-style mathematical and physics diagrams into clean LaTeX/TikZ code.

It is designed as a serious figure tool for papers, theses, lecture notes, olympiad solutions, and physics reports.

## Why It Is Different

Normal GeoGebra and TikZ exporters often produce coordinate-heavy output that is hard to review, reuse, or maintain in a TeX project. GeoTeX Studio keeps an internal semantic diagram model, then exports named coordinates, reusable TikZ styles, LaTeX-safe labels, and role-aware objects such as construction lines, force vectors, tangent lines, axes, and theorem labels.

## Core Features

- Login/register gate before the studio workspace opens.
- GeoGebra Apps API bridge with an editable SVG canvas.
- Internal diagram object model for points, segments, lines, circles, rectangles, triangles, vectors, angles, labels, function plots, and polygons.
- Icon rail, keyboard shortcuts, drag handles, marquee selection, pan, and zoom.
- Diagram beautifier for TeX-friendly labels, line weights, construction styles, and vector notation.
- ESLint-style diagram linter with score, grade, findings, and suggested fixes.
- Semantic TikZ exporter with package hints and `.tex` download.
- Compatibility panel for TikZ packages, grayscale safety, print suitability, Beamer suitability, and LaTeX-safe labels.
- Browser-backed access that works without Supabase credentials.
- Supabase Auth, PostgreSQL storage, row-level security, projects, diagrams, versions, lint runs, export history, and custom presets.

## Creating Figures

GeoTeX Studio opens directly into a blank editor canvas. The figure builder toolbar supports:

- `Point`: click once on the canvas.
- `Segment`: click the start point, then click the end point.
- `Circle`: click the center, then click a radius point.
- `Rectangle`: click opposite corners.
- `Triangle`: click three vertices.
- `Vector`: click the tail, then click the arrow head.
- `Label`: type a label, then click where it should appear.
- `Select`: click objects, drag a selection box, move objects, or drag handles.

`Snap` keeps new objects aligned to the grid. `Grid` toggles the GeoGebra-style coordinate grid. Mouse wheel zooms the canvas, and middle mouse, Option/Alt-drag, or Space-drag pans the view. Every created object is added to the semantic object model and immediately appears in the TikZ output.

## Offline Access

The app works without Supabase environment variables by using a browser-local access session. Users can create figures, edit properties, beautify them, run the linter, apply safe fixes, copy TikZ, and download `.tex` files. Supabase-backed project save/load panels appear only when Supabase credentials are configured.

## Supabase Setup

Create a Supabase project, then copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Never hardcode Supabase keys or service role secrets in the app.

## SQL Migration

Run the initial schema migration in Supabase SQL editor or through the Supabase CLI:

```bash
supabase db push
```

Migration file:

```text
supabase/migrations/0001_initial_schema.sql
```

It creates:

- `profiles`
- `projects`
- `diagrams`
- `diagram_versions`
- `style_presets`
- `lint_runs`
- `export_history`

It also seeds the system presets:

- Olympiad Geometry
- Physics Report
- Thesis / Paper
- Beamer Presentation
- Teaching

## RLS Model

Row Level Security is enabled on all user-owned tables.

- Profiles are readable, insertable, and updateable only by the owning user.
- Projects are readable by owners, plus public projects are readable by everyone.
- Diagrams are readable by owners, plus diagrams inside public projects are readable by everyone.
- Diagram versions, lint runs, and export history are accessible only through diagrams owned by the signed-in user.
- System style presets are readable by everyone.
- User presets can only be created, updated, and deleted by their owner.
- Normal users cannot modify system presets.

## Development

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run linting:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build
```

## Deploy To Vercel

1. Push this repository to GitHub.
2. Import it in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel project settings.
4. Deploy.

The app remains usable with browser-local access if those variables are not set, but synced persistence requires them.

## Roadmap

- Real GeoGebra object extraction.
- Import/export `.ggb`.
- PGFPlots export.
- More physics diagram templates.
