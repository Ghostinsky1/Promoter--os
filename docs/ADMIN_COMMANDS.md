# Admin Commands Reference

Quick reference for managing users and organizations in PromoterOS.

## View All Users and Organizations

```sql
SELECT * FROM list_users_and_organizations();
```

**Returns:**
- User email
- User ID
- Organization name
- Subscription tier (starter/pro/agency_scale)
- User role (owner/admin/member)
- Active status

## Grant Full Admin Access to a User

To give a user all features (agency_scale tier):

```sql
SELECT grant_admin_access('user@email.com');
```

**This will:**
- Upgrade their organization to agency_scale tier
- Set subscription status to active
- Give unlimited offers (-1)
- Provide 10 team seats
- Extend trial for 1 year
- Make them an organization owner

## Check User's Current Data

### View offers linked to organization

```sql
SELECT o.*, org.name as org_name, org.subscription_tier
FROM offers o
JOIN organizations org ON org.id = o.organization_id
WHERE o.user_id = 'USER_ID_HERE';
```

### View shows linked to organization

```sql
SELECT s.*, org.name as org_name
FROM shows s
JOIN organizations org ON org.id = s.organization_id
WHERE s.user_id = 'USER_ID_HERE';
```

### View all data for an organization

```sql
SELECT
  'offers' as type,
  COUNT(*) as count
FROM offers
WHERE organization_id = 'ORG_ID_HERE'
UNION ALL
SELECT 'shows', COUNT(*) FROM shows WHERE organization_id = 'ORG_ID_HERE'
UNION ALL
SELECT 'tours', COUNT(*) FROM tours WHERE organization_id = 'ORG_ID_HERE'
UNION ALL
SELECT 'templates', COUNT(*) FROM templates WHERE organization_id = 'ORG_ID_HERE';
```

## Manually Create an Organization

If you need to create an organization manually:

```sql
INSERT INTO organizations (
  name,
  slug,
  subscription_tier,
  subscription_status,
  max_offers,
  max_seats
) VALUES (
  'Company Name',
  'company-slug',
  'pro',
  'active',
  -1,
  2
)
RETURNING *;
```

## Add User to Organization

```sql
INSERT INTO organization_members (
  organization_id,
  user_id,
  role,
  is_active
) VALUES (
  'ORG_ID_HERE',
  'USER_ID_HERE',
  'owner',
  true
);
```

## Update Organization Tier

### Upgrade to Pro
```sql
UPDATE organizations
SET
  subscription_tier = 'pro',
  subscription_status = 'active',
  max_offers = -1,
  max_seats = 2
WHERE id = 'ORG_ID_HERE';
```

### Upgrade to Agency Scale
```sql
UPDATE organizations
SET
  subscription_tier = 'agency_scale',
  subscription_status = 'active',
  max_offers = -1,
  max_seats = 10
WHERE id = 'ORG_ID_HERE';
```

## Check Feature Access

Check if a user has access to a specific feature:

```sql
SELECT has_feature_access('tours');
-- Must be run while authenticated as the user
```

## Link Orphaned Data to Organization

If you have data without organization_id:

```sql
-- For a specific user
UPDATE offers
SET organization_id = (
  SELECT organization_id
  FROM organization_members
  WHERE user_id = 'USER_ID_HERE'
  LIMIT 1
)
WHERE user_id = 'USER_ID_HERE'
AND organization_id IS NULL;

-- Repeat for shows, tours, templates, settlements, company_settings
```

## Subscription Tiers Quick Reference

### Starter ($39/mo)
- Max offers: 10
- Max seats: 1
- Tours: ❌
- AI Insights: ❌
- Deal Analyzer: ❌

### Pro ($99/mo)
- Max offers: Unlimited (-1)
- Max seats: 2
- Tours: ✅
- AI Insights: ✅
- Deal Analyzer: ✅

### Agency Scale ($297/mo)
- Max offers: Unlimited (-1)
- Max seats: 10
- Tours: ✅
- AI Insights: ✅
- Deal Analyzer: ✅
- Advanced AI: ✅
- Team Collaboration: ✅
- Custom Branding: ✅
- API Access: ✅

## Troubleshooting

### User can't see their data
1. Check if they have an organization:
```sql
SELECT * FROM organization_members WHERE user_id = 'USER_ID';
```

2. Check if their data is linked:
```sql
SELECT organization_id FROM offers WHERE user_id = 'USER_ID' LIMIT 1;
```

3. If NULL, link their data using the orphaned data command above

### User locked out of feature
1. Check their tier:
```sql
SELECT o.subscription_tier, o.subscription_status
FROM organizations o
JOIN organization_members om ON om.organization_id = o.id
WHERE om.user_id = 'USER_ID';
```

2. Upgrade if needed:
```sql
SELECT grant_admin_access('user@email.com');
```

## Useful Queries

### Count users per tier
```sql
SELECT
  o.subscription_tier,
  COUNT(DISTINCT om.user_id) as user_count
FROM organizations o
JOIN organization_members om ON om.organization_id = o.id
WHERE om.is_active = true
GROUP BY o.subscription_tier;
```

### Active trials
```sql
SELECT
  o.name,
  o.subscription_tier,
  o.trial_ends_at,
  au.email
FROM organizations o
JOIN organization_members om ON om.organization_id = o.id
JOIN auth.users au ON au.id = om.user_id
WHERE o.subscription_status = 'trialing'
AND o.trial_ends_at > now()
ORDER BY o.trial_ends_at;
```

### Users over offer limit
```sql
SELECT
  au.email,
  o.name as org_name,
  o.max_offers,
  COUNT(off.id) as current_offers
FROM organizations o
JOIN organization_members om ON om.organization_id = o.id
JOIN auth.users au ON au.id = om.user_id
LEFT JOIN offers off ON off.organization_id = o.id AND off.status != 'cancelled'
WHERE o.max_offers > 0
GROUP BY au.email, o.name, o.max_offers
HAVING COUNT(off.id) >= o.max_offers;
```
