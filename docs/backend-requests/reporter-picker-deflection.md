# Backend request: deflection exits for reporters, faster report-type list, date filter on reports

**Endpoints:** `GET /v2/organizations/by-slug/{slug}`, `POST /sa/jurisdiction-packs/` and `POST /v2/jurisdiction-packs/`, `GET /v2/report-types/`, `GET /v2/reports/`
**Requested by:** Frontend (reporter report-type picker, admin dashboard)
**Date:** 12 November 2026
**Epic:** XPAI-65
**Type:** Additive. New response fields, one honoured existing parameter, new optional query parameters and one new validation rule. No breaking change.

---

## Summary

| # | Change | Priority |
| --- | --- | --- |
| 1 | Add `deflection_exits`, `region` and `default_currency` to the public organization record | Required |
| 2 | Reject unsafe `deflection_exits[].url` values when a pack is uploaded | Required |
| 3 | Honour `include_sections=false` on the report-type list | Performance |
| 4 | Add `start_date` / `end_date` filters to `GET /v2/reports/` | Fixes a wrong count on the dashboard |

The frontend for items 1–3 is already live and starts using the backend change as soon as it ships, with no frontend release. Item 4 needs a small frontend change after the backend ships.

---

## 1. Deflection exits on the public organization record

### Why

Before a reporter picks a report type, the app shows an **"Is this the right place?"** popup. It points things that aren't whistleblowing reports, such as customer complaints and HR requests, to their own route. These routes are the jurisdiction pack's `deflection_exits`, configured per pack.

Reporters can't read them today:

- `GET /v2/jurisdiction-packs/{code}` is for signed-in **staff** only.
- Every `/sa/jurisdiction-packs/*` route needs a **super-admin** sign-in. The tenant app never calls `/sa`.
- Anonymous reporters have no token at all.

**Current workaround (live):** the popup shows two built-in routes ("A complaint about a product or service you received", "An HR request about your own job"), with no links.

### The change

`GET /v2/organizations/by-slug/{slug}` stays **public** (no auth). Today it returns only `id, name, slug, description, is_active, expires_at, is_expired`. Add three fields:

```json
{
  "id": "6ac65870449280a6833c3ac7",
  "name": "v2-test",
  "slug": "v2-test",
  "description": null,
  "is_active": true,
  "expires_at": null,
  "is_expired": false,

  "region": "KSA",
  "default_currency": "SAR",
  "deflection_exits": [
    {
      "code": "customer_complaint",
      "label": { "en": "Customer complaint", "ar": "شكوى عميل" },
      "description": { "en": "Raise it through our regulated complaints process.", "ar": "…" },
      "url": "https://example.com/complaints"
    },
    {
      "code": "hr_request",
      "label": { "en": "HR request", "ar": "طلب موارد بشرية" },
      "description": { "en": "Leave, pay or contract questions: please contact HR.", "ar": "…" },
      "url": null
    }
  ]
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `deflection_exits` | `DeflectionExit[]` | **New.** The existing `DeflectionExit` schema (`code`, `label`, `description`, `url`), unchanged. |
| `region` | string \| null | **New.** Same value as on the staff organization record. |
| `default_currency` | string \| null | **New.** ISO 4217. Same value as on the staff organization record. |

### Rules for `deflection_exits`

- **Source:** the **active** version of the organization's `default_jurisdiction_pack_code`.
- **No pack, or no active version:** return `[]`. Never return a draft version's exits, because a draft has no legal sign-off.
- **Order:** keep the pack's order. The app shows the exits in that order.
- **Entity packs:** ignore them. The reporter hasn't chosen anything yet, so the organization's default pack applies.
- **Caching:** a short `Cache-Control` (a few minutes) is fine. Packs change rarely.

### Why `region` and `default_currency` too

The money-answers part of the XPAI-65 guide says the public record carries `region` and `default_currency`. The reporter form already reads them to choose a money question's default currency. They're missing from the live response, so every reporter currently gets the fallback currency.

### How the frontend reads it (already built)

- `deflection_exits` missing or `[]`: the two built-in routes are shown instead.
- Text: `label.en`, falling back to `label.ar`. The same applies to `description`.
- A `url` opens in a new tab. The app ignores any `url` that doesn't start with `https://`, `http://`, `mailto:` or `tel:`.

---

## 2. Validate exit URLs when a pack is uploaded

**Endpoints:** `POST /sa/jurisdiction-packs/` and `POST /v2/jurisdiction-packs/` (the platform-key upload).

Reject a `deflection_exits[].url` that is not empty and doesn't start with `https://`, `mailto:` or `tel:`. Use a **422** with the usual problem shape:

```json
{
  "message": "A deflection exit link must be an https, mailto or tel address.",
  "problems": [
    { "field": "deflection_exits.0.url", "message": "Must start with https://, mailto: or tel:", "code": "invalid_url" }
  ]
}
```

These links are shown to anonymous members of the public. The app already refuses to open a `javascript:` or `data:` link, but the pack shouldn't be able to store one.

---

## 3. Honour `include_sections=false` on the report-type list

### Why

The picker loads every active report type:

```
GET /v2/report-types/?active_only=true&include_sections=false&organization_slug=v2-test&page_size=100
```

- **Today:** `include_sections=false` is ignored. For the test organization (78 types) the response is **about 1.27 MB**, with every section and question. It took **6–29 seconds** on the live server, and the reporter waits on a loading placeholder the whole time.
- **What the picker uses:** `id`, `name`, `description`, `category`, `code`. Each form fetches its own report type, with its questions, when it opens.

### The change

When `include_sections=false`, leave `sections` out of each item (or return `"sections": []`). Every other field stays as it is.

The default (`include_sections` missing or `true`) is unchanged, so no existing caller is affected.

---

## 4. Date filter on the reports list

### Why

The admin dashboard's stat cards (**Total Reports**, **Pending Cases**, **Anonymous Reports**) count reports in the selected date range. The default range is **the last 30 days**, sent to `GET /v2/reports/stats/detailed?start_date=…&end_date=…`. Clicking a card opens All Reports filtered the same way, but `GET /v2/reports/` has no date filter, so the list shows **all time**.

Live example: the dashboard says **27** anonymous reports, and clicking it opens a list of **40**.

### The change

Add two optional query parameters to `GET /v2/reports/`:

```
GET /v2/reports/?is_anonymous=true&start_date=2026-10-13T00:00:00.000Z&end_date=2026-11-12T23:59:59.999Z&page=1&page_size=20
```

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `start_date` | ISO 8601 datetime | no | **New.** Inclusive. |
| `end_date` | ISO 8601 datetime | no | **New.** Inclusive. |
| everything else | — | — | Unchanged. |

**Rules**

- Filter on **the same timestamp that `/reports/stats/detailed` counts by**, and apply the same rules about drafts and deleted reports. The card's number and the list's `total` must agree.
- Apply the filter **before pagination**, so `items`, `total` and `total_pages` describe the filtered set.
- It combines with every existing filter (`status`, `is_anonymous`, `priority`, `report_type_id`, `assigned_to`, `sla`, `search`).
- `start_date` after `end_date`: return a 422.
- Use the same names and format as `/reports/stats/detailed`, so the dashboard can pass its range straight through.

**Frontend, after this ships:** each card's link will carry the dashboard's range, and All Reports will show it as a removable "Submitted between …" filter.

---

## How to check

```bash
# 1. The public record carries the exits, region and currency (no token)
curl -s https://api.xposer.ai/v2/organizations/by-slug/v2-test | jq '{region, default_currency, deflection_exits}'

# 1b. An organization with no pack, or only a draft version → []
curl -s https://api.xposer.ai/v2/organizations/by-slug/<slug-without-active-pack> | jq '.deflection_exits'

# 2. Upload a pack with "url": "javascript:alert(1)" in deflection_exits → 422, field deflection_exits.0.url

# 3. Much smaller response, no sections
curl -s -o /dev/null -w "%{size_download} bytes, %{time_total}s\n" \
  "https://api.xposer.ai/v2/report-types/?active_only=true&include_sections=false&organization_slug=v2-test&page_size=100"

# 4. The list total matches the dashboard card for the same range
#    (TOKEN = a staff token for the organization)
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.xposer.ai/v2/reports/stats/detailed?start_date=2026-10-13T00:00:00.000Z&end_date=2026-11-12T23:59:59.999Z" \
  | jq '.summary[] | select(.label=="Anonymous Reports")'
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://api.xposer.ai/v2/reports/?is_anonymous=true&start_date=2026-10-13T00:00:00.000Z&end_date=2026-11-12T23:59:59.999Z&page_size=1" \
  | jq '.total'
```
