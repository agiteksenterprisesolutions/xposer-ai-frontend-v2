// src/api/voiceProfile.js
//
// How the voice agent introduces an organization on calls. An organization
// admin is scoped to their own organization by the JWT and sends nothing
// extra. A super admin has no organization of their own, so every request
// must name one with `organization_id` — without it the server answers 400.
//
// The trailing slash on the path is required.
import api from './axios';

const scoped = (organizationId) =>
  organizationId ? { params: { organization_id: organizationId } } : {};

export const voiceProfileAPI = {
  /** `version: 0` with `updated_at: null` means nothing has been saved yet. */
  getVoiceProfile: async (organizationId = null) => {
    const response = await api.get('/voice-profile/', scoped(organizationId));
    return response.data;
  },

  /**
   * Whole-profile replace. All three fields are always sent: a field left out
   * is cleared, not kept. The server trims and collapses whitespace and turns
   * empty strings into null, so the form must be refilled from the response.
   */
  updateVoiceProfile: async ({ displayName, about, greeting }, organizationId = null) => {
    const response = await api.put(
      '/voice-profile/',
      {
        display_name: displayName ?? null,
        about: about ?? null,
        greeting: greeting ?? null,
      },
      scoped(organizationId),
    );
    return response.data;
  },

  /** Permanent: returns the empty profile at version 0. */
  resetVoiceProfile: async (organizationId = null) => {
    const response = await api.delete('/voice-profile/', scoped(organizationId));
    return response.data;
  },
};
