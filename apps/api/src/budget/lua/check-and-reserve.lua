-- check-and-reserve.lua
-- Atomic hierarchical budget check and reservation
-- KEYS: [user_tokens, user_cost, team_tokens, team_cost, org_tokens, org_cost, reservation_hash]
-- ARGV: [est_tokens, est_cost, user_limit_tokens, user_limit_cost, team_limit_tokens, team_limit_cost, org_limit_tokens, org_limit_cost, reservation_id, user_period_id, team_period_id, org_period_id, ttl_seconds, has_user, has_team, has_org]

local est_tokens = tonumber(ARGV[1])
local est_cost = tonumber(ARGV[2])
local user_limit_tokens = tonumber(ARGV[3])
local user_limit_cost = tonumber(ARGV[4])
local team_limit_tokens = tonumber(ARGV[5])
local team_limit_cost = tonumber(ARGV[6])
local org_limit_tokens = tonumber(ARGV[7])
local org_limit_cost = tonumber(ARGV[8])
local reservation_id = ARGV[9]
local user_period_id = ARGV[10]
local team_period_id = ARGV[11]
local org_period_id = ARGV[12]
local ttl = tonumber(ARGV[13])
local has_user = tonumber(ARGV[14])
local has_team = tonumber(ARGV[15])
local has_org = tonumber(ARGV[16])

-- Check User level (bottom-up: most restrictive first)
if has_user == 1 then
  local user_tokens = tonumber(redis.call('GET', KEYS[1]) or '0')
  local user_cost = tonumber(redis.call('GET', KEYS[2]) or '0')
  if user_limit_tokens > 0 and (user_tokens + est_tokens) > user_limit_tokens then
    return cjson.encode({allowed = false, denied_at = 'user', remaining_tokens = user_limit_tokens - user_tokens, remaining_cost = user_limit_cost - user_cost})
  end
  if user_limit_cost > 0 and (user_cost + est_cost) > user_limit_cost then
    return cjson.encode({allowed = false, denied_at = 'user', remaining_tokens = user_limit_tokens - user_tokens, remaining_cost = user_limit_cost - user_cost})
  end
end

-- Check Team level
if has_team == 1 then
  local team_tokens = tonumber(redis.call('GET', KEYS[3]) or '0')
  local team_cost = tonumber(redis.call('GET', KEYS[4]) or '0')
  if team_limit_tokens > 0 and (team_tokens + est_tokens) > team_limit_tokens then
    return cjson.encode({allowed = false, denied_at = 'team', remaining_tokens = team_limit_tokens - team_tokens, remaining_cost = team_limit_cost - team_cost})
  end
  if team_limit_cost > 0 and (team_cost + est_cost) > team_limit_cost then
    return cjson.encode({allowed = false, denied_at = 'team', remaining_tokens = team_limit_tokens - team_tokens, remaining_cost = team_limit_cost - team_cost})
  end
end

-- Check Org level
if has_org == 1 then
  local org_tokens = tonumber(redis.call('GET', KEYS[5]) or '0')
  local org_cost = tonumber(redis.call('GET', KEYS[6]) or '0')
  if org_limit_tokens > 0 and (org_tokens + est_tokens) > org_limit_tokens then
    return cjson.encode({allowed = false, denied_at = 'org', remaining_tokens = org_limit_tokens - org_tokens, remaining_cost = org_limit_cost - org_cost})
  end
  if org_limit_cost > 0 and (org_cost + est_cost) > org_limit_cost then
    return cjson.encode({allowed = false, denied_at = 'org', remaining_tokens = org_limit_tokens - org_tokens, remaining_cost = org_limit_cost - org_cost})
  end
end

-- All checks passed — atomically reserve at all levels
if has_user == 1 then
  redis.call('INCRBY', KEYS[1], est_tokens)
  redis.call('INCRBYFLOAT', KEYS[2], est_cost)
end
if has_team == 1 then
  redis.call('INCRBY', KEYS[3], est_tokens)
  redis.call('INCRBYFLOAT', KEYS[4], est_cost)
end
if has_org == 1 then
  redis.call('INCRBY', KEYS[5], est_tokens)
  redis.call('INCRBYFLOAT', KEYS[6], est_cost)
end

-- Create reservation hash for tracking
redis.call('HSET', KEYS[7],
  'tokens', est_tokens,
  'cost', est_cost,
  'user_period', user_period_id,
  'team_period', team_period_id,
  'org_period', org_period_id,
  'has_user', has_user,
  'has_team', has_team,
  'has_org', has_org
)
redis.call('EXPIRE', KEYS[7], ttl)

return cjson.encode({allowed = true, reservation_id = reservation_id})
