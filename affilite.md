This is a very important question because this decision affects the entire architecture of **247GBS Affiliates**, **MCOM Central**, and **LocalMall ownership**.

The short answer is:

> **Yes, they should have access to the LocalMall assigned to them.**
>
> Otherwise, assigning them serves almost no operational purpose.

However, they should not have the same access level.

---

# Option 1 — Label Only (Not Recommended)

Example:

```text
Peckham LocalMall

Consultant:
John Doe

Account Manager:
Sarah

Agent:
Michael
```

The names are simply stored for reporting purposes.

This means:

* No login access.
* No dashboard access.
* No territory access.
* No performance tracking.

This is basically just metadata.

Honestly, based on everything Henry has said about Agents, Consultants and Account Managers, this does not seem to be his intention.

---

# Option 2 — Territory Access (Most Likely Henry's Vision)

This is much more aligned with what you've previously described.

## Consultant

Consultant logs into:

```text
247GBS Affiliates
```

Dashboard shows:

```text
Assigned Territories

✓ Peckham LocalMall
✓ Dulwich LocalMall
✓ Camberwell LocalMall
```

The consultant only sees these LocalMalls.

Not all LocalMalls.

---

## Account Manager

Account Manager logs into:

```text
247GBS Affiliates
```

Dashboard shows:

```text
Assigned LocalMalls

✓ Peckham LocalMall
```

They can see:

* Businesses in Peckham.
* Campaign participation.
* Audit progress.
* Membership renewals.
* Business activity.

But they cannot see:

* Greenwich LocalMall.
* Croydon LocalMall.

---

## Agent

Agent logs in.

Sees:

```text
My Territory

Peckham LocalMall
```

Can view:

* Businesses assigned to them.
* Prospect businesses.
* Leads.
* Onboarding pipeline.
* Audit completion progress.

---

# How Does The System Know What To Show?

This is not done by storing only names.

Instead, the assignment should use IDs.

Example:

## LocalMall Record

```json
{
    "localmall_id": 5,
    "consultant_id": 21,
    "account_manager_ids": [14,16],
    "agent_ids": [31,35]
}
```

---

When user logs in:

```text
User ID = 14
Role = Account Manager
```

System checks:

```text
Which LocalMalls contain account_manager_id = 14 ?
```

Result:

```text
Peckham LocalMall
Dulwich LocalMall
```

Only these are displayed.

---

# How Frontend Developers Should Build It

## LocalMall Assignment Section

Instead of:

```text
Consultant:
John Doe
```

Build:

```text
Lead Consultant
[ Select Consultant Dropdown ]

Assigned Account Managers
[ Multi Select Dropdown ]

Assigned Agents
[ Multi Select Dropdown ]
```

The dropdown options come from:

```text
247GBS Affiliates Users
```

Filtered by role.

---

Example:

### Consultant Dropdown

```text
John Doe
Mary Smith
David Jones
```

---

### Account Manager Dropdown

```text
Sarah Johnson
James Wilson
```

---

### Agent Dropdown

```text
Michael Brown
Paul Taylor
```

---

# Access Matrix

| Feature                  | Consultant | Account Manager | Agent   |
| ------------------------ | ---------- | --------------- | ------- |
| View LocalMall Dashboard | Yes        | Yes             | Yes     |
| View Businesses          | Yes        | Yes             | Yes     |
| View Audit Results       | Yes        | Yes             | Limited |
| Approve Businesses       | Yes        | Yes             | No      |
| View Campaigns           | Yes        | Yes             | Yes     |
| Create Campaigns         | No         | No              | No      |
| Assign Businesses        | Yes        | Yes             | No      |
| View Revenue Stats       | Yes        | Limited         | No      |

---

# Where Do They Log In?

This is another important point.

They do not log into:

```text
MCOM Mall
```

They log into:

```text
247GBS Affiliates
```

because that is their operational platform.

The Affiliates platform then pulls data from:

* MCOM Mall
* Audit
* Rewards
* Loyalty
* Spin

for only their assigned LocalMalls.

---

# Example Flow

### Admin

Assigns:

```text
Peckham LocalMall

Consultant:
John Doe

Account Manager:
Sarah

Agents:
Michael
Paul
```

---

### Michael logs into Affiliates

Dashboard shows:

```text
My LocalMalls

Peckham LocalMall
```

He clicks:

```text
Peckham LocalMall
```

Sees:

```text
15 businesses onboarded
8 prospects
4 pending audits
2 businesses awaiting verification
```

---

### Sarah logs in

She sees:

```text
Peckham LocalMall

52 Businesses
34 Active Campaigns
18 Pending Renewals
```

---

### Consultant logs in

Sees:

```text
Peckham LocalMall
Dulwich LocalMall
Camberwell LocalMall
```

with higher-level reporting.

---

So the answer is:

> **The assignment is not just a label.**
>
> It becomes a permission boundary and territory assignment mechanism inside 247GBS Affiliates.

Without that, LocalMall assignment has very little operational value beyond reporting.