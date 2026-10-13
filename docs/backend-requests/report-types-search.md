# Backend request: search on the report types list

**Endpoint:** `GET /v2/report-types/`
**Requested by:** Frontend (admin Report Types page)
**Date:** 13 October 2026
**Type:** Additive. One new optional query parameter. No change to the response shape and no breaking change.

---

## Summary

Add an optional `search` query parameter to `GET /v2/report-types/`. It should match report types by **name**, **category** or **compliance code**, applied **before pagination**, so that `items`, `total` and `total_pages` describe the filtered set.

`GET /v2/users/` already takes `search` the same way, so this brings the two lists into line.

## Why

The Report Types page has a search box, but the endpoint doesn't support search. Today:

- The frontend sent `?search=…`, the endpoint ignored it and returned an unfiltered page 1, and the page filtered only those rows.
- A type on page 3 or 4 therefore returned "no results" unless the admin was already on its page.
- **Current workaround (now live):** while a search is active, the frontend fetches every page (`page_size=100`) and filters in the browser. That works, but it costs one request per 100 types on the first search. It also sends every type's data to the browser just to find a few.

Once the backend supports `search`, the frontend goes back to one request per page and removes the workaround.

## The change

### Request

```
GET /v2/report-types/?search=harass&page=1&page_size=20&active_only=false
```

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `search` | string | no | **New.** Trimmed. Empty or whitespace-only means no filter. Suggest a maximum of 100 characters (422 above that). |
| `page`, `page_size`, `active_only`, `organization_id`, `organization_slug`, `include_sections` | — | — | Unchanged. |

### Matching rules

1. **Fields:** `name`, `category` and `code` (the compliance code). A type matches if **any** of them matches.
2. **Case-insensitive substring match.** `harass` matches "Workplace Harassment", and `hr-cnd` matches `HR-CND-05`.
3. **The term is literal text, not a pattern.** If you use a regex engine, for example MongoDB `$regex`, escape the input first (`re.escape` in Python), so `a.b` or `(` can't break the query or match unintended things.
4. **Combine with the other filters using AND.** `search` together with `active_only=true` returns active types that match.
5. **Existing access rules still apply.** Anonymous callers and reporters are still limited to `status: "active"` whatever they pass. Search must not widen what a caller can see.
6. **Filter first, then paginate.** `total`, `total_pages`, `has_next` and `has_previous` count only the matches.
7. **Sort:** keep the current default order.

### Response

Unchanged:

```jsonc
{
  "items": [ /* matching report types, this page only */ ],
  "page": 1,
  "page_size": 20,
  "total": 1,          // number of MATCHES, not of all types
  "total_pages": 1,
  "has_next": false,
  "has_previous": false
}
```

No matches is a normal response, not a 404:

```jsonc
{ "items": [], "page": 1, "page_size": 20, "total": 0, "total_pages": 0, "has_next": false, "has_previous": false }
```

### OpenAPI

Please declare `search` on the operation, as `GET /v2/users/` does, with a description. The frontend team checks `/v2/openapi.json` to confirm that a parameter is supported before relying on it.

### Implementation sketch (MongoDB, if that's the store)

```python
term = (search or "").strip()
if term:
    pattern = {"$regex": re.escape(term), "$options": "i"}
    query["$or"] = [{"name": pattern}, {"category": pattern}, {"code": pattern}]
# … then the existing active_only / organization filters, count, skip/limit
```

Organizations have around 110 types today, so an index isn't needed for this. A case-insensitive substring regex can't use a normal index anyway. If a text index is preferred instead, it must still match partial words (`harass` → "Harassment"), which `$text` alone does not.

## Acceptance checks

Use an organization with more than 20 report types, one of which is named "Workplace Harassment" and sits beyond page 1 of the default listing.

| # | Request | Expected |
| --- | --- | --- |
| 1 | `?search=harass` | "Workplace Harassment" is returned on page 1, and `total` = number of matches. |
| 2 | `?search=HARASS` | Same as 1 (case-insensitive). |
| 3 | `?search=fraud` | Types whose **category** contains "fraud" are returned. |
| 4 | `?search=hr-cnd` | The type with code `HR-CND-05` is returned. |
| 5 | `?search=a.b(` | 200 with an empty or correct result. No 500, and nothing matched as if it were a pattern. |
| 6 | `?search=` or `?search=%20%20` | Same as no search. |
| 7 | `?search=harass&active_only=true` with the type set to `draft` | Not returned. |
| 8 | Anonymous caller: `?search=<a draft type's name>` | Not returned (anonymous callers see only active types). |
| 9 | `?search=type&page=2&page_size=10` with 25 matches | Items 11–20 of the matches, `total` = 25, `total_pages` = 3. |
| 10 | No `search` | Identical to today's behaviour. |

## What the frontend will do once this ships

- Send the box's text as `search` (after a 400 ms debounce), with the current page and page size.
- Remove the fetch-everything workaround in `src/pages/admin/ReportTypes.jsx`.
- Show `total` from the response as the result count.

Please tell the frontend team when it's deployed, ideally with the OpenAPI change, so both sides can switch together.

---

## Related, separate requests

Found during the same review. Neither blocks the search change.

### 1. Deleting a directory entry leaves accounts pointing at nothing

`DELETE /v2/org-hierarchy/members/{member_id}` removes a hand-entered person. Any account linked to that person keeps its `hierarchy_member_id`, which now points at an entry that doesn't exist.

- **Live example:** user `v2_test_malikhassansajid` has `hierarchy_member_id: "malik-hassan-sajid"`, and no directory entry has that ID.
- **Effect:** the Users page shows "Entry missing". The person isn't in the org chart, and a manager linked this way sees only their own cases instead of their team's.
- **Request:** on delete, either clear `hierarchy_member_id` on the linked accounts, or refuse with 409 and name them (as role delete does). Either way, include the affected accounts in the response so the UI can tell the admin.

### 2. The audit log endpoint is missing on v2

The Audit Logs page calls `GET /v2/analytics/activity-timeline?page=&q=`, which returns **404** on the v2 backend, and the endpoint isn't in the OpenAPI spec. Without it, there's no way to see, for example, who deleted the directory entry above. Please confirm whether it moved or still needs porting to v2.
