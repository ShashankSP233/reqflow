# ReqFlow

ReqFlow is a requisition and procurement workflow management application designed to manage the complete lifecycle of purchase requisitions — from creation and checking through approval, assignment, purchasing, progress tracking, completion, and historical documentation.

The application is a full-stack TypeScript system with a React frontend, Express backend, PostgreSQL database, Drizzle ORM, OpenAPI API definitions, generated API clients, and Zod validation.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [User Roles](#user-roles)
- [Requisition Workflow](#requisition-workflow)
- [Requisition Data](#requisition-data)
- [Expected Cost per Unit](#expected-cost-per-unit)
- [Status Updates](#status-updates)
- [Queries](#queries)
- [Attachments](#attachments)
- [Printing and Export](#printing-and-export)
- [Partial Close / Continuation Requisitions](#partial-close--continuation-requisitions)
- [API Architecture](#api-architecture)
- [Database](#database)
- [Local Development](#local-development)
- [Validation](#validation)
- [Git Workflow](#git-workflow)
- [Production Environment](#production-environment)
- [Production Deployment](#production-deployment)
- [Server-Specific Authentication](#server-specific-authentication)
- [Troubleshooting](#troubleshooting)
- [Development Principles](#development-principles)
- [Important Rules](#important-rules)
- [Architecture Overview](#architecture-overview)
- [Future Documentation](#future-documentation)

---

# Overview

ReqFlow manages requisitions through a controlled workflow involving:

```text
Site User
    ↓
Checker(s)
    ↓
Approver
    ↓
Purchase Head
    ↓
Purchase Member
    ↓
Purchase / Completion
```

The system maintains the requisition's workflow state, approval information, purchasing assignment, status history, queries, attachments, and completion information.

The system also supports **Partial Close**, allowing fulfilled items to be completed while remaining items continue through a linked continuation requisition.

---

# Features

ReqFlow currently supports:

- Requisition creation
- Requisition item management
- Site/project/vessel information
- Priority management
- Multi-stage checking
- Approval workflow
- Purchase Head actions
- Purchase Member assignment
- Purchase progress tracking
- Status updates
- Queries
- Attachments
- Approval notes
- Completed requisition handling
- Individual requisition printing
- Batch requisition printing/export
- Partial close of requisitions
- Continuation requisitions
- Parent/child requisition relationships
- Inherited historical context
- PostgreSQL persistence
- OpenAPI API definitions
- Generated frontend API clients
- Zod API validation

---

# Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Language | TypeScript |
| Build Tool | Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Validation | Zod |
| API Specification | OpenAPI |
| API Client Generation | Orval |
| Package Manager | pnpm |

The project uses a pnpm workspace structure.

The database package is:

```text
@workspace/db
```

---

# Project Structure

The repository is organized into applications and shared libraries.

```text
reqflow/
│
├── artifacts/
│   │
│   ├── api-server/
│   │   └── src/
│   │       ├── routes/
│   │       └── ...
│   │
│   └── requisition/
│       └── src/
│           ├── components/
│           ├── pages/
│           └── ...
│
├── lib/
│   │
│   ├── api-client-react/
│   │   └── src/
│   │       └── generated/
│   │
│   ├── api-spec/
│   │   └── openapi.yaml
│   │
│   ├── api-zod/
│   │   └── src/
│   │       └── generated/
│   │
│   └── db/
│       ├── src/
│       │   └── schema/
│       ├── drizzle.config.ts
│       └── package.json
│
├── package.json
├── pnpm-lock.yaml
└── README.md
```

---

# User Roles

ReqFlow currently has five roles.

Do not introduce additional roles without an explicit product requirement.

## 1. Site User

Role:

```text
site_user
```

Responsibilities include:

- Creating requisitions
- Providing requisition information
- Submitting requisitions
- Tracking their requests
- Responding to queries where applicable

---

## 2. Checker

Role:

```text
checker
```

Participates in the checking stage of the requisition workflow.

Checkers can review requisitions and perform the workflow actions available to their role.

---

## 3. Approver

Role:

```text
approver
```

Participates in the approval stage.

Approvers review requisitions and perform the approval actions available to them.

---

## 4. Purchase Member

Role:

```text
purchase_member
```

Purchase Members handle purchasing work after assignment.

Responsibilities include:

- Viewing assigned requisitions
- Working on requisitions
- Updating purchasing progress
- Adding status updates
- Viewing queries
- Handling purchasing-related work
- Printing requisitions
- Batch exporting requisitions

A Purchase Member can add status updates.

Other users who have access to the requisition can view the status-update history.

---

## 5. Purchase Head

Role:

```text
purchase_head
```

The Purchase Head handles higher-level purchasing workflow actions.

Responsibilities include:

- Reviewing purchasing requisitions
- Managing assignment
- Purchase workflow actions
- Approval-related actions
- Partial Close

Only the Purchase Head can perform Partial Close.

Authorization must be enforced by the backend, not only by the frontend.

---

# Requisition Workflow

The currently supported requisition statuses are:

```text
draft
pending_checkers
pending_approver
on_hold
approved
assigned
in_progress
completed
```

Do not invent new statuses unless a new business requirement explicitly requires them.

## General Workflow

A normal requisition can progress approximately as follows:

```text
draft
   ↓
pending_checkers
   ↓
pending_approver
   ↓
approved
   ↓
assigned
   ↓
in_progress
   ↓
completed
```

`on_hold` is used where the existing workflow permits a requisition to be placed on hold.

The backend workflow implementation is the source of truth for valid transitions.

---

# Requisition Data

A requisition can contain information such as:

- Requisition reference number
- Requester
- Site
- Project
- Vessel
- Purpose
- Priority
- Creation timestamp
- Current workflow status
- Assigned Purchase Member
- Approval information
- Approval timestamps
- Approval notes
- Requisition items
- Queries
- Status updates
- Attachments

---

# Requisition IDs vs Reference Numbers

ReqFlow uses two different identifiers.

## Database ID

The requisition has a numeric database ID.

Example:

```text
11
```

This is used internally and in application routes.

Example:

```text
/requisitions/11
```

## Requisition Reference

The user-facing reference is a human-readable identifier.

Example:

```text
REQ-20260912-0046
```

The reference should be displayed to users.

However, when constructing frontend URLs, use the numeric requisition ID.

### Correct

```text
/requisitions/11
```

### Incorrect

```text
/requisitions/REQ-20260912-0046
```

This distinction is particularly important for continuation requisitions.

---

# Expected Cost per Unit

For new requisition items, the expected cost represents the expected cost of **one unit**.

The UI should describe the field as:

```text
Expected Cost per Unit (₹)
```

Helper text:

```text
Enter the expected cost of one unit. Total is calculated automatically.
```

## Calculation

For each item:

```text
Line Total = Quantity × Expected Cost per Unit
```

The requisition total is:

```text
Requisition Total = Sum of all Line Totals
```

### Example

If:

```text
Quantity = 3
Expected Cost per Unit = ₹71,820
```

then:

```text
Line Total = 3 × 71,820
           = ₹215,460
```

---

## Existing Historical Data

Existing requisition records must **not** be automatically migrated or reinterpreted because historical data may have been entered using the previous convention.

Therefore:

- Existing database values must remain unchanged.
- Existing historical totals must remain unchanged.
- Existing requisitions must not be recalculated.
- Historical `expected_cost` values must not be silently multiplied or divided.
- The unit-cost convention applies to new/future requisition items.

This is intentional to preserve historical data integrity.

---

# Status Updates

Status Updates provide a chronological record of purchasing/progress activity.

## Permissions

Purchase Members can create status updates.

Users who have access to the requisition can view the status-update history.

Frontend visibility is not considered authorization.

The backend must enforce the rule that only:

```text
purchase_member
```

can create status updates.

There is currently no separate edit/delete workflow that should be introduced without a requirement.

---

# Queries

Queries allow users involved in a requisition to request clarification or communicate about the request.

Queries are associated with requisitions.

For continuation requisitions:

- Existing queries remain associated with the original requisition.
- Historical queries can be displayed as inherited context.
- Existing query records should not be duplicated unnecessarily.
- New queries after continuation belong to the child requisition.

---

# Attachments

Requisitions can contain file attachments.

Attachments are part of the requisition's historical context.

For continuation requisitions:

```text
Parent attachments
        ↓
Inherited by child for viewing
```

The application should avoid duplicating physical files or attachment records merely to make them visible on the continuation.

New attachments created after continuation belong to the child requisition.

---

# Printing and Export

ReqFlow supports both individual and batch requisition printing/export.

## Individual Purchase Requisition

The existing Purchase Member print endpoint provides the requisition's purchasing information in CSV format.

The endpoint is responsible for server-side authorization.

The existing endpoint should be reused rather than duplicating its authorization logic elsewhere.

---

## Batch Requisition Print

Purchase Members have a dedicated:

```text
Print Requisitions
```

page.

The page allows a Purchase Member to:

1. View assigned `in_progress` requisitions.
2. Select one or more requisitions.
3. Fetch the existing print CSV for each requisition.
4. Combine the CSV files into a ZIP.
5. Download the ZIP from the browser.

This implementation intentionally reuses the existing print endpoint.

No separate backend batch-print authorization path is required.

The normal Purchase Member requisition list should not receive a global `assigned_to_id` filter simply because the batch-print page needs one.

---

# Partial Close / Continuation Requisitions

Partial Close solves the situation where most items in a requisition have been fulfilled but one or two items remain unavailable.

Instead of keeping the entire requisition open for months, the fulfilled items can be closed while the remaining items continue under a new linked requisition.

---

## Purpose

Example:

```text
Original requisition:

Item A → fulfilled
Item B → fulfilled
Item C → unavailable
```

After Partial Close:

```text
Parent:
Item A
Item B
Status = completed

Child:
Item C
Status = inherited from the parent's previous status
```

This allows the completed portion to be printed/documented and signed while the remaining items continue independently.

---

# Partial Close Permission

Only:

```text
purchase_head
```

can perform Partial Close.

The frontend should show the action only to authorized users, but backend authorization is mandatory.

---

# Partial Close UI

For eligible requisitions, the Purchase Head can see:

```text
[Partially Close]
[Close Requisition]
```

Partial Close is available while the requisition is still active and is not already completed.

The Partial Close dialog allows the Purchase Head to select the fulfilled items.

It does **not** request a new approval note.

---

# Parent Requisition

Suppose the original requisition is:

```text
REQ-20260912-0046
```

After Partial Close, it remains:

```text
REQ-20260912-0046
```

and becomes:

```text
completed
```

The parent contains the fulfilled items.

The parent remains the historical record of the completed portion.

---

# Child Continuation Requisition

The remaining items become a child requisition.

Example:

```text
REQ-20260912-0046.1
```

The child is a real requisition record.

It retains the relationship to its parent through the dedicated continuation relation.

The child starts with the **exact status the parent had immediately before Partial Close**.

Example:

```text
Parent before Partial Close:
in_progress

Parent after Partial Close:
completed

Child:
in_progress
```

The workflow is therefore not restarted from `draft`.

---

# Continuation Reference Numbers

The first continuation uses:

```text
REQ-20260912-0046.1
```

Further continuation levels can use the established sequence mechanism.

The parent reference itself remains unchanged.

---

# Parent / Child Relationship

The parent and child are both stored in the normal:

```text
requisitions
```

table.

The relationship itself is stored separately.

Relevant tables include:

```text
requisition_partial_relations
```

and:

```text
requisition_partial_relation_items
```

Conceptually:

```text
requisitions
     │
     ├── Parent
     │
     └── Child
            │
            ▼
requisition_partial_relations
            │
            ▼
requisition_partial_relation_items
```

---

# Relation Table

The relationship table represents the parent/child continuation.

Conceptually it contains:

```text
id
parent_requisition_id
child_requisition_id
relation_type
created_by
created_at
```

The relation type identifies the relationship as a partial/continuation relationship.

---

# Item Mapping

The item mapping table associates parent items with child items.

Conceptually:

```text
relation_id
parent_item_id
child_item_id
```

This allows the system to preserve the relationship between the original item and its continuation item.

---

# Inherited History

Historical information is inherited logically rather than duplicated.

A child continuation can display the parent's historical:

- Status updates
- Queries
- Attachments
- Approval context
- Approval notes

without creating duplicate records.

Example:

```text
Parent history:

Update A
Update B
Query A
Attachment A

Child display:

Update A       ← inherited
Update B       ← inherited
Query A        ← inherited
Attachment A   ← inherited

Update C       ← child-owned
Query B        ← child-owned
Attachment B   ← child-owned
```

New activity created after continuation belongs to the child.

---

# Approval Context

Partial Close does not create a new approval note.

The child retains the original approval context and timestamp.

If the child later undergoes a new approval-related action, the new approval note belongs to the child.

The parent's original approval information remains unchanged.

---

# Requester

The original requester must remain the requester.

For example:

```text
Raised By:
Pratik Pandey · Continuation
```

The Purchase Head performing Partial Close must **not** become the requester.

The continuation relationship should be communicated separately from the requester identity.

---

# Continuation Navigation

The parent can display:

```text
Continuation: REQ-20260912-0046.1
```

The child can display:

```text
Continuation of REQ-20260912-0046
```

The displayed reference is human-readable, but the actual frontend navigation must use the numeric requisition ID.

---

# Historical Integrity

Once a parent is completed through Partial Close, it should effectively behave as a historical/frozen record.

Later activity on the child should not silently modify the parent's historical representation.

Conceptually:

```text
                 Partial Close
                      │
                      ▼
              ┌───────────────┐
              │     Parent    │
              │   Completed   │
              └───────────────┘
                      │
                      │ relation
                      ▼
              ┌───────────────┐
              │     Child     │
              │  Continuing   │
              └───────────────┘
```

---

# Transaction Safety

Partial Close is an atomic backend operation.

The operation should be performed inside a PostgreSQL transaction.

Conceptually:

```text
Validate request
      ↓
Validate selected items
      ↓
Determine remaining items
      ↓
Create child requisition
      ↓
Create child items
      ↓
Create parent/child relation
      ↓
Create item mappings
      ↓
Record audit information
      ↓
Complete parent
      ↓
Commit transaction
```

If an operation fails, the transaction should roll back rather than leaving an incomplete continuation.

---

# API Architecture

Backend code is located under:

```text
artifacts/api-server/
```

Important route modules include:

```text
artifacts/api-server/src/routes/
```

Current important areas include:

```text
requisitions.ts
workflow.ts
status_updates.ts
queries.ts
analytics.ts
```

The backend is responsible for:

- Authorization
- Validation
- Workflow transitions
- Database operations
- Requisition creation/update
- Partial Close
- Query management
- Status updates
- Attachment operations
- Printing/export endpoints

---

# OpenAPI

The API specification is located at:

```text
lib/api-spec/openapi.yaml
```

Generated API code is located under:

```text
lib/api-client-react/src/generated/
```

and:

```text
lib/api-zod/src/generated/
```

---

## OpenAPI Development Rule

When changing an API:

```text
OpenAPI
   ↓
Code generation
   ↓
Generated API client
   ↓
Generated Zod schemas
   ↓
Typecheck
```

Do not manually modify generated files when the underlying API contract should be changed.

The source of truth is:

```text
lib/api-spec/openapi.yaml
```

---

# Database

ReqFlow uses:

```text
PostgreSQL
```

with:

```text
Drizzle ORM
```

Database schema files are located at:

```text
lib/db/src/schema/
```

The schema index is:

```text
lib/db/src/schema/index.ts
```

Drizzle configuration:

```text
lib/db/drizzle.config.ts
```

Database package:

```text
@workspace/db
```

---

# Database Configuration

The database connection is configured through:

```text
DATABASE_URL
```

A typical local configuration is:

```text
DATABASE_URL=postgres://postgres:root@localhost:5432/reqflow
```

Always verify the actual `.env` value before running database commands.

Never assume a database command is targeting local development.

---

# Database Schema Changes

Database changes should be:

1. Required by an actual feature.
2. Implemented in the Drizzle schema.
3. Tested against the local database.
4. Verified with existing data.
5. Reviewed before production deployment.

Avoid unnecessary migrations.

Do not use forced schema operations casually.

The database package provides the normal schema push script.

```bash
pnpm --filter @workspace/db push
```

The force version should only be used when the consequences have been explicitly reviewed.

---

# Local Development

The primary local development project is:

```text
D:\Projects\reqflow
```

The local environment is used for:

- Development
- Testing
- Database testing
- API testing
- Frontend testing
- Git commits
- GitHub pushes

Before running database commands:

```text
Verify DATABASE_URL
```

and make sure it points to the local development database.

---

# Development Workflow

A normal development cycle is:

```text
Understand requirement
        ↓
Inspect existing implementation
        ↓
Make small targeted change
        ↓
Update OpenAPI if required
        ↓
Regenerate API clients if required
        ↓
Typecheck
        ↓
Test locally
        ↓
Review diff
        ↓
Commit
        ↓
Push to GitHub
```

Avoid rewriting unrelated working code while implementing a small feature.

---

# Validation

Before committing a significant change, perform appropriate validation.

At minimum:

```text
Backend typecheck
Frontend typecheck
```

If an API contract changed:

```text
OpenAPI validation
API code generation
Generated client consistency
Typecheck
```

If database schema changed:

```text
Verify DATABASE_URL
Apply schema locally
Verify schema
Test existing records
Test new functionality
```

For workflow changes, test the actual role/status combinations involved.

Compilation alone is not sufficient for workflow changes.

---

# Git Workflow

GitHub is used as the version-control and transfer point between development and production.

The general flow is:

```text
Development Laptop
        ↓
      Git
        ↓
    GitHub main
        ↓
    Production ServerPC
```

---

# Backup Branches

Before a significant change, create a backup branch if useful.

Example:

```bash
git branch backup-before-change
git push origin backup-before-change
```

This preserves a known-good GitHub reference point.

---

# Checking the Working Tree

Before committing:

```bash
git status
```

Review the changes:

```bash
git diff
```

If files have already been staged:

```bash
git diff --cached
```

Check the staged diff for whitespace/errors:

```bash
git diff --cached --check
```

Review the staged file list:

```bash
git diff --cached --stat
```

---

# Staging Files

Avoid blindly using:

```bash
git add .
```

if the working tree contains:

- Credentials
- Seed files
- Temporary files
- Handover archives
- Local configuration
- Machine-specific files

Prefer explicitly staging the files belonging to the feature.

---

# Commit

Use descriptive commit messages.

Example:

```bash
git commit -m "Add partial close and unit cost handling"
```

Then push:

```bash
git push origin main
```

---

# Sensitive Files

Never commit credentials or secrets.

Examples include:

```text
logincred.txt
```

if it contains passwords or credentials.

Also review:

- `.env`
- API keys
- Database passwords
- Private certificates
- Session secrets
- Local authentication configuration
- Machine-specific configuration

Temporary handover archives should also not be committed unless explicitly intended.

---

# Production Environment

Production runs on the ServerPC.

Production project path:

```text
D:\reqflow
```

Production domain:

```text
reqflow.dhartidredging.com
```

Production public access is currently:

```text
http://reqflow.dhartidredging.com:8008
```

Production IP:

```text
49.248.97.101
```

The production system is live.

**Do not restart, modify, or deploy to production unless explicitly required.**

---

# Production Source of Truth

The ServerPC is the source of truth for the currently running production deployment.

GitHub is used to transfer approved application changes between development and production.

This means that not every file on the ServerPC should automatically be replaced by the GitHub version.

Some files are intentionally server-specific.

---

# Production Deployment

A typical deployment flow is:

```text
Development
    ↓
Local testing
    ↓
Git commit
    ↓
GitHub
    ↓
ServerPC
    ↓
Selective deployment
    ↓
Build/typecheck
    ↓
Restart application
    ↓
Verify production
```

Do not blindly overwrite the entire production project.

Before deployment, identify files that contain production-specific configuration.

---

# Server-Specific Authentication

The production ServerPC has server-specific authentication configuration.

In particular:

```text
artifacts/api-server/src/routes/auth.ts
```

may contain production-specific changes that should be preserved.

**Do not blindly replace the production `auth.ts` with the GitHub version.**

When deploying other application changes, use a selective deployment approach that preserves the ServerPC-specific authentication implementation.

After deployment, verify that authentication still behaves correctly.

---

# Production Deployment Checklist

Before deploying:

```text
[ ] Feature tested locally
[ ] Existing functionality tested
[ ] Backend typecheck passed
[ ] Frontend typecheck passed
[ ] OpenAPI regenerated if required
[ ] Database changes tested locally
[ ] No credentials staged
[ ] Git diff reviewed
[ ] Backup branch created if appropriate
[ ] GitHub updated
[ ] Production-specific auth.ts identified
```

On ServerPC:

```text
[ ] Fetch latest approved changes
[ ] Preserve server-specific auth.ts
[ ] Deploy intended files
[ ] Install dependencies if required
[ ] Build/typecheck
[ ] Apply database changes only when explicitly approved
[ ] Restart application process
[ ] Verify production
```

---

# Troubleshooting

## API Returns HTTP 500

Check the API terminal/log output.

The outer HTTP logging may only show:

```text
500
```

The actual error may appear earlier in the server output.

Look for:

- PostgreSQL errors
- SQL errors
- Validation errors
- Type errors
- Missing columns
- Constraint violations
- Application exceptions

---

## Requisition List Is Empty

An empty UI does not necessarily mean the database contains no requisitions.

Check the browser Network tab.

Look at:

```text
/api/requisitions
```

Inspect:

- HTTP status
- Request parameters
- Response body

A backend HTTP 500 can result in an apparently empty or broken UI.

---

## Drizzle Kit Is Not Found

Drizzle Kit is part of the database workspace.

Instead of assuming it is exposed from the repository root, use the package script:

```bash
pnpm --filter @workspace/db push
```

---

## Continuation Link Does Not Open

The displayed reference might look like:

```text
REQ-20260912-0046.1
```

but the URL must use the numeric database ID.

Correct:

```text
/requisitions/12
```

Incorrect:

```text
/requisitions/REQ-20260912-0046.1
```

---

## Approval Note Appears After a Delay

After submitting an approval note, the updated information may take a short time to appear while the UI refreshes its data.

Do not submit the same approval action repeatedly simply because the UI has not refreshed immediately.

---

# Development Principles

## 1. Make Small Changes

ReqFlow is an existing production application.

When adding a feature:

```text
Change only what is necessary.
```

Avoid unnecessary rewrites.

---

## 2. Preserve Existing Behavior

Before changing a shared component or route, understand how it is currently used.

A change that fixes one page but breaks another is not an acceptable feature implementation.

---

## 3. Backend Authorization Is Mandatory

Frontend checks such as:

```tsx
user.role === "purchase_head"
```

are useful for UI visibility.

They are not security.

The backend must independently verify permissions.

---

## 4. Preserve Historical Data

Historical requisitions are important records.

Do not silently recalculate or reinterpret old records when introducing a new convention.

The expected-cost-per-unit change is an example:

```text
New records → unit cost
Existing records → unchanged
```

---

## 5. Avoid Unnecessary Duplication

For continuation requisitions, inherited information should normally be resolved through the parent/child relationship.

Do not duplicate:

- Status updates
- Queries
- Attachments
- Historical approval context

unless there is a specific reason.

---

## 6. Parent Requisitions Are Historical Records

After Partial Close:

```text
Parent = completed historical portion
Child = continuing outstanding portion
```

Later child activity should not silently modify the parent's historical state.

---

## 7. OpenAPI Is the API Source of Truth

When changing an API:

```text
openapi.yaml
     ↓
generation
     ↓
generated files
```

Do not manually patch generated API files.

---

## 8. Production Safety

The development laptop, GitHub, and ServerPC are separate environments.

A successful local test does not automatically mean a change should be deployed to production.

---

# Architecture Overview

The high-level architecture is:

```text
                         ReqFlow
                            │
            ┌───────────────┼────────────────┐
            │               │                │
            ▼               ▼                ▼
        Frontend           API            Database
       React/Vite      Express/Node       PostgreSQL
            │               │                │
            │               │                ▼
            │               │          Drizzle ORM
            │               │
            │               ▼
            │          OpenAPI Spec
            │               │
            │       ┌───────┴────────┐
            │       ▼                ▼
            │  React API Client   Zod Client
            │
            ▼
      Requisition Pages
            │
      ┌─────┼──────────────┐
      │     │              │
      ▼     ▼              ▼
   Workflow Queries    Attachments
      │
      ▼
 Status Updates
      │
      ▼
 Purchasing
      │
      ▼
 Completion
      │
      ▼
 Partial Close
      │
      ├─────────────────┐
      ▼                 ▼
   Parent              Child
  Completed         Continuation
      │                 │
      └────────┬────────┘
               ▼
      Partial Relation
          Tables
```

---

# Partial Close Architecture

The continuation system can be represented as:

```text
                    Original Requisition
                    REQ-20260912-0046
                            │
                    Partial Close
                            │
              ┌─────────────┴─────────────┐
              │                           │
              ▼                           ▼
       Parent Requisition          Child Requisition
       REQ-20260912-0046           REQ-20260912-0046.1
              │                           │
          completed             inherited previous status
              │                           │
              │                           │
              └───────────┬───────────────┘
                          ▼
              requisition_partial_relations
                          │
                          ▼
           requisition_partial_relation_items
```

---

# Data Ownership in Continuations

A useful mental model is:

```text
                     Parent
                       │
        ┌──────────────┼──────────────┐
        │              │              │
     History        Queries       Attachments
        │              │              │
        └──────────────┼──────────────┘
                       │
                  inherited view
                       │
                       ▼
                     Child
                       │
              ┌────────┼────────┐
              │        │        │
           New data  New data  New data
           updates   queries   files
```

Historical data remains owned by the original requisition.

New activity belongs to the continuation.

---

# Current Git Backup

A backup branch was created during recent feature development:

```text
backup-before-unit-cost
```

The branch was pushed to GitHub as a safety/reference point before the latest unit-cost and Partial Close work.

The exact state of backup branches should always be verified with:

```bash
git branch -a
```

before relying on them for rollback.

---

# Useful Git Commands

Check current state:

```bash
git status
```

View unstaged changes:

```bash
git diff
```

View staged changes:

```bash
git diff --cached
```

View recent commits:

```bash
git log --oneline --decorate -10
```

Fetch remote changes:

```bash
git fetch origin
```

Push main:

```bash
git push origin main
```

Create a backup branch:

```bash
git branch backup-before-change
git push origin backup-before-change
```

---

# Useful Database Commands

Connect to local PostgreSQL:

```bash
psql -U postgres -d reqflow
```

Check tables:

```sql
\dt
```

Check schemas:

```sql
\dn
```

Always confirm that the database is the intended development database before running schema-changing commands.

---

# Future Documentation

This README is intended to explain the current architecture and important development rules.

Detailed implementation/debugging history should remain in dedicated development notes rather than making this README a chronological diary.

When a future change materially affects:

- Roles
- Workflow
- Database architecture
- API architecture
- Deployment
- Security
- Data conventions
- Continuation behavior

the relevant section of this README should be updated.

---

# Final Principle

ReqFlow is not simply a CRUD application.

It is a workflow and historical-record system.

Every feature should preserve:

```text
Authorization
      +
Workflow State
      +
Historical Data
      +
Auditability
      +
Parent/Child Relationships
      +
Production Safety
```

A feature is complete only when the UI, backend, database, permissions, historical behavior, and existing workflow continue to work together correctly.
