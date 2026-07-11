Based on Henry's discussions so far, the **LocalMall Admin page is not simply a CRUD page for creating a LocalMall.**

It is effectively the **control centre for a local digital economy.**

Since Henry is currently focused on the UK and postcode-first onboarding, the LocalMall Admin should be designed around **postcode territories, businesses, local engagement and ecosystem participation**, not countries and states.

# LOCALMALL ADMIN MODULE

Located in:

```text
MCOM Central
└── Local Ecosystem
    └── LocalMalls
```

---

# 1. LOCALMALL LIST PAGE

This is the main management page.

## Table Columns

| Column              | Description                |
| ------------------- | -------------------------- |
| LocalMall Name      | Example: Peckham LocalMall |
| Postcode Coverage   | SE15, SE5                  |
| Borough             | Southwark                  |
| Primary High Street | Rye Lane                   |
| Businesses          | Number of businesses       |
| Customers           | Number of customers        |
| Campaigns           | Active campaigns           |
| Events              | Upcoming events            |
| Status              | Active, Draft, Disabled    |
| Created Date        | Date created               |
| Actions             | View, Edit, Analytics      |

---

## Filters

* Borough
* Postcode
* High Street
* Status
* Assigned Consultant
* Assigned Account Manager

---

## Actions

* Create LocalMall
* Export Data
* Assign Manager
* Merge LocalMall
* Archive LocalMall

---

# 2. CREATE / EDIT LOCALMALL PAGE

---

# SECTION A — BASIC INFORMATION

Fields:

```text
LocalMall Name
Short Description
Long Description
Slug
Status
```

Examples:

```text
Peckham LocalMall
```

Status:

* Draft
* Active
* Hidden
* Archived

---

# SECTION B — BRANDING

Fields:

```text
Logo
Cover Banner
Mobile Banner
Primary Colour
Secondary Colour
Welcome Message
Tagline
```

Example:

```text
Welcome to Peckham LocalMall
Supporting Local Businesses Together
```

---

# SECTION C — LOCATION CONFIGURATION

This is the most important section.

Fields:

```text
Primary Postcode
Additional Postcodes Covered
Primary High Street
Additional High Streets
Borough
Radius Coverage (optional)
```

Example:

```text
Primary Postcode:
SE15

Additional:
SE5
SE22

Primary High Street:
Rye Lane

Additional:
Peckham Road
Bellenden Road

Borough:
Southwark
```

---

# SECTION D — BUSINESS ELIGIBILITY RULES

Admin decides:

```text
Allow businesses outside postcode?
Allow virtual businesses?
Allow home businesses?
Require verification?
Require audit completion?
Require membership approval?
```

---

# SECTION E — TEAM ASSIGNMENT

Connected to 247GBS Affiliates.

Fields:

```text
Lead Consultant
Assigned Account Managers
Assigned Agents
Support Team
```

Example:

```text
Consultant:
John Doe

Account Managers:
Sarah
James

Agents:
Michael
Paul
```

---

# SECTION F — FEATURE CONFIGURATION

Enable or disable ecosystem modules.

Toggle list:

```text
Enable Audit
Enable Rewards
Enable Loyalty
Enable QLinks
Enable Spin
Enable Events
Enable Campaigns
Enable Push Notifications
Enable Marketplace
```

This allows some LocalMalls to launch gradually.

---

# SECTION G — CUSTOMER SETTINGS

Fields:

```text
Allow Guest Browsing
Require Registration For Rewards
Require Registration For Spin
Enable Auto Location Detection
Allow Manual LocalMall Switching
```

---

# SECTION H — BUSINESS SETTINGS

Fields:

```text
Auto Approve Businesses
Manual Approval Required
Require Document Verification
Require Google Business Match
Require Audit Completion
Default Membership Package
```

---

# SECTION I — HOMEPAGE CONFIGURATION

This controls what customers see.

Sections:

```text
Featured Businesses
Featured Categories
Featured Campaigns
Featured Events
Featured Rewards
Featured Spin Campaigns
Featured High Streets
```

Admin can reorder by drag-and-drop.

---

# SECTION J — CATEGORY PRIORITIES

Example:

```text
Food & Drink
Retail
Beauty
Health
Professional Services
Trades
Entertainment
```

Admin can choose:

* Show first
* Hide
* Highlight

---

# SECTION K — CAMPAIGN SETTINGS

Controls:

```text
Allow Borough Campaigns
Allow High Street Campaigns
Allow Joint Campaigns
Allow Seasonal Campaigns
Campaign Approval Required
```

---

# SECTION L — EVENT SETTINGS

Controls:

```text
Enable Events
Require Event Approval
Maximum Events Per Business
Allow Community Events
Allow Business Events
```

---

# SECTION M — REWARD SETTINGS

Controls:

```text
Enable Rewards
Enable Loyalty
Enable Bonus Campaigns
Enable Double Point Days
Enable Seasonal Rewards
```

---

# SECTION N — SPIN SETTINGS

Controls:

```text
Enable Spin
Allow Business Sponsored Spins
Allow Borough Spins
Allow Seasonal Spins
Maximum Spins Per Customer
```

---

# SECTION O — QLINK SETTINGS

Controls:

```text
Enable Rotator
Enable Local Feed Distribution
Enable Borough Feed Distribution
Enable Featured Placement
```

---

# SECTION P — ANALYTICS SETTINGS

Metrics available:

```text
Businesses Joined
Customers Registered
Campaign Participation
Spin Engagement
Reward Usage
Store Visits
Offer Redemptions
```

---

# 3. LOCALMALL DETAILS PAGE

After opening a LocalMall.

## Dashboard Cards

```text
Businesses
Customers
Campaigns
Events
Rewards Issued
Spin Sessions
Traffic
Revenue Generated
```

---

## Tabs

### Overview

Summary metrics.

---

### Businesses

List of businesses.

---

### Customers

List of customers.

---

### Campaigns

Campaign performance.

---

### Events

Upcoming events.

---

### Rewards

Reward statistics.

---

### Spin

Gamification statistics.

---

### Team

Agents, Consultants, Account Managers.

---

### Analytics

Charts and KPIs.

---

# 4. WHAT BUSINESS SEES

Business dashboard widget:

```text
Your LocalMall

Peckham LocalMall
Southwark Borough
Rye Lane High Street
```

Buttons:

* View Local Activity
* Join Campaign
* Join Event
* Promote Business

---

# 5. WHAT CUSTOMER SEES

Customer homepage:

```text
Welcome to Peckham LocalMall
```

Sections:

* Businesses Near You
* Today's Offers
* Local Events
* Spin Opportunities
* Rewards Near You
* Trending Businesses

---

# FINAL FRONTEND RULE

The frontend team should treat LocalMall as:

> A configurable digital town centre.

Not:

> A business category page.

Not:

> A geographical record.

Not:

> A marketing campaign.

LocalMall is the container that holds:

* Businesses
* Customers
* Campaigns
* Events
* Rewards
* Spin
* QLinks distribution
* Audit insights
* Affiliate ownership

Everything local inside the MCOM ecosystem ultimately lives inside a LocalMall.