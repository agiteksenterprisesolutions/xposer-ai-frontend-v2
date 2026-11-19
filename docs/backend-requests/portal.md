# Portal, branding and posters (XPAI-226/227): requests from the frontend

Written for the backend team, after building PORTAL.md in the tenant app. Three
small asks.

## 1. Reserve the app's own page names as entity slugs

The tenant app has pages directly under the tenant address, for example
`demo.xposer.ai/acme/pricing` and `demo.xposer.ai/acme/track-report`. The
router matches those before an entity portal (`/acme/{entity}`), so an entity
given one of these slugs could never be reached.

Please add these to the reserved list on `PUT /v2/portal/addresses/{entity_code}`
(422, like the existing ones):

```
pricing privacy terms cookie-policy compliance security how-to-use checkout
contact forget-password register submit-anonymous track-report report-details
edit-draft reporter staff reviewer set-password
```

The frontend already refuses them (`src/utils/portalSlugs.js`), but the
backend should too: an address set any other way would still break.

## 2. Let an entity admin read their own address

`GET /v2/portal/addresses` is tenant-admin only (403 for an entity admin). The
poster form needs the entity's portal URL to offer it as the poster's
address, so an entity admin can't create a poster today.

Ask: return the entity admin's own entity row from `GET /v2/portal/addresses`
(the tenant row and other entities left out), or add the URL to the entity
admin's `GET /v2/users/me`.

## 3. Type the poster responses in openapi.json

`GET /v2/posters/`, `POST /v2/posters/` and `GET /v2/posters/{id}` have no
response schema in the spec. The frontend assumes each poster has `id`, the
request fields, and `url`, `downloadable`, `not_downloadable_reason`,
`not_downloadable_message`. Please confirm (or add the schema) so we can check
against it.
