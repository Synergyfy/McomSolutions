# MCOM CENTRAL

# Business Onboarding Flow

## Phase 1 - Business Registration & Membership

---

# SCREEN 1 – Welcome to MCOM

The business arrives from anywhere (Agent, QR Code, Referral, Expo, Website, Social Media, etc.).

The landing page should immediately communicate value instead of software features.

---

### Page Title

**Welcome to MCOM**

### Subtitle

Helping Businesses Increase Revenue, Reduce Costs, Find New Customers, Build Customer Loyalty, and Grow Smarter.

### CTA

**Get Started as a Business**

When clicked, the onboarding wizard begins.

---

# SCREEN 2 – Is Your Business Already on Google? Yes or NO (We have this process already) 

# SCREEN 3 IF YES - (We have this process already) – Confirm Imported Information

Show all information that was imported.

---

# SCREEN 4 IF NO – Verify Contact Information (We already have this)

Henry talked about one authentication across the ecosystem.

Before creating the membership, verify ownership.

### Email Verification

Send OTP

Verify

---

Continue

---

# SCREEN 5 – Business Owner Details (we have this already)

Now collect information about the primary contact.

Fields

First Name

Last Name

Job Title

Email Address

Phone Number

Password

Confirm Password

*This is missing - Check Accept Terms*

*This is Missing - Check Accept Privacy Policy*

Continue

---

# SCREEN 6 – Create Your MCOM Account

The system now creates:

* MCOM ID
* Business ID
* Membership Account
* Business Dashboard
* Referral Code
* Referral Link

Display:

**Congratulations! Your MCOM Business Account has been created.**

Continue

---

# SCREEN 7 – Welcome to the Business Success Programme

This is where Henry's messaging becomes important.

Don't immediately ask for payment.

First explain the journey.

---

### Title

**Welcome to Your Business Success Programme**

### Description

Over the next 90 days, MCOM will help you:

* Build your digital business profile.
* Strengthen your brand.
* Increase customer loyalty.
* Expand your business network.
* Improve your online presence.
* Prepare your business for a professional Business Audit.
* Receive personalised recommendations for growth.

Also explain:

* Most businesses complete the programme within 90 days.
* Some complete it in as little as 2 weeks.
* You can progress at your own pace.
* Your dashboard will guide you every step of the way.

Button:

**Continue**

---

# SCREEN 8 – Choose Your Membership (we already have a membership page at apps\frontend\src\pages\MembershipPage.tsx so we can use the ui there just adapt it for the onboarding flow )

Henry's structure should appear here.

The screen presents four membership families:

* Bronze
* Silver
* Gold
* Platinum

Selecting one expands its available plans:

For example:

Bronze

* Standard
* Pro
* Pro+

Silver

* Standard
* Pro
* Pro+

Gold

* Standard
* Pro
* Pro+

Platinum

* Standard
* Pro
* Pro+

Each plan should display:

* Annual price
* Included services
* Support level
* Number of users (if applicable)
* AI features
* Human support (Agent, Account Manager, Consultant)
* Business tools included
* Upgrade comparison

Henry consistently referred to annual membership and the structured programme, so this page should reinforce that the membership includes access to the Business Success Programme rather than simply software licences.

The business selects a plan.

Clicks:

**Continue**

---

# SCREEN 9 – Payment

Depending on the selected membership:

Display:

Membership Summary

Annual Fee

Tax (if applicable)

Total Due

Payment Method

* Card
* Bank Transfer
* Other supported methods

After successful payment:

Membership becomes Active.

If Henry later introduces invoicing or Agent-assisted payment, those methods can also be added without changing the flow.

---

# SCREEN 10 – Membership Activated

Display:

🎉 Congratulations!

Your **Gold Pro** Membership (example) is now active.

You now have access to:

* MCOM Central
* Your Business Dashboard
* Your 90-Day Business Success Programme
* Included platform access based on your membership

Button:

**Go to My Dashboard**

---

# SCREEN 11 – First Dashboard Experience

This is the business's first login after onboarding.

Instead of a blank dashboard, it should immediately orient the user.

---

### Welcome Card

Welcome, **ABC Restaurant**
Sector | Category 

Membership:
Gold Pro

Status:
Active

Business Readiness:
0%

Programme:
90-Day Business Success Programme

Current Progress:
Day 1 of 90

---

### Your First Mission

**Business Verification & Profile Foundation**

Estimated Time:

10–15 minutes

Reward:

Business Readiness + Points (if gamification is enabled)

Button:

**Start Mission**

---

### Programme Overview

Show the six major phases (or whatever final phase structure you adopt), with only Phase 1 unlocked.

Example:

* ✅ Business Registration (Completed)
* 🔓 Business Foundation
* 🔒 Digital Presence
* 🔒 Customer Engagement
* 🔒 Business Growth
* 🔒 Business Intelligence
* 🔒 Business Audit

---

## Data Created During Onboarding

By the time the business reaches the dashboard, MCOM Central has already created:

* MCOM User Account
* Business Profile
* Business ID
* Membership Record
* Subscription Record
* Authentication Credentials
* Referral ID
* Referral Link
* Initial Business Dashboard
* 90-Day Programme Record (default duration)
* Progress Record (Day 1, 0% complete)
* Activity Timeline
* Audit Eligibility Status (initially "Not Ready")

At this point, the business has completed onboarding. From here onward, every interaction is no longer part of registration—it is part of the guided 90-Day Business Success Programme, where MCOM Central becomes the orchestrator that directs the business through missions across the rest of the MCOM ecosystem.