# Skill: Add a New Page

## When to Use

When adding a new route/page to the app.

## Steps

### 1. Create Page Component

Create `src/pages/PageName.tsx`:

```tsx
export default function PageName() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">Page Title</h1>
      {/* Content */}
    </div>
  );
}
```

### 2. Add Route

In `src/App.tsx`, add inside the `<Routes>` block:

```tsx
<Route path="/page-name" element={<PageName />} />
```

### 3. Add Sidebar Link

In `src/components/Sidebar.tsx`, add to the `links` array:

```tsx
{ to: "/page-name", label: "Page Name", icon: "⬡" },
```

### 4. Add Tauri Commands (if needed)

1. Create command handler in `src-tauri/src/commands/`
2. Register in `lib.rs` invoke_handler
3. Add typed wrapper in `src/lib/tauri.ts`
4. Add types in `src/lib/types.ts`

## Patterns

- Pages manage their own state with `useState`/`useEffect`
- Tauri IPC calls go through `src/lib/tauri.ts` wrappers
- Toast notifications follow the pattern: `setToast("message")` with auto-dismiss
- UI text must be in Portuguese (pt-BR)
- Use CSS variables for theming (`var(--bg-primary)`, `var(--accent)`, etc.)
