# CHATBOX AI — PREMIUM CHATGPT-STYLE MOBILE APP DESIGN UPDATE MASTER PROMPT (56 SECTIONS)

## 01. CORE OBJECTIVE
Redesign/update the ChatBox AI mobile interface so that its overall interaction quality, hierarchy, simplicity, spacing discipline and conversation-first behavior are strongly inspired by the modern ChatGPT mobile experience.
Do NOT copy proprietary branding, logo, assets, icons, screenshots, exact measurements, or proprietary visual details.
Extract UX principles → Apply principles → Combine with ChatBox AI branding → Use existing `global.css` values → Create original ChatBox AI interface.

## 02. REFERENCE IMAGE ANALYSIS
- Clean screen composition & strong typography hierarchy
- Spacious layout & rounded surfaces
- Compact controls & minimal navigation
- Neutral foundation & limited accent usage
- Premium spacing & simple iconography
- Highly readable content & mobile-first layout
- Subtle depth & elegant cards where genuinely useful
- Strong bottom interaction area & clear state changes

## 03. NO GLOW POLICY (STRICT)
DO NOT use glowing UI as the primary visual language.
Avoid: neon glow, glowing borders, glowing buttons, glowing cards, bloom/blur, pulsating neon, futuristic neon backgrounds, purple AI glow everywhere.
Communicate quality through: typography, spacing, surface hierarchy, alignment, contrast, subtle borders, controlled shadows, clean icons, interaction feedback.

## 04. GLOBAL.CSS IS LOCKED
The existing ChatBox AI `global.css` is the absolute visual source of truth.
DO NOT replace it or create a new global color system.
DO NOT introduce competing themes or invent random hex colors.
Use existing semantic variables: `background`, `foreground`, `card`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `muted`, `muted-foreground`, `accent`, `accent-foreground`, `destructive`, `border`, `input`, `ring`, `page`, `canvas`, `surface`, `inset`, `hover`, `hover-2`, `ink`, `ink-2`, `ink-3`, `line`, `line-strong`, `radius`, `radius-control`, `typography`, `motion`.

## 05. DESIGN TOKEN PRINCIPLE
`global.css` → Semantic Design Tokens → Mobile Components → Screens → User Flows.
Never create component-specific or screen-specific competing color files.

## 06. VISUAL PERSONALITY
MINIMAL, PREMIUM, CALM, INTELLIGENT, MODERN, CLEAN, NATIVE, CONFIDENT, CONTENT-FIRST.
NOT: loud, neon, gamified, overdecorated, card-heavy, gradient-heavy, glow-heavy.

## 07. CONVERSATION-FIRST ARCHITECTURE
Priority: (1) Conversation, (2) Composer, (3) Navigation, (4) Contextual tools, (5) Secondary content.

## 08. MOBILE APP SHELL
Lightweight, full-screen, immersive, content-focused, native. Avoid desktop navigation and oversized headers.

## 09. TOP BAR
Compact header: `[Menu / Back] [Context / Model] [Profile / More]`. Minimal height, comfortable touch targets, subtle separation.

## 10. SIDEBAR / DRAWER
Lightweight grouped rows for New Chat, Recent Chats, Search, Projects, Settings, Account. Do NOT make every row a card.

## 11. CHAT SCREEN
Header → Conversation → Contextual actions → Floating/contained composer.

## 12. USER MESSAGE DESIGN
Controlled surface, readable width, natural radius, strong spacing. Avoid giant bubbles or heavy colored containers.

## 13. ASSISTANT RESPONSE DESIGN
Readable document-like content surface. Support text, headings, lists, code blocks, tables, citations, images, tool output with clean whitespace separation.

## 14. RESPONSE ACTIONS
Copy, Regenerate, Share, Feedback, Save. Keep secondary; use progressive disclosure.

## 15. STREAMING RESPONSE
Refined progressive rendering without layout jumps, giant spinners, or aggressive flashing.

## 16. THINKING STATE
Subtle status indicator/progress. Communicate activity without dominating the screen.

## 17. COMPOSER
Tactile, compact, intelligent, comfortable 48px interaction surface: `[ + ] [ Write a message... ] [ Voice / Send ]`.

## 18. COMPOSER STATES
Empty, Focused, Text Entered, Multiline, Attachment Added, Voice Active, Generating, Stop Available, Disabled, Error.

## 19. ATTACHMENT UI
Compact bottom sheet/menu for Photo, Camera, File, Document.

## 20. VOICE UI
Subtle motion, simple waveform/indicator, clear controls. NO giant glowing orb or neon pulse.

## 21. MODEL SELECTOR
Compact contextual sheet/menu displaying model name, capability summary, and selected state.

## 22. QUICK PROMPTS
Compact contextual surfaces ("Help me write...", "Analyze file", "Create image").

## 23. HOME / NEW CHAT
Simple layout: Header → Identity/greeting → Introduction → Quick actions → Suggestion prompts → Recent conversations → Composer.

## 24. CARD STRATEGY
NOT EVERYTHING SHOULD BE A CARD. Use cards only when they genuinely improve grouping or action discoverability. Use open layouts for text, conversations, and settings.

## 25. EXPLORE
Clean AI capability discovery with compact rows and small cards.

## 26. CREATE
Supported AI creation tools connected to ChatBox AI visual language.

## 27. SEARCH
Lightweight search input, recent searches, conversation results, empty states.

## 28. SETTINGS
Native grouped list rows (Account, Appearance, Voice, Notifications, Privacy, Data, Subscription, About). Avoid dashboard tiles.

## 29. PROFILE
Minimal profile: avatar, name, email, plan, usage, account actions.

## 30. BOTTOM NAVIGATION
Used only for persistent top-level destinations (Home, Chats, Explore, Create, Profile). Minimal height.

## 31. SHEETS AND MODALS
Contextual native bottom sheets for actions (Model selector, tools, attachments, appearance).

## 32. TYPOGRAPHY
Strong page titles, readable body, compact metadata, clear labels, high-quality code typography.

## 33. SPACING
Disciplined spacing scale across screen edges, headers, messages, and composer.

## 34. RADIUS
Consistent use of `radius` tokens (`sm`, `md`, `lg`, `xl`, `control`) with `borderCurve: 'continuous'`.

## 35. SHADOWS / DEPTH
Flat surface → subtle border (`line`) → subtle elevation where necessary.

## 36. COLOR USAGE
Color communicates action, selection, state, emphasis, brand. Zero rainbow UI or purple gradient blurs.

## 37. LIGHT MODE
Preserve existing light palette, contrast, and surface separation.

## 38. DARK MODE
Deep, quiet, premium, readable dark palette (`#09090b` canvas, `#18181b` surface, `#27272a` line border). No glow.

## 39. ICONOGRAPHY
Single coherent icon family with consistent stroke weight, size hierarchy, and accessible touch targets. No emoji UI icons.

## 40. TOUCH TARGETS
Standardized **48px** minimum height for interactive controls, comfortable thumb reach, clear press feedback (`scale: 0.985`).

## 41. SAFE AREAS
Safe-area aware (`useSafeAreaInsets`) for status bar, notch, dynamic island, bottom inset, keyboard.

## 42. KEYBOARD BEHAVIOR
Composer stays visible, content stays scrollable, input remains usable when typing.

## 43. RESPONSIVE DESIGN
Adapts smoothly across small phones, standard phones, large phones, and tablets.

## 44. ACCESSIBILITY
Supports dynamic text, screen readers, semantic labels, readable contrast, touch target sizes, reduced motion.

## 45. MOTION LANGUAGE
Subtle functional motion (drawer, sheet, composer expansion, send/stop, voice state). No decorative or glowing animation.

## 46. REDUCED MOTION
Collapses transition durations to 0/1ms when reduced motion is preferred.

## 47. AI COMPONENT SYSTEM
- **Foundation**: Button, IconButton, Input, Textarea, Avatar, Badge, Chip, Divider, ListRow, Sheet, Menu
- **AI**: ChatBubble, AssistantResponse, StreamingResponse, ThinkingState, ToolRow, SourceRow, MediaPreview, PromptSuggestion, ModelSelector, Composer, VoiceControl
- **Navigation**: Header, Drawer, SearchBar, BottomNavigation

## 48. DESIGN ANTI-SLOP RULES
Never allow: everything is a card, everything is a gradient, everything glows, everything is purple, emoji icons, desktop navigation on mobile.

## 49. CHATGPT-STYLE TRANSLATION
Translate interaction principles (simplicity, composer strength, response readability, bottom sheets) while retaining ChatBox AI branding.

## 50. CHATBOX AI IDENTITY
Communicate ORIGINAL CHATBOX AI (logo, colors, typography, accents).

## 51. DESIGN UPDATE RULE
Inspect current design → Identify reusable components → Reuse `global.css` tokens → Preserve brand styling → Improve UX & composition → Remove visual noise → Verify mobile behavior.

## 52. GLOBAL.CSS CHANGE POLICY
Never overwrite existing brand colors or create competing themes. Re-use existing tokens.

## 53. DESIGN REVIEW LOOP
Design → Render → Inspect → Compare → Identify problems → Fix → Render again → Final review.

## 54. FINAL SCREEN REVIEW
Verify native feel, premium quality, conversation priority, minimal chrome, zero glow, consistent spacing, 48px touch targets, dark & light mode support.

## 55. FINAL QUALITY BAR
Simple as a modern AI chat app + polished as a premium consumer app + native mobile ergonomics + ChatBox AI visual identity.

## 56. FINAL COMMAND
Keep global.css locked. Keep dark/light mode intact. Keep color and motion purposeful. Keep interface minimal. Keep conversation central. Keep composer excellent.
