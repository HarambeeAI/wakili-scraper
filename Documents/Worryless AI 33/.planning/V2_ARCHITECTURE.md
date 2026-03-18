# Worryless AI v2 — Complete LangGraph Architecture & Agent Role Definitions

## Context

The v1.0 agentic layer is hand-rolled: each "agent" is a different system prompt with no tool execution, no multi-step reasoning, no persistent memory, no closed-loop behavior. Agent UI tabs are static CRUD dashboards. This plan redesigns the **entire agentic layer** from first principles using LangChain/LangGraph, with patterns borrowed from Paperclip AI's open-source orchestration framework.

---

## Patterns Borrowed from Paperclip AI

After analyzing [Paperclip](https://github.com/paperclipai/paperclip) — an open-source orchestration platform for autonomous AI agent teams — we adopt these proven patterns:

### 1. Goal Ancestry & Context Propagation
Every task traces back to the user's business mission. Agents understand WHY they're doing something. Implementation: tasks carry `goal_chain: [mission → objective → project → task]` so the marketer knows "generate this post" connects to "increase brand awareness" which serves "grow revenue 30% this quarter."

### 2. Atomic Task Checkout + Budget Enforcement
Prevents double-work and runaway token spending. Monthly token budgets per agent with 3-tier enforcement:
- **80% utilized:** Warning notification to user
- **100% threshold:** Agent auto-pauses, new tasks blocked
- **Override:** Human approval required to exceed
New table column: `user_agents.monthly_token_budget` + `user_agents.tokens_used_this_month`

### 3. Stateful Sessions Across Heartbeats
Agents resume the same task context across heartbeats instead of restarting from scratch. LangGraph's PostgresSaver checkpointing gives us this natively — each heartbeat run references the previous checkpoint.

### 4. Immutable Audit Log
Every instruction, response, and tool call recorded. New table: `agent_audit_log(user_id, agent_type_id, action, input, output, tool_calls_json, tokens_used, created_at)`. Enables "explain why you did this" and user trust.

### 5. Developer-Provided API Keys
External service API keys (Apify, Resend, Firecrawl, etc.) are provided by the app developer and stored in Supabase Vault. Users never need to provide or configure API keys. The system "just works" — agents have the tools they need out of the box.

### 6. Persistent Agent Browser (Marketer)
The Marketer agent gets a **Playwright persistent browser context** per user, stored server-side. Instead of fragile social media API integrations (which require platform approval, have limited data, and break often), the agent uses a real browser with the user's logged-in sessions:
- User logs into Instagram/LinkedIn/X/TikTok once on the agent's browser (embedded iframe or popup)
- Sessions persist via cookies and localStorage saved to disk
- Agent publishes posts, fetches analytics, monitors competitors — all via the actual browser
- When a session expires, the agent's heartbeat detects it and notifies: "My Instagram session expired. Click here to re-login."
- Stored per-user at: `{BROWSER_DATA_DIR}/users/{user_id}/marketer/` on the LangGraph server

### 7. Chat Persistence Across Sessions
ALL agent conversations persist permanently via LangGraph PostgresSaver:
- Every message, tool call, and generative UI component checkpointed to Supabase PostgreSQL
- Users see full conversation history when they return (any device, any session)
- Thread management: continue old conversations or start new ones
- Generative UI components (charts, tables, approvals) re-render from saved state

### 8. Ticket-Based Work Queue (Alongside Chat)
Not replacing chat, but adding persistent trackable work items. When an agent identifies work to do (from heartbeat or user request), it creates a `ticket` — a persistent work item with status, priority, goal ancestry, and audit trail. Tickets appear in the agent's chat as interactive cards.

---

# PART 1: FIRST-PRINCIPLES ROLE DEFINITIONS

Each role defined by: what a great human would do, the Plan→Execute→Monitor→Analyze→Report→Improve lifecycle, specific tools with exact APIs/services, proactive triggers, persistent memory, generative UI components, and cross-agent data flows.

---

## 1. CHIEF OF STAFF (Root Supervisor)

**First principle:** The CEO's strategic filter. Synthesizes, prioritizes, and connects dots across departments. A mediocre CoS just passes messages through. A great one identifies when the marketer's engagement drop and the sales rep's fewer inbound leads are the SAME problem.

### Lifecycle
| Phase | What the CoS Does |
|-------|-------------------|
| **Plan** | Learn user priorities from onboarding. Set briefing cadence. Define escalation thresholds per severity |
| **Execute** | Compile morning briefing from all agent heartbeats. Route user queries via LangGraph `Command`. Orchestrate multi-agent tasks using `Send()` for parallel dispatch |
| **Monitor** | Track delegated task completion. Watch for recurring flags. Notice when user ignores certain agents (signal to adjust) |
| **Analyze** | Correlate cross-agent findings. Calculate meta-metrics: which agents deliver value? What business areas lack coverage? |
| **Report** | Morning briefing (daily), weekly performance summary, monthly strategic review |
| **Improve** | Learn which briefing items user acts on. Adjust severity. Refine routing based on correction signals |

### Tools (Specific)
| Tool | API/Service | Details |
|------|-------------|---------|
| `compile_morning_briefing` | LangGraph Store + Supabase query | Aggregates `agent_heartbeat_log` (severity != 'ok'), `tasks` (overdue), `calendar_events` (today), organizes by urgency |
| `delegate_to_agent` | LangGraph `Command(goto=agent_name)` | Routes with full goal ancestry context |
| `fan_out_to_agents` | LangGraph `Send([agent1, agent2, ...])` | Parallel dispatch for multi-agent tasks |
| `query_cross_agent_memory` | LangGraph `Store.search((user_id, "agent_memory", "*"))` | Read any agent's accumulated learnings |
| `correlate_findings` | Claude API (structured output) | Takes concurrent heartbeat findings, produces correlation analysis |
| `track_action_items` | Supabase `tasks` query | Follow up on items from previous briefings |
| `assess_agent_health` | Supabase query on `user_agents` + `agent_heartbeat_log` | Heartbeat status, error rates, response times |

### Proactive Triggers
- **Daily 8am (user TZ):** Morning briefing — prioritized, with recommendations
- **On urgent heartbeat from any agent:** Immediate surface with cross-reference context
- **When 3+ agents flag related issues:** Cross-correlate into single strategic insight
- **When user hasn't engaged 48h+:** Gentle nudge with highest-priority pending item
- **Weekly Monday:** Cross-team summary with trend arrows
- **Monthly 1st:** Meta-analysis — which agents provide value, suggest team adjustments

### Memory (LangGraph Store namespace: `(user_id, "agent_memory", "chief_of_staff")`)
- `user_action_patterns`: which briefing items user acts on vs. ignores
- `routing_corrections`: when user redirects to different agent than CoS chose
- `priority_shifts`: how user priorities evolve over time
- `cross_agent_correlations`: patterns like "marketing drops → sales slows in 2 weeks"
- `previous_briefings`: avoid repeating info, track follow-ups

### Generative UI
- **Morning Briefing Card:** Sections: "🔴 Urgent" (0-2 items), "⚡ Today's Priorities" (3-5 items with action buttons), "📋 FYI" (digest items). Each item shows agent avatar, summary, action ("Review Invoice", "Approve Post", "View Lead")
- **Decision Queue:** Items requiring user decision. Each: agent's recommendation + Approve/Reject/Discuss buttons. Clearing shows "All caught up ✓"
- **Cross-Agent Alert:** Two+ findings linked with synthesis explaining connection
- **Weekly Dashboard:** Horizontal bar chart (tasks/agent), top 3 accomplishments, open items, trend arrows for revenue/leads/content
- **Agent Health Grid:** Active agents with status dot (green/amber/red), last heartbeat, task counts

### Cross-Agent Dependencies
- FROM all: Heartbeat findings, task completions, memory updates
- TO all: Delegated tasks, priority overrides, context injections
- Bidirectional with Accountant (financials → strategy), Data Analyst (metrics → summaries), COO (strategy ↔ operations)

---

## 2. ACCOUNTANT (Fractional CFO + Bookkeeper)

**First principle:** Manages ALL money flow. Cash management is 50% of the job — knowing exactly where money is, where it's going, and when problems will hit BEFORE they hit. Not just recording transactions — forecasting, alerting, and optimizing.

### Lifecycle
| Phase | What |
|-------|------|
| **Plan** | Set up chart of accounts, budget targets by category, tax calendar for jurisdiction, invoice payment terms |
| **Execute** | Record transactions, create/send invoices, categorize expenses, parse bank statements and receipts |
| **Monitor** | Daily cashflow tracking. Overdue invoice alerts. Burn rate monitoring. Unusual expense flagging. Budget vs. actual tracking |
| **Analyze** | P&L generation, cashflow projections (30/60/90 day), expense trend analysis, vendor payment patterns, tax liability estimates, margin analysis |
| **Report** | Daily cashflow snapshot, weekly expense summary, monthly P&L, quarterly tax estimate, annual financial review |
| **Improve** | Learn spending patterns (seasonal, cyclical). Refine forecasts based on accuracy. Identify cost-saving opportunities. Suggest pricing based on margin data |

### Tools (Specific)
| Tool | API/Service | Details |
|------|-------------|---------|
| `create_invoice` | Supabase `invoices` INSERT | Full invoice creation with line items, tax calculation, payment terms |
| `generate_invoice_pdf` | Nano Banana 2 (Gemini 3.1 Flash Image) | Branded invoice image with business logo, colors, professional layout |
| `chase_overdue_invoice` | Resend API + `interrupt()` | Draft reminder email, show preview, require approval to send |
| `record_transaction` | Supabase `transactions` INSERT | Income/expense with auto-categorization using LLM |
| `parse_bank_statement` | LLM document parsing (Claude/Gemini) | Extract transactions from uploaded CSV/PDF bank statements |
| `parse_receipt` | Gemini multimodal (image → structured data) | Photo of receipt → {vendor, amount, date, category, tax} |
| `calculate_cashflow_projection` | Custom calculation tool | Projects 30/60/90 days based on: current balance + recurring income + recurring expenses + pending invoices + seasonal patterns from memory |
| `generate_pl_report` | Supabase aggregation + LLM formatting | Revenue/COGS/gross profit/operating expenses/net income with MoM comparison |
| `track_budget_vs_actual` | Supabase query + comparison | Per-category budget targets vs. actual spending |
| `estimate_tax` | Calculation tool + jurisdiction rules | Based on income, location, expense deductions. Uses tax brackets from memory |
| `detect_anomalous_transaction` | Statistical analysis + LLM | Flags transactions >2x average in category, unknown vendors, unusual amounts |
| `forecast_runway` | Time-series projection | Months of cash remaining based on burn rate and revenue trend |
| `query_financial_data` | Supabase `transactions` + `invoices` + `datasheet_rows` | Flexible querying for any financial analysis |

### Proactive Triggers
- **Daily 9am:** Cashflow snapshot — balance, expected in/out today, anomalies
- **When invoice overdue:** Alert with invoice details + draft reminder email
- **When expense exceeds category budget by 20%:** Immediate flag
- **When unusual transaction detected:** Alert ("This vendor charge is 3x usual")
- **Weekly Friday:** Expense summary — categorized, compared to budget and last week
- **Monthly 1st:** P&L report, 3-month cashflow forecast, budget vs. actual review
- **Quarterly:** Tax liability estimate, financial health scorecard
- **When cash drops below 2 months expenses:** URGENT runway alert
- **When recurring revenue pattern breaks:** Alert ("Expected $X from Client Y — not received")

### Memory
- `recurring_patterns`: Rent, subscriptions, regular income with expected amounts and dates
- `vendor_profiles`: Typical payment amounts, payment terms, reliability
- `seasonal_patterns`: Revenue/expense cyclicality (holiday spikes, Q1 dips)
- `categorization_rules`: Learned from user corrections ("Uber charges → Travel, not Transport")
- `tax_rules`: Jurisdiction-specific deductions, brackets, deadlines
- `forecast_accuracy`: Historical forecast vs. actual (improves future projections)
- `budget_targets`: Per-category targets with variance history

### Generative UI
- **Cashflow Overview Card:** Current balance (large number), 30-day projection line chart with income bars (green) and expense bars (red), net cashflow trend arrow
- **Invoice Tracker Table:** Sortable: vendor, amount, due date, status badge (paid✅/pending⏳/overdue🔴), days outstanding, actions (Mark Paid, Send Reminder, View PDF)
- **P&L Statement:** Structured financial statement with Revenue/COGS/Gross Profit/OpEx/Net Income sections, MoM comparison columns with green/red delta indicators
- **Budget vs. Actual Chart:** Side-by-side horizontal bars per category, red highlighting for over-budget
- **Expense Pie Chart:** Interactive with drill-down by category → vendor
- **Overdue Alert Card:** Urgent styling, invoice details, "Send Reminder" action
- **Runway Gauge:** Months remaining with threshold markers (danger < 2mo, caution < 4mo)
- **Transaction Feed:** Recent transactions with auto-categorization, edit category inline

### Cross-Agent Dependencies
- FROM Sales Rep: Expected revenue from pipeline (for cashflow projection)
- TO Chief of Staff: Financial health for briefings. Urgent alerts
- FROM Procurement: Purchase orders and vendor invoices
- TO Legal: Contract payment obligations and financial exposure
- FROM Personal Assistant: Receipt images, expense documentation from emails
- TO Data Analyst: Raw financial data for deeper cross-functional analysis

---

## 3. MARKETER (Marketing Director + Content Manager)

**First principle:** Content creation is 30% of the job. The other 70% is figuring out WHAT to create based on data, monitoring what's working, and continuously optimizing. A mediocre marketer posts and never looks back. A great one creates a closed feedback loop: post → measure → learn → adjust → repeat.

### Lifecycle
| Phase | What |
|-------|------|
| **Plan** | Define 3-5 content pillars aligned to business goals. Create weekly/monthly content calendar. Set KPI targets (engagement rate, follower growth, CTR). Research competitor strategies. Identify audience segments |
| **Execute** | Generate social posts (Instagram, X/Twitter, LinkedIn, TikTok). Create brand-consistent images with product photos and logo. Schedule for optimal times. Write long-form content (blog, newsletter) |
| **Monitor** | Track post engagement (likes, comments, shares, saves, reach, impressions). Monitor follower growth/decline. Watch brand mentions. Track competitor activity. Check CTR on links. Monitor hashtag performance |
| **Analyze** | Weekly content performance (top/bottom with WHY analysis). Monthly engagement trends. Audience growth. Content pillar effectiveness. Best posting times. Competitor benchmarking. A/B test results |
| **Report** | Weekly engagement summary to user + CoS. Monthly marketing review. Campaign ROI analysis. Content audit (library gaps) |
| **Improve** | Refine pillars based on performance. Adjust posting schedule from timing analysis. Evolve brand voice from resonance data. Propose campaigns from competitor gaps and seasonal opportunities |

### Tools (Specific)
| Tool | API/Service | Details |
|------|-------------|---------|
| `generate_social_post` | Claude API / Gemini | Platform-specific: IG (hook→value→CTA, 150-300 words, 5-7 hashtags), X (≤280 chars, 1-3 hashtags), LinkedIn (story-driven professional), TikTok (trend-aligned, casual) |
| `generate_brand_image` | **Nano Banana 2** (Gemini 3.1 Flash Image) via Lovable AI Gateway | Brand-consistent images using company colors, product photos (uploaded during onboarding), and logo. Subject consistency for up to 5 characters. Aspect ratios per platform (1:1 IG, 16:9 X, 4:5 IG Stories) |
| `edit_image` | Nano Banana 2 text-based editing | Add text overlays, adjust colors to brand palette, composite product onto lifestyle backgrounds |
| `schedule_post` | Supabase `social_posts` INSERT with `scheduled_at` | Platform, content, image_url, hashtags, scheduled time |
| `publish_post` | **Playwright persistent browser** (agent's own browser with saved sessions) + `interrupt()` | Posts via the actual logged-in browser, not API. Agent prompts user to login once on the agent's browser (persistent cookies/sessions). If session expires, agent notifies user to re-login. Requires user approval before posting |
| `fetch_post_analytics` | **Playwright persistent browser** (scrapes platform analytics dashboards) | Pulls engagement via the logged-in browser: impressions, reach, likes, comments, shares, saves, profile visits, link clicks. More reliable than APIs which have strict rate limits and limited data |
| `analyze_post_performance` | Statistical analysis + LLM | Compare each post's metrics against running averages. Identify top/bottom performers. Analyze WHY (topic, format, time, hashtags, visual style) |
| `create_content_calendar` | Claude API (structured output) | Weekly/monthly plan mapping content pillars to dates, platforms, formats. Returns calendar grid data |
| `monitor_brand_mentions` | Google Alerts API / Brand24 API / web search | Periodic scan for business name, product names, founder name across social + web |
| `analyze_competitor` | **Playwright persistent browser** + LLM | Browse competitor social profiles via the agent's browser, scrape recent posts, summarize strategy, compare engagement rates |
| `search_trending_topics` | Google Trends API / X Trending / web search | Industry-specific trend discovery |
| `ab_test_content` | LLM variant generation + tracking | Generate 2 post variants with one variable changed (headline, image, CTA). Track which performs better |
| `manage_content_library` | Supabase `agent_assets` + `social_posts` query | Search past content, reuse high performers, identify content gaps |
| `generate_blog_post` | Claude API (long-form) | SEO-optimized blog content with keyword targeting |
| `create_newsletter` | Claude API + template | Email newsletter draft for Mailchimp/ConvertKit |

### Proactive Triggers
- **Daily (optimal posting time):** Check today's scheduled post. If queue empty → generate suggestion with image
- **Every 48 hours:** Fetch analytics on posts from last 48h. Flag any ≥2x or ≤0.5x average engagement
- **When post goes viral (3x avg):** IMMEDIATE alert + suggestions to capitalize (follow-up, engagement responses, content series)
- **When content queue < 3 days:** Alert + proactively generate 3 draft posts with images
- **Weekly Monday:** Content performance report. Top/bottom performers with analysis. Next week's suggested calendar
- **Monthly 1st:** Full marketing review. Pillar effectiveness scores. Next month's calendar draft. Competitor activity summary
- **On trending topic in industry:** Suggest timely content tying trend to business
- **When competitor changes strategy:** Alert with analysis

### Memory
- `post_performance_history`: Which topics, formats, times, platforms, hashtags, visual styles perform best
- `audience_patterns`: When followers engage, what tone resonates, demographic insights
- `brand_voice_rules`: Learned from user corrections ("too formal" → adjust, "we never use emojis")
- `content_pillar_scores`: Effectiveness ratings per pillar, updated monthly
- `competitor_patterns`: What competitors post, what works for them, gaps to exploit
- `seasonal_calendar`: Holidays, industry events, annual cycles affecting content
- `hashtag_performance`: Which drive reach, which are dead weight
- `image_style_preferences`: User feedback on generated visuals

### Generative UI
- **Content Calendar Grid:** Weekly/monthly view, posts by platform (color-coded: IG=pink, X=blue, LinkedIn=navy, TikTok=black). Each cell: platform icon, 50-char snippet, status badge (draft/scheduled/published/missed), engagement score if published. Click to expand/edit
- **Post Performance Table:** Interactive sortable table: date, platform, content preview thumbnail, likes, comments, shares, reach, engagement rate %, performance badge (🔥 above avg, ⚠️ below). Export to CSV
- **Engagement Trend Chart:** Line chart: engagement rate over 30/60/90 days with target benchmark line. Annotations for strategy changes. Toggle by platform
- **Top/Bottom Performers:** Side-by-side cards. Best post: image preview, metrics, "Why it worked" analysis. Worst post: same + "What to change" suggestion
- **Content Queue Status:** Card: "X posts scheduled for next 7 days" with daily breakdown progress bar. Amber when <3 days, red when <1 day. "Generate Content" CTA button
- **Competitor Snapshot Card:** Recent competitor activity, their top post this week, engagement comparison chart
- **Content Generation Dialog:** Platform selector → topic input → tone selector → pillar selector → "Generate" → split view: post text left, generated image right, with Edit/Regenerate/Approve & Schedule actions
- **Brand Asset Gallery:** Grid of generated images with tags, usage count, performance when used, "Reuse" action
- **A/B Test Card:** Two post variants side-by-side with live engagement comparison

### Cross-Agent Dependencies
- FROM Sales Rep: Customer pain points → content topics. Testimonials. Warm leads from social DMs
- FROM Customer Support: Feedback themes → educational content. FAQ → content opportunities
- FROM Data Analyst: Cross-channel attribution (social → website traffic → conversions)
- TO Chief of Staff: Weekly engagement summary
- FROM PR: Brand messaging guidelines. Press coverage to amplify
- TO Sales Rep: High-performing content for outreach templates

---

## 4. SALES REP (Business Development Manager)

**First principle:** Owns the FULL sales cycle, not just lead generation. The closed loop: prospect → research → outreach → follow-up → qualify → propose → close → manage relationship. A great sales rep never lets a warm lead go cold.

### Tools (Specific)
| Tool | API/Service | Details |
|------|-------------|---------|
| `generate_leads` | **Apify Leads Finder API** (developer-provided key, no user config) | Find prospects by: keywords, industry, location, job title, company size. Up to 100 per batch. Returns: name, email, phone, LinkedIn, company details. API key stored in Supabase Vault, accessed via service role |
| `enrich_lead_data` | **Clearbit API** / **Apollo.io API** / web search | Add missing data: company revenue, employee count, technology stack, recent news |
| `research_prospect` | **Playwright browser** + **Firecrawl API** + LLM | Deep-dive: scrape company website, LinkedIn profile, recent news, social presence. Synthesize into research brief |
| `compose_outreach` | Claude API with business context injection | Personalized email using: prospect research, business value props, previous interaction history from memory. Under 150 words. JSON: {subject, body} |
| `send_outreach` | **Resend API** + `interrupt()` | Preview email, require approval, send, track |
| `track_email_engagement` | **Resend webhooks** (open/click events) | Monitor opens, clicks, replies on sent emails. Store in `outreach_emails` table |
| `update_deal_status` | Supabase `leads` UPDATE | Move through: prospecting → contacted → responded → qualified → proposal → closed_won / closed_lost. With notes |
| `schedule_follow_up` | Supabase `tasks` INSERT with due date | Based on optimal timing from memory (e.g., "follow up 3 days after first email, 5 days after second") |
| `create_proposal` | Claude API + structured output | Sales proposal with: executive summary, solution fit, pricing, timeline, terms. Returns PDF-ready data |
| `analyze_pipeline` | Supabase aggregation | Pipeline velocity by stage, conversion rates, average deal cycle, revenue by stage |
| `forecast_revenue` | Statistical projection + LLM | Based on pipeline × historical conversion rates × average deal size |
| `log_meeting_notes` | Supabase INSERT + Store update | Record outcome, action items, sentiment. Updates agent memory for this prospect |
| `detect_stale_deals` | Time analysis | Flag deals in a stage longer than average (from memory). Suggest re-engagement |
| `analyze_win_loss` | LLM analysis of closed deals | Patterns: why deals close (fast response, right timing) vs. die (slow follow-up, wrong ICP) |

### Proactive Triggers
- **Daily 9am:** Pipeline status — new leads, follow-ups due today, overdue follow-ups with drafts
- **When follow-up is due:** Reminder + suggested action + email draft
- **When deal stale (>avg stage duration):** Alert with re-engagement suggestions
- **When prospect opens email 3+ times:** HOT LEAD alert with suggested next action
- **Weekly Monday:** Pipeline progression — deals advanced/stalled/lost. Win/loss summary
- **Monthly 1st:** Conversion funnel analysis. Revenue forecast vs. target. Outreach effectiveness report
- **When pipeline value < target:** Suggest prospecting activities to fill gap
- **After losing deal:** Prompt for loss reason → feed into win/loss analysis memory

### Generative UI
- **Pipeline Kanban Board:** Columns per stage (Prospecting→Contacted→Qualified→Proposal→Closed). Deal cards: company, value, age, health dot, contact name. Drag to move stage
- **Lead Profile Card:** Company logo, name, title, email, phone, LinkedIn link. Research brief. Interaction timeline. Score. Actions: Email, Log Call, Move Stage, Add Note
- **Outreach Preview:** Email compose: subject, body, personalization highlighted in blue. Send/Edit/Schedule buttons. Previous emails in thread below
- **Pipeline Metrics Dashboard:** Conversion funnel (visual), avg cycle time per stage, win rate gauge, pipeline value by stage bar chart
- **Follow-Up Queue:** Today's follow-ups ranked by priority. Context snippet + suggested action
- **Revenue Forecast Chart:** Line: projected vs. target for month/quarter. Confidence bands
- **Win/Loss Analysis Card:** Recent wins with "why" tags, losses with "why" tags, pattern summary
- **Email Engagement Timeline:** Per-prospect: opens (eye icon), clicks (cursor icon), replies (bubble icon) on timeline

---

## 5. PERSONAL ASSISTANT (Executive Assistant + Google Workspace)

**First principle:** Manages the CEO's time, communication, and information flow. Not just inbox — triages, prioritizes, drafts responses, manages conflicts, preps for meetings, and protects focus time.

### Tools (Specific)
| Tool | API/Service | Details |
|------|-------------|---------|
| `read_emails` | **Google Gmail API** (messages.list, messages.get) | Fetch, search, filter by label/sender/date/subject |
| `triage_inbox` | Claude API (structured output) | Categorize: urgent/high/normal/low. Topics: sales, finance, personal, newsletter, spam. Suggested action: respond/delegate/archive |
| `draft_email_response` | Claude API with user communication style from memory | Matches user's tone, length preference, sign-off style |
| `send_email` | **Gmail API** (messages.send) + `interrupt()` | Preview, approve, send |
| `list_calendar_events` | **Google Calendar API** (events.list) | Today/week/month view with attendees, location, agenda |
| `create_calendar_event` | **Google Calendar API** (events.insert) + `interrupt()` | With availability check, attendee invites |
| `reschedule_event` | Google Calendar API + availability analysis | Find alternative slots, propose to attendees |
| `prepare_meeting_brief` | Cross-data synthesis | Attendee info (from email history + contacts), past interactions, agenda, relevant documents from Drive |
| `search_drive` | **Google Drive API** (files.list, files.get) | Find documents by name, content, type, recency |
| `create_task` / `update_task` | Supabase `tasks` CRUD | User's task list with priority, due date, status |
| `set_reminder` | Supabase + notification scheduling | Time-based delivery via notification system |
| `detect_calendar_conflicts` | Calendar API analysis | Find overlapping events, suggest resolution |
| `analyze_time_allocation` | Calendar data aggregation | Meeting hours vs. focus hours, busiest days, meeting frequency by contact |
| `summarize_email_thread` | Claude API | Condense long threads to key points, decisions, and action items |

### Proactive Triggers
- **Daily 7:30am:** Inbox triage summary + today's calendar with meeting prep
- **Before each meeting (30 min):** Meeting brief card with attendee info, past interactions, agenda
- **When urgent email arrives:** Immediate alert with context + draft response
- **When response overdue (>24h on flagged email):** Reminder + draft
- **When calendar double-booked:** Alert with resolution options
- **When task deadline <24h:** Reminder with current status
- **Weekly Friday:** Time allocation report — meeting vs. focus hours
- **Monthly:** Communication patterns — top contacts, response time trends

### Generative UI
- **Inbox Summary Card:** Unread count, urgent count, awaiting response count. Top 5 priority emails: sender avatar, subject, urgency badge, "View/Reply/Archive" actions
- **Calendar Timeline:** Visual timeline of today: meeting blocks (blue), focus blocks (green), travel (gray). Click meeting → expand brief
- **Meeting Brief Card:** Attendee photos+names+roles, agenda bullet points, past interaction notes, relevant docs from Drive, "Join Meeting" link
- **Email Draft Preview:** Original email left, draft response right. Inline editing. "Send/Schedule Send/Discard"
- **Time Allocation Chart:** Donut chart: meetings/email/focus/other. Week comparison bars
- **Task List:** Ranked by deadline proximity. Effort dots (1-3). "Start/Postpone/Delegate" actions

---

## 6-13. REMAINING AGENTS (Key Specifics)

### 6. Customer Support
**Key tools:** `create_ticket` (new `support_tickets` table), `search_knowledge_base` (RAG via pgvector on `business_artifacts`), `calculate_customer_health` (engagement + ticket frequency + sentiment scoring), `detect_churn_risk` (pattern matching on historical churn signals)
**Key UI:** Customer health dashboard (red/amber/green scores), ticket queue with SLA timers, churn risk alerts with recommended actions
**Key proactive:** Daily unresolved ticket check. 3+ tickets/week from same customer → at-risk flag. Post-resolution 7-day follow-up

### 7. Legal & Compliance
**Key tools:** `review_contract` (Claude API document analysis → risk flags + key terms extraction), `track_contract_calendar` (new `contracts` table), `monitor_regulations` (web search for jurisdiction + industry changes), `draft_contract` (templates: NDA, MSA, SOW, employment)
**Key UI:** Contract calendar timeline (approaching expirations in red), contract review card (key terms + risk flags + recommendations), compliance checklist
**Key proactive:** 30 days before contract renewal. On regulatory change detection. Quarterly compliance audit

### 8. HR
**Key tools:** `draft_job_posting` (Claude API), `screen_resume` (document parsing + scoring), `track_candidates` (new `candidates` table with pipeline), `create_onboarding_plan`, `conduct_performance_review` (structured forms)
**Key UI:** Hiring pipeline kanban, candidate comparison table, onboarding checklist, performance review forms
**Key proactive:** Position open >30 days → outreach strategy. 30/60/90 day new hire check-ins. Pre-review material prep

### 9. PR & Communications
**Key tools:** `draft_press_release` (Claude API), `monitor_media_mentions` (Google Alerts API / web search), `track_press_coverage` (new `press_coverage` table), `analyze_brand_sentiment` (social + media sentiment aggregation)
**Key UI:** Media coverage timeline, brand sentiment gauge, press kit preview
**Key proactive:** Daily brand mention scan. On negative coverage → immediate crisis response draft. Monthly coverage report

### 10. Procurement
**Key tools:** `search_suppliers` (web search), `compare_quotes` (structured comparison matrix), `create_purchase_order` (`interrupt()` for approval), `evaluate_vendor` (scoring from history)
**Key UI:** Vendor comparison table, PO preview, spend-by-vendor chart
**Key proactive:** Before contract renewal → evaluate alternatives. When price increase detected → market alternatives

### 11. Data Analyst
**Key tools:** `query_cross_functional_data` (access ALL business tables: invoices, leads, posts, transactions, tickets, etc.), `run_statistical_analysis` (correlations, regressions), `detect_anomalies` (Z-score outlier detection), `generate_chart_data` (Recharts-ready JSON), `calculate_kpis` (cross-functional aggregation)
**Key UI:** Interactive charts (line, bar, pie, scatter with tooltips), KPI cards with sparklines, anomaly highlight cards, data table with sort/filter/export
**Key proactive:** Daily anomaly scan across all data. Weekly cross-functional trends. Monthly KPI report with period comparison

### 12. Operations
**Key tools:** `create_project` (with milestones, new `projects` table), `track_milestones`, `identify_bottlenecks` (cross-process delay analysis), `create_sop` (Claude API), `optimize_process` (workflow analysis + recommendations)
**Key UI:** Project timeline (Gantt-style), milestone tracker, bottleneck visualization, SOP document preview
**Key proactive:** Weekly project status. Overdue milestone alerts. Monthly efficiency report

### 13. COO (Level-2 Supervisor)
**Routes to:** Customer Support, Legal, HR, PR, Procurement, Data Analyst, Operations
**Key tools:** `delegate_to_ops_agent` (LangGraph `Command`), `aggregate_kpis` (cross-department rollup), `set_objectives` (OKR tracking, new `objectives` table), `assess_risk` (cross-functional risk matrix)
**Key UI:** KPI dashboard with gauge charts, OKR progress bars, risk matrix heatmap, department health scorecard
**Key proactive:** Monthly KPI review. Quarterly strategic assessment. When KPI drops below target → root cause analysis

---

# PART 2: ARCHITECTURE

## Multi-Agent Topology
Hierarchical supervisor using LangGraph StateGraph:
- **Chief of Staff** (root) routes to: Accountant, Marketer, Sales Rep, Personal Assistant, COO
- **COO** (level-2) routes to: Customer Support, Legal, HR, PR, Procurement, Data Analyst, Operations
- Routing via `Command` objects. Parallel dispatch via `Send()`. HITL via `interrupt()`

## Proactive System (Cadence Engine)
pg_cron → pgmq → cadence-runner → **full LangGraph graph execution** (not just severity check)
- Each agent has role-specific heartbeat checklists (not generic "is everything ok?")
- Marketer heartbeat: "Fetch analytics on posts from last 48h. Check content queue depth. Search trending topics"
- Sales heartbeat: "Check for stale deals. List overdue follow-ups. Monitor email engagement on recent outreach"
- Cadence config per agent: daily, weekly, monthly, quarterly + event triggers

## Per-Agent Memory (LangGraph Store)
Every agent gets namespaced persistent memory:
```
(user_id, "agent_memory", "marketer") → {post_performance, audience_patterns, brand_voice, competitor_data, ...}
(user_id, "agent_memory", "sales_rep") → {icp_definition, outreach_performance, win_loss_patterns, ...}
```
Memory writes happen: after tool execution, after user feedback, during heartbeat analysis.
Memory reads happen: before every action (agent gets smarter over time).

## Backend
- **LangGraph Server** (Node.js/TypeScript) on **Railway**
- **PostgresSaver** → Supabase PostgreSQL (`langgraph` schema)
- **Supabase Edge Functions** remain as JWT-validating proxy
- **Image generation:** Nano Banana 2 (Gemini 3.1 Flash Image) via Lovable AI Gateway

## Frontend
- Chat-first `AgentChatView` replaces all static dashboards
- `GenerativeUIRenderer` maps structured components to React components (Recharts, @tanstack/react-table, dynamic forms)
- SSE streaming with text deltas + UI component directives
- `useAgentChat(agentTypeId)` hook manages threads, streaming, approvals

## Onboarding Redesign
- **Step 1 (NEW):** Business stage: Starting / Running / Scaling → determines agent recommendations and initial interactions
- **Agent team based on stage:** New business → fewer agents, focus on market. Existing → full team. Scaling → emphasis on COO, Operations, HR
- **Integration setup:** Google OAuth for PA (Gmail/Calendar/Drive). For Marketer: "Open your agent's browser and log into your social accounts" (persistent browser, no API keys needed from user)
- **First real briefing:** Chief of Staff graph runs with all onboarding context → real actionable briefing as first chat message

## Migration (10 Phases, ~8-12 Weeks)
M1: Infrastructure (LangGraph server + PostgresSaver + proxy) → M2: Chief of Staff graph → M3: Accountant → M4: Marketer + Sales → M5: PA + Google Workspace → M6: COO + operational agents → M7: Cadence system → M8: Chat-first frontend → M9: Memory + RAG → M10: Migration completion

No data migration needed — agents read/write existing tables via tools. Feature flags for gradual rollout.

---

## Next Steps After Approval
1. `/gsd:new-milestone` to create v2.0 milestone
2. Break into phases with specific requirements
3. Begin with Phase M1 (infrastructure)

Sources:
- [Paperclip AI](https://github.com/paperclipai/paperclip)
- [Nano Banana 2](https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/)
- [Paperclip Architecture Overview](https://www.vibesparking.com/en/blog/ai/agent-orchestration/2026-03-05-paperclip-open-source-orchestration-zero-human-companies/)
