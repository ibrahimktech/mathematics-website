# BLOG_SYSTEM_V1_SPEC.md

# Mathematics Website — Blog System V1

## Project Overview

This website consists of two independent sections:

1. Exam Marketplace (selling mathematics exams)
2. Mathematics Blog

This specification only covers the Mathematics Blog.

The purpose of this blog is to allow my mathematics teacher to publish articles, solutions to Olympiad problems, proofs, new theorems, mathematical ideas, and educational content.

The blog should feel like a modern academic journal with excellent typography while remaining extremely simple to use.

---

# Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- Supabase Authentication
- Supabase Storage
- Markdown
- LaTeX
- remark-math
- rehype-katex
- KaTeX

Architecture should be clean, modular, scalable and production-ready.

---

# Authentication

There is ONLY ONE administrator.

The administrator is my mathematics teacher.

Requirements:

- Disable public registration completely.
- No Sign Up page.
- I will manually create the teacher account inside Supabase Authentication.
- Only authenticated administrator can access /admin routes.

Admin Login URL:

/admin/login

After successful login:

Redirect to

/admin/dashboard

Protect every route under

/admin/*

If user is not authenticated:

Redirect to login page.

Public users must NEVER have access to the dashboard.

---

# Administrator Experience

The administrator is NOT a technical person.

The interface must feel as simple as writing in Microsoft Word or Notion.

Workflow:

Open website

↓

Already logged in

↓

New Article

↓

Write

↓

Publish

No HTML.

No coding knowledge.

No confusing settings.

Everything should be intuitive.

---

# Dashboard

Simple dashboard.

Navigation:

- Yeni Məqalə
- Məqalələr
- Qaralamalar
- Dərc Edilmiş
- Kateqoriyalar
- Çıxış

Dashboard should be minimal and clean.

---

# Editor

The editor is the MOST IMPORTANT part of the system.

Requirements:

- Rich Text Editor
- Live Preview
- Markdown support
- Full LaTeX support
- Drag & Drop Images
- Paste Images
- Tables
- Code Blocks
- Lists
- Headings
- Quotes
- Hyperlinks

Mathematics must support:

Inline

$...$

Display

$$
...
$$

Render instantly while typing.

---

# Mathematical Support

Support all KaTeX features.

Examples:

$$
\int_0^1 x^2dx
$$

$$
\sum_{k=1}^{n}k
$$

Matrices

Cases

Align

Greek letters

Fractions

Roots

Vectors

Everything should render beautifully.

---

# Blog Post Structure

Each article contains:

- Title
- Slug
- Cover Image
- Short Description
- Category
- Tags
- Content
- Publish Date
- Draft / Published

---

# Categories

The sidebar should display categories.

Default categories:

📐 Həndəsə

🔢 Ədədlər Nəzəriyyəsi

➕ Cəbr

🧩 Kombinatorika

🏆 IMO Problemləri

🥇 Milli Olimpiada

📖 Həllər

💡 Teoremlər

📝 Məqalələr

Administrator should be able to create more categories later.

---

# Blog Homepage

Layout:

---------------------------------------------------

Header

Search Bar

Latest Articles

Sidebar

---------------------------------------------------

Sidebar:

- Kateqoriyalar
- Son Məqalələr
- Axtar

No comments.

No advertisements.

No user accounts.

No likes.

Focus entirely on reading mathematics.

---

# Article Page

Every article contains:

Title

Category

Publish Date

Reading Time

Cover Image

Article Content

Previous Article

Next Article

Related Articles

Share Buttons

---

# Search

Search should work by:

- Title
- Content
- Tags

Fast and responsive.

---

# Design Philosophy

Modern Academic.

Simple.

Elegant.

Minimal.

Readable.

Professional.

Do NOT copy Terence Tao's design.

Instead, build something inspired by modern documentation websites while maintaining an academic feeling.

Excellent spacing.

Excellent typography.

Large readable mathematics.

---

# Color Palette

Background

White

Primary Blue

#2563EB

Hover Blue

#3B82F6

Primary Text

#111827

Secondary Text

#6B7280

Borders

#E5E7EB

Cards

White

Avoid gradients.

Avoid glassmorphism.

Avoid unnecessary animations.

Everything should feel timeless.

---

# Typography

Headings

Merriweather

Body

Inter

Mathematics

KaTeX Default

Reading articles should feel comfortable even for very long mathematical papers.

---

# Sidebar

Desktop:

Visible.

Tablet:

Collapsible.

Mobile:

Hamburger menu.

Sidebar contains:

- Kateqoriyalar
- Son Məqalələr
- Axtar

---

# Azerbaijani Language

The ENTIRE application interface must be Azerbaijani.

Examples:

Ana Səhifə

Bloq

Kateqoriyalar

Axtar

Son Məqalələr

Yeni Məqalə

Qaralama

Dərc Edilmiş

Oxuma Müddəti

Paylaş

Sil

Redaktə Et

Yadda Saxla

Çıxış

No English interface.

---

# Azerbaijani Character Support

The application MUST fully support UTF-8.

Correct handling of:

Ə ə

I ı

İ i

Ü ü

Ö ö

Ç ç

Ş ş

Ğ ğ

Support must work everywhere:

- Database
- Search
- URLs
- Editor
- Categories
- Tags
- Titles
- Metadata

No encoding issues.

---

# SEO

Automatically generate:

- Meta Title
- Meta Description
- Open Graph
- Twitter Cards
- Canonical URL
- Structured Data
- RSS Feed
- XML Sitemap

SEO should be production-ready.

---

# Performance

Use Server Components where possible.

Optimize images.

Lazy load images.

Fast loading.

Minimal JavaScript.

Excellent Lighthouse score.

---

# Accessibility

Semantic HTML

Keyboard Navigation

ARIA Labels

High Contrast

Responsive

---

# Security

Protect all admin routes.

Sanitize Markdown.

Prevent XSS.

Secure file uploads.

Only authenticated administrator can:

- Create
- Edit
- Delete
- Publish

Everyone else has read-only access.

---

# Version 1 Scope

Included

✅ Login

✅ Dashboard

✅ Create Article

✅ Edit Article

✅ Delete Article

✅ Drafts

✅ Publish

✅ Categories

✅ Tags

✅ Search

✅ Images

✅ Markdown

✅ Full LaTeX

✅ Responsive Design

✅ SEO

Not Included

❌ Comments

❌ User Accounts

❌ Likes

❌ Ratings

❌ Bookmarks

❌ Multiple Authors

❌ Newsletter

The codebase should be clean enough so these features can be added later without major refactoring.

---

# Final Goal

The finished blog should feel like a modern mathematical journal.

It should be beautiful, incredibly readable, extremely fast, and effortless for my teacher to use.

The administrator experience should be simple enough that a non-technical mathematics teacher can publish articles without needing any assistance.