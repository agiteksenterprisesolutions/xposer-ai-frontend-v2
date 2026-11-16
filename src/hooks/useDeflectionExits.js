// src/hooks/useDeflectionExits.js
//
// The deflection exits a reporter sees before starting a form: routes for
// things that aren't a whistleblowing report, such as a customer complaint or
// an HR request. They're configured per jurisdiction pack (XPAI-65).
//
// Where they come from, first match wins:
//   1. `deflection_exits` on the public organization record (by slug), so an
//      anonymous reporter gets them too;
//   2. the organization's jurisdiction pack, which only staff may read;
//   3. two generic exits, so the screen still does its job before a pack is set.
import { useEffect, useState } from 'react';
import { jurisdictionAPI, organizationAPI } from '../api/jurisdiction';
import { useAuthStore } from '../store/authStore';
import { isStaffUser } from '../utils/roles';

export const DEFAULT_DEFLECTION_EXITS = [
  {
    code: 'customer_complaint',
    // Shown through the `submit` translations; `label`/`description` stay as the English record.
    labelKey: 'deflection.defaults.customer_complaint.label',
    descriptionKey: 'deflection.defaults.customer_complaint.description',
    label: { en: 'A complaint about a product or service you received' },
    description: {
      en: 'Use the organization’s customer complaints channel. It is the route regulators expect for complaints, and it can resolve yours directly.',
    },
    url: null,
  },
  {
    code: 'hr_request',
    labelKey: 'deflection.defaults.hr_request.label',
    descriptionKey: 'deflection.defaults.hr_request.description',
    label: { en: 'An HR request about your own job' },
    description: {
      en: 'Leave, pay, contracts, performance reviews or a personal grievance about your own terms: please contact HR.',
    },
    url: null,
  },
];

const usable = (exits) => (Array.isArray(exits) && exits.length ? exits : null);

export function useDeflectionExits(organizationSlug) {
  const user = useAuthStore((s) => s.user);
  const [state, setState] = useState({ loading: true, exits: DEFAULT_DEFLECTION_EXITS, source: 'default' });

  useEffect(() => {
    let cancelled = false;
    const slug = organizationSlug || user?.organization_slug;

    (async () => {
      let organization = null;
      if (slug) {
        try {
          organization = await organizationAPI.bySlug(slug);
        } catch {
          /* the public record is optional here */
        }
      }
      const fromOrg = usable(organization?.deflection_exits);
      if (fromOrg) return { exits: fromOrg, source: 'organization' };

      const packCode = organization?.default_jurisdiction_pack_code;
      if (packCode && isStaffUser(user)) {
        try {
          const { pack } = await jurisdictionAPI.get(packCode);
          const fromPack = usable(pack?.deflection_exits);
          if (fromPack) return { exits: fromPack, source: 'pack' };
        } catch {
          /* fall through to the defaults */
        }
      }
      return { exits: DEFAULT_DEFLECTION_EXITS, source: 'default' };
    })().then((next) => {
      if (!cancelled) setState({ loading: false, ...next });
    });

    return () => {
      cancelled = true;
    };
  }, [organizationSlug, user]);

  return state;
}
