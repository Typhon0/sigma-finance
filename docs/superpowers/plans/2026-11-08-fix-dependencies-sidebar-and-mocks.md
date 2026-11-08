# Final Implementation Plan: Fix Package Dependencies, Sidebar Navigation, and Test Mocks

This plan addresses 3 frontend issues resolved through `/grill-me` alignment:
1. **Duplicate package dependencies** in `client/package.json` (`radix-ui` vs `@radix-ui/react-*`, unused `@tabler/icons-react`).
2. **Duplicate "All Assets" navigation link** in application sidebar (`_app.tsx`).
3. **Missing GraphQL mocks in AccountsList unit tests** (`AccountsList-actions.test.tsx`).

---

## Approved Design Decisions (from `/grill-me`)

1. **Dependency Consolidation (Strategy A):**
   - Remove `radix-ui` and `@tabler/icons-react` from `client/package.json`.
   - Keep the individual `@radix-ui/react-*` packages.
   - Update all 31 UI primitive wrappers in `client/src/components/ui/` to import directly from `@radix-ui/react-*`.
2. **Sidebar Navigation:**
   - In `client/src/routes/_app.tsx`, rename the link under the "Portfolios" group from `"All Assets"` to `"All Portfolios"` (`url: "/portfolios"`).
3. **AccountsList Unit Test Mocks:**
   - In `client/src/components/__tests__/AccountsList-actions.test.tsx`, add default null co-owner fields (`coOwnerName`, `coOwnerUserId`, `coOwnerUser`) to `mockAccounts`.
   - In `createMocks()`, mock `GET_CO_OWNER_CANDIDATES` so both `CreateAccountDialog` and `EditAccountDialog` mount cleanly without uncaught Apollo errors.
4. **Commit Structure:**
   - A single consolidated commit on branch `pilot` once all 3 items pass typecheck and test verification.

---

## Step-by-Step Implementation

### Step 1: Package Dependencies Cleanup
1. In `client/package.json`:
   - Remove `"@tabler/icons-react": "latest"`.
   - Remove `"radix-ui": "^1.4.3"`.
2. In `client/src/components/ui/*.tsx` (31 files):
   - Replace `from "radix-ui"` with the respective `@radix-ui/react-*` imports:
     - `accordion.tsx`: `import * as AccordionPrimitive from "@radix-ui/react-accordion"`
     - `alert-dialog.tsx`: `import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"`
     - `aspect-ratio.tsx`: `import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio"`
     - `avatar.tsx`: `import * as AvatarPrimitive from "@radix-ui/react-avatar"`
     - `badge.tsx`, `breadcrumb.tsx`, `button.tsx`, `sidebar.tsx`: `import { Slot } from "@radix-ui/react-slot"`
     - `checkbox.tsx`: `import * as CheckboxPrimitive from "@radix-ui/react-checkbox"`
     - `collapsible.tsx`: `import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"`
     - `context-menu.tsx`: `import * as ContextMenuPrimitive from "@radix-ui/react-context-menu"`
     - `dialog.tsx`, `sheet.tsx`: `import * as DialogPrimitive from "@radix-ui/react-dialog"`
     - `dropdown-menu.tsx`: `import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"`
     - `form.tsx`: `import type * as LabelPrimitive from "@radix-ui/react-label"`, `import { Slot } from "@radix-ui/react-slot"`
     - `hover-card.tsx`: `import * as HoverCardPrimitive from "@radix-ui/react-hover-card"`
     - `label.tsx`: `import * as LabelPrimitive from "@radix-ui/react-label"`
     - `menubar.tsx`: `import * as MenubarPrimitive from "@radix-ui/react-menubar"`
     - `navigation-menu.tsx`: `import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu"`
     - `popover.tsx`: `import * as PopoverPrimitive from "@radix-ui/react-popover"`
     - `progress.tsx`: `import * as ProgressPrimitive from "@radix-ui/react-progress"`
     - `radio-group.tsx`: `import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"`
     - `scroll-area.tsx`: `import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"`
     - `select.tsx`: `import * as SelectPrimitive from "@radix-ui/react-select"`
     - `separator.tsx`: `import * as SeparatorPrimitive from "@radix-ui/react-separator"`
     - `sheet.tsx`: `import * as SheetPrimitive from "@radix-ui/react-dialog"`
     - `slider.tsx`: `import * as SliderPrimitive from "@radix-ui/react-slider"`
     - `switch.tsx`: `import * as SwitchPrimitive from "@radix-ui/react-switch"`
     - `tabs.tsx`: `import * as TabsPrimitive from "@radix-ui/react-tabs"`
     - `toggle-group.tsx`: `import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"`
     - `toggle.tsx`: `import * as TogglePrimitive from "@radix-ui/react-toggle"`
     - `tooltip.tsx`: `import * as TooltipPrimitive from "@radix-ui/react-tooltip"`

### Step 2: Sidebar Navigation Duplicate Fix
In `client/src/routes/_app.tsx`:
- Under group `"Portfolios"`, update item `label: "All Assets"` -> `label: "All Portfolios"`.

### Step 3: AccountsList Test Mocks Fix
In `client/src/components/__tests__/AccountsList-actions.test.tsx`:
- Add `coOwnerName: null, coOwnerUserId: null, coOwnerUser: null` to `mockAccounts`.
- Import `GET_CO_OWNER_CANDIDATES` and add mocks in `createMocks()`.

---

## Verification Plan

1. **Client Typecheck:**
   ```bash
   cd client && npm run typecheck
   ```
   Must pass with 0 errors.

2. **AccountsList Unit Tests:**
   ```bash
   cd client && npx vitest run src/components/__tests__/AccountsList-actions.test.tsx
   ```
   Must pass with 5/5 tests and no Apollo missing-field / missing-mock errors.

3. **EditAccountDialog Unit Tests:**
   ```bash
   cd client && npx vitest run src/components/account/__tests__/EditAccountDialog.test.tsx
   ```

4. **Git Commit:**
   Stage all modified files and commit with message:
   `fix(client): clean up radix dependencies, rename duplicate sidebar link, and add co-owner test mocks`
